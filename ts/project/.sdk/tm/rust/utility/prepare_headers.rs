use std::rc::Rc;

use crate::core::context::Context;
use crate::core::helpers::{getp, setp};
use crate::utility::voxgigstruct as vs;
use crate::utility::voxgigstruct::Value;

pub fn prepare_headers_util(ctx: &Rc<Context>) -> Value {
    let options = match ctx.client.borrow().clone() {
        Some(client) => client.options_map(),
        None => ctx.options.borrow().clone(),
    };

    let headers = getp(&options, "headers");
    let out = if headers.is_noval() || headers.is_null() {
        Value::empty_map()
    } else {
        match vs::clone(&headers) {
            Value::Map(m) => Value::Map(m),
            _ => Value::empty_map(),
        }
    };

    // A header parameter travels as a header, under the name the definition
    // gives it, and only from this call's own arguments.
    let point = ctx.point.borrow().clone();
    if let Value::List(hl) = getp(&getp(&point, "args"), "header") {
        let reqmatch = ctx.reqmatch.borrow().clone();
        let reqdata = ctx.reqdata.borrow().clone();
        for hd in hl.borrow().iter() {
            let name = match getp(hd, "name") {
                Value::Str(n) if !n.is_empty() => n,
                _ => continue,
            };
            let wire = match getp(hd, "orig") {
                Value::Str(o) if !o.is_empty() => o,
                _ => name.clone(),
            };
            let mut val = getp(&reqmatch, &name);
            if val.is_noval() || val.is_null() {
                val = getp(&reqdata, &name);
            }
            if !val.is_noval() && !val.is_null() {
                setp(&out, &wire.to_lowercase(), Value::Str(vs::stringify(&val, None, false)));
            }
        }
    }

    out
}
