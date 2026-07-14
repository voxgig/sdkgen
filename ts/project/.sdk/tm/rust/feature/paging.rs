// Pagination support for list operations (mirrors go
// feature/paging_feature.go). On the way out (PreRequest) it stamps
// page/limit (or a cursor) into the request query; on the way back
// (PreResult) it reads the server's pagination signals — a `Link:
// rel="next"` header, `X-Page`/`X-Next-Page`/`X-Total-Count` headers, or
// `next`/`cursor`/`nextCursor`/`hasMore` fields in the body — and records
// them on `result.paging`. A per-call cursor/page from ctrl takes priority
// (used by auto-iteration). Parameter names (`pageParam`, `limitParam`,
// `cursorParam`), the page size (`limit`) and the start page (`startPage`,
// default 1) are configurable.

use std::rc::Rc;

use crate::core::context::Context;
use crate::core::helpers::{get_bool, getp, setp};
use crate::core::types::Feature;
use crate::feature::support::*;
use crate::utility::voxgigstruct::Value;

pub struct PagingFeature {
    pub name: String,
    pub active: bool,
    pub add_opts: Option<Value>,
    options: Value,

    // Activity tracking (mirrors the ts client._paging record).
    pub last: Value,
}

impl PagingFeature {
    pub fn new() -> PagingFeature {
        PagingFeature {
            name: "paging".to_string(),
            active: true,
            add_opts: None,
            options: Value::Noval,
            last: Value::Noval,
        }
    }

    fn is_list(&self, ctx: &Rc<Context>) -> bool {
        let opname = ctx.op.borrow().name.clone();
        let ops =
            fopt_str_list(&self.options, "ops").unwrap_or_else(|| vec!["list".to_string()]);
        ops.iter().any(|o| *o == opname)
    }
}

// Extract the URL of the `rel="next"` entry from a Link header value.
fn link_next(link: &str) -> Option<String> {
    for seg in link.split(',') {
        let lower = seg.to_lowercase();
        if lower.contains("rel=\"next\"") || lower.contains("rel=next") {
            let open = seg.find('<')?;
            let close = seg.find('>')?;
            if open < close {
                return Some(seg[open + 1..close].to_string());
            }
        }
    }
    None
}

fn header_num(headers: &Value, name: &str, paging: &Value, key: &str) {
    let v = match fheader_get(headers, name) {
        Some(v) => v,
        None => return,
    };
    match v {
        Value::Str(s) => {
            let n = fparse_int(&s, -1);
            if n >= 0 {
                setp(paging, key, Value::Num(n as f64));
            }
        }
        Value::Num(n) => {
            setp(paging, key, Value::Num(n));
        }
        _ => {}
    }
}

impl Feature for PagingFeature {
    fn name(&self) -> String {
        self.name.clone()
    }
    fn active(&self) -> bool {
        self.active
    }
    fn add_options(&self) -> Option<Value> {
        self.add_opts.clone()
    }

    fn init(&mut self, _ctx: &Rc<Context>, options: &Value) {
        self.options = options.clone();
        self.active = fopt_bool(options, "active", false);
    }

    fn pre_request(&mut self, ctx: &Rc<Context>) {
        if !self.active || !self.is_list(ctx) {
            return;
        }
        let spec = match ctx.spec.borrow().clone() {
            Some(s) => s,
            None => return,
        };
        let query = {
            let q = spec.borrow().query.clone();
            if matches!(q, Value::Map(_)) {
                q
            } else {
                let nq = Value::empty_map();
                spec.borrow_mut().query = nq.clone();
                nq
            }
        };

        let page_param = fopt_str(&self.options, "pageParam", "page");
        let limit_param = fopt_str(&self.options, "limitParam", "limit");
        let cursor_param = fopt_str(&self.options, "cursorParam", "cursor");

        // A per-call cursor/page from ctrl takes priority (auto-iteration).
        let paging = ctx.ctrl.borrow().borrow().paging.clone();

        let cursor = getp(&paging, "cursor");
        if !cursor.is_noval() && !cursor.is_null() {
            setp(&query, &cursor_param, cursor);
        } else if getp(&query, &page_param).is_noval() {
            let page = getp(&paging, "page");
            if !page.is_noval() && !page.is_null() {
                setp(&query, &page_param, page);
            } else {
                setp(
                    &query,
                    &page_param,
                    Value::Num(fopt_int(&self.options, "startPage", 1) as f64),
                );
            }
        }

        if !getp(&self.options, "limit").is_noval()
            && getp(&query, &limit_param).is_noval()
        {
            setp(
                &query,
                &limit_param,
                Value::Num(fopt_int(&self.options, "limit", 0) as f64),
            );
        }
    }

    fn pre_result(&mut self, ctx: &Rc<Context>) {
        if !self.active || !self.is_list(ctx) {
            return;
        }
        let result = match ctx.result.borrow().clone() {
            Some(r) => r,
            None => return,
        };

        let (headers, body) = {
            let r = result.borrow();
            (r.headers.clone(), r.body.clone())
        };

        let paging = Value::empty_map();
        setp(&paging, "hasMore", Value::Bool(false));
        header_num(&headers, "x-page", &paging, "page");
        header_num(&headers, "x-total-count", &paging, "totalCount");
        header_num(&headers, "x-next-page", &paging, "nextPage");

        // Link: <...>; rel="next"
        if let Some(Value::Str(ls)) = fheader_get(&headers, "link") {
            if let Some(next) = link_next(&ls) {
                setp(&paging, "next", Value::str(next));
            }
        }

        // Body-level cursors.
        if let Value::Map(_) = body {
            let next = getp(&body, "next");
            if !next.is_noval() && !next.is_null() && getp(&paging, "next").is_noval() {
                setp(&paging, "next", next);
            }
            let cursor = getp(&body, "cursor");
            if !cursor.is_noval() && !cursor.is_null() {
                setp(&paging, "cursor", cursor);
            }
            let next_cursor = getp(&body, "nextCursor");
            if !next_cursor.is_noval() && !next_cursor.is_null() {
                setp(&paging, "cursor", next_cursor);
            }
            if let Some(has_more) = get_bool(&body, "hasMore") {
                setp(&paging, "hasMore", Value::Bool(has_more));
            }
        }

        if get_bool(&paging, "hasMore") != Some(true)
            && (!getp(&paging, "next").is_noval()
                || !getp(&paging, "cursor").is_noval()
                || !getp(&paging, "nextPage").is_noval())
        {
            setp(&paging, "hasMore", Value::Bool(true));
        }

        result.borrow_mut().paging = paging.clone();
        self.last = paging;
    }
}
