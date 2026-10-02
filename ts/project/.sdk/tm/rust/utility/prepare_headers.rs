use std::rc::Rc;

use crate::core::context::Context;
use crate::core::helpers::{getp, setp};
use crate::utility::param::call_args;
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

    // A header argument replaces a default of the same name, whatever its case.
    for (_, wire, val) in call_args(ctx, "header") {
        if !val.is_noval() && !val.is_null() {
            let key = wire.to_lowercase();
            if let Value::Map(m) = &out {
                let same: Vec<String> =
                    m.borrow().keys().filter(|k| k.to_lowercase() == key).cloned().collect();
                for k in same {
                    m.borrow_mut().shift_remove(&k);
                }
            }
            setp(&out, &key, Value::Str(vs::stringify(&val, None, false)));
        }
    }

    out
}
