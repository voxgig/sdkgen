use std::rc::Rc;

use crate::core::context::Context;
use crate::core::helpers::{get_bool, get_str, getp, setp};
use crate::utility::media::{is_raw_request, raw_body};
use crate::utility::voxgigstruct::Value;

pub fn prepare_body_util(ctx: &Rc<Context>) -> Value {
    let op = ctx.op.borrow().clone();

    if op.input == "data" {
        if is_raw_request(&ctx.point.borrow()) {
            return raw_body(&ctx.reqdata.borrow());
        }
        return crate::utility::transform_request::transform_request_util(ctx);
    }

    if !point_fields(&ctx.point.borrow()).is_empty() {
        return match_body(ctx);
    }

    Value::Noval
}

// The names a point lists as its body fields.
fn point_fields(point: &Value) -> Vec<String> {
    match getp(point, "fields") {
        Value::List(l) => l
            .borrow()
            .iter()
            .filter_map(|v| v.as_str().map(String::from))
            .collect(),
        _ => Vec::new(),
    }
}

// A list, load or remove routed to a method with a body sends the match
// fields that body declares, never a path parameter, and never a header,
// cookie or query argument the body does not also declare as a field.
fn match_body(ctx: &Rc<Context>) -> Value {
    let point = ctx.point.borrow().clone();
    let args = getp(&point, "args");
    let reqmatch = ctx.reqmatch.borrow().clone();

    let mut routed: Vec<String> = Vec::new();
    if let Value::List(pl) = getp(&point, "params") {
        routed.extend(pl.borrow().iter().filter_map(|v| v.as_str().map(String::from)));
    }
    for kind in ["params", "header", "cookie", "query"] {
        if let Value::List(al) = getp(&args, kind) {
            for arg in al.borrow().iter() {
                if "params" == kind || Some(true) != get_bool(arg, "field") {
                    if let Some(name) = get_str(arg, "name") {
                        routed.push(name);
                    }
                }
            }
        }
    }

    let body = Value::empty_map();
    for name in point_fields(&point) {
        let val = getp(&reqmatch, &name);
        if !val.is_nullish() && "$action" != name && !routed.contains(&name) {
            setp(&body, &name, val);
        }
    }
    body
}
