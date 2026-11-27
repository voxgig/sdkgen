use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::ProjectNameError;
use crate::core::helpers::{get_bool, get_str, getp, setp};
use crate::utility::binary::{bytes_body, lift_sources, Lifted};
use crate::utility::media::{is_raw_request, RAW_BODY};
use crate::utility::voxgigstruct::Value;

pub fn prepare_body_util(ctx: &Rc<Context>) -> Result<Value, ProjectNameError> {
    let op = ctx.op.borrow().clone();

    if op.input == "data" {
        lift_sources(ctx)?;

        if is_raw_request(&ctx.point.borrow()) {
            return Ok(raw_body(ctx));
        }

        let body = crate::utility::transform_request::transform_request_util(ctx);

        let kind = get_str(&getp(&ctx.point.borrow(), "body"), "kind").unwrap_or_default();
        if "form" == kind || "multipart" == kind {
            return encode_body(ctx, &kind, &body);
        }
        return Ok(body);
    }

    if !point_fields(&ctx.point.borrow()).is_empty() {
        return Ok(match_body(ctx));
    }

    Ok(Value::Noval)
}

// A source is sent as its bytes; the data's own `$body` as it was.
fn raw_body(ctx: &Rc<Context>) -> Value {
    let sources = ctx.sources.borrow();
    let lifted = sources.iter().flatten().filter(|(name, _)| RAW_BODY == name);
    let mut out = Value::Noval;
    for (_, value) in lifted {
        match value {
            Lifted::Source(src) => return bytes_body(&src.data),
            Lifted::Data(v) => out = v.clone(),
        }
    }
    out
}

// The encoded body, with its content type replacing any the headers carry:
// a multipart boundary is the encoder's alone to choose.
fn encode_body(ctx: &Rc<Context>, kind: &str, data: &Value) -> Result<Value, ProjectNameError> {
    let encode = crate::utility::codec::encoder(kind).ok_or_else(|| {
        ctx.make_error(
            "body_codec_missing",
            &format!("This SDK was generated without a {} encoder.", kind),
        )
    })?;

    let lifted = ctx.sources.borrow().clone().unwrap_or_default();
    let encoded = encode(ctx, data, &lifted)?;

    if let Some(spec) = ctx.spec.borrow().clone() {
        let headers = spec.borrow().headers.clone();
        if let Value::Map(m) = &headers {
            let named: Vec<String> = m
                .borrow()
                .keys()
                .filter(|k| k.eq_ignore_ascii_case("content-type"))
                .cloned()
                .collect();
            for k in named {
                m.borrow_mut().shift_remove(&k);
            }
            setp(&headers, "content-type", Value::str(encoded.ty));
        }
    }

    Ok(encoded.body)
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
