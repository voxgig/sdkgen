use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::ProjectNameError;
use crate::core::helpers::{get_str, getp};
use crate::utility::binary::{body_items, value_bytes, Encoded, ItemValue, Lifted};
use crate::utility::voxgigstruct::Value;

const FORM_MEDIA: &str = "application/x-www-form-urlencoded";

const HEX: &[u8; 16] = b"0123456789ABCDEF";

// application/x-www-form-urlencoded byte serialisation: alphanumerics and
// `*-._` as they are, a space as `+`, every other byte as %HH.
pub fn form_escape(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len());
    for &byte in bytes {
        if byte.is_ascii_alphanumeric() || b"*-._".contains(&byte) {
            out.push(byte as char);
        } else if b' ' == byte {
            out.push('+');
        } else {
            out.push('%');
            out.push(HEX[(byte >> 4) as usize] as char);
            out.push(HEX[(byte & 15) as usize] as char);
        }
    }
    out
}

// A source here is bytes alone: rust has no Blob or stream to refuse.
pub fn encode_form(
    ctx: &Rc<Context>,
    data: &Value,
    lifted: &[(String, Lifted)],
) -> Result<Encoded, ProjectNameError> {
    let body = getp(&ctx.point.borrow(), "body");
    let pairs: Vec<String> = body_items(&body, data, lifted)
        .into_iter()
        .map(|item| {
            let value = match &item.value {
                ItemValue::Source(src) => src.data.clone(),
                ItemValue::Data(v) => value_bytes(v),
            };
            form_escape(item.name.as_bytes()) + "=" + &form_escape(&value)
        })
        .collect();

    let media = get_str(&body, "media").filter(|m| !m.is_empty()).unwrap_or(FORM_MEDIA.to_string());
    Ok(Encoded { ty: media, body: Value::str(pairs.join("&")) })
}
