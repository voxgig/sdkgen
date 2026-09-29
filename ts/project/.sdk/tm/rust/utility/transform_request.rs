use std::rc::Rc;

use crate::core::context::Context;
use crate::core::helpers::{getp, jo, setp, to_map};
use crate::utility::voxgigstruct as vs;
use crate::utility::voxgigstruct::Value;

// `$action` selects the point (see make_point_util); it is never an API
// field, so the body is a copy without it. The caller's map is left untouched.
fn strip_action(reqdata: Value) -> Value {
    omit_keys(reqdata, &["$action".to_string()])
}

// A header argument travels as a header, which prepare_headers_util sends, so
// the body is built from the request data without it.
fn header_arg_names(point: &Value) -> Vec<String> {
    match getp(&getp(point, "args"), "header") {
        Value::List(hl) => hl
            .borrow()
            .iter()
            .filter_map(|hd| match getp(hd, "name") {
                Value::Str(n) if !n.is_empty() => Some(n),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn omit_keys(reqdata: Value, names: &[String]) -> Value {
    let has = match &reqdata {
        Value::Map(src) => names.iter().any(|n| src.borrow().contains_key(n)),
        _ => false,
    };
    if !has {
        return reqdata;
    }
    let body = Value::empty_map();
    if let Value::Map(src) = &reqdata {
        let entries: Vec<(String, Value)> = src
            .borrow()
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
        for (k, v) in entries {
            if !names.contains(&k) {
                setp(&body, &k, v);
            }
        }
    }
    body
}

pub fn transform_request_util(ctx: &Rc<Context>) -> Value {
    let spec = ctx.spec.borrow().clone();
    let point = ctx.point.borrow().clone();

    if let Some(sp) = &spec {
        sp.borrow_mut().step = "reqform".to_string();
    }

    let reqdata = omit_keys(ctx.reqdata.borrow().clone(), &header_arg_names(&point));

    let transform = to_map(&getp(&point, "transform"));
    if transform.is_noval() {
        return strip_action(reqdata);
    }

    let reqform = getp(&transform, "req");
    if reqform.is_noval() || reqform.is_null() {
        return strip_action(reqdata);
    }

    let store = jo(vec![("reqdata", reqdata.clone())]);
    strip_action(match vs::transform(&store, &reqform, None) {
        Ok(out) => out,
        Err(_) => reqdata,
    })
}
