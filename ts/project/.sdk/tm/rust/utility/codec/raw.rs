use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::ProjectNameError;
use crate::core::helpers::{jo, setp};
use crate::core::response::{header_value, Response};
use crate::utility::binary::max_buffer;
use crate::utility::media::{body_bytes, RAW_BODY};
use crate::utility::voxgigstruct::Value;

fn too_large(ctx: &Context, code: &str, max: usize, declared: Option<usize>) -> ProjectNameError {
    let what = match declared {
        Some(n) => format!("of {} bytes exceeds", n),
        None => "is longer than".to_string(),
    };
    ctx.make_error(code, &format!("response: body {} maxBuffer ({} bytes)", what, max))
}

// The whole body, refused past the bound: by its declared length before a
// byte is taken, else by the count. The transport has already read it: the
// default one reads no further than the bound for a raw point.
pub fn read_bounded(
    ctx: &Context,
    response: &Response,
    max: usize,
    code: &str,
) -> Result<Vec<u8>, ProjectNameError> {
    let length = header_value(&response.headers, "content-length");
    let length = length.trim();
    if !length.is_empty() && length.bytes().all(|b| b.is_ascii_digit()) {
        let declared = length.parse::<usize>().unwrap_or(usize::MAX);
        if max < declared {
            return Err(too_large(ctx, code, max, Some(declared)));
        }
    }

    let bytes = match &response.body {
        Value::Noval | Value::Null => Vec::new(),
        Value::Str(s) => s.as_bytes().to_vec(),
        other => body_bytes(other).unwrap_or_else(|| {
            crate::utility::voxgigstruct::stringify(other, None, false).into_bytes()
        }),
    };
    if max < bytes.len() {
        return Err(too_large(ctx, code, max, None));
    }
    Ok(bytes)
}

// A raw success body: text into the record under `$body`; bytes only into a
// binary handle's read, never into the record.
pub fn read_raw(ctx: &Rc<Context>) -> Result<(), ProjectNameError> {
    let response = match ctx.response.borrow().clone() {
        Some(r) => r,
        None => return Ok(()),
    };
    let result = match ctx.result.borrow().clone() {
        Some(r) => r,
        None => return Ok(()),
    };
    let max = max_buffer(ctx);
    let binary = crate::core::helpers::getp(
        &crate::core::helpers::getp(&ctx.point.borrow(), "response"),
        "binary",
    ) == Value::Bool(true);

    if binary {
        result.borrow_mut().body = Value::Noval;
        let transfer = ctx.ctrl.borrow().borrow().transfer.clone();
        if let Some(transfer) = transfer {
            if "read" == transfer.borrow().direction {
                let bytes = read_bounded(ctx, &response.borrow(), max, "binary_too_large")?;
                transfer.borrow_mut().bytes = Some(bytes);
            }
        }
        return Ok(());
    }

    let bytes = read_bounded(ctx, &response.borrow(), max, "response_too_large")?;
    let out = jo(vec![]);
    setp(&out, RAW_BODY, Value::str(String::from_utf8_lossy(&bytes).to_string()));
    result.borrow_mut().body = out;
    Ok(())
}
