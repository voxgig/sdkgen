use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::ProjectNameError;
use crate::core::helpers::{get_str, getp};
use crate::utility::binary::{body_items, bytes_body, value_bytes, Encoded, ItemValue, Lifted};
use crate::utility::voxgigstruct::Value;

const MULTIPART_MEDIA: &str = "multipart/form-data";

const OCTET_MEDIA: &str = "application/octet-stream";

const CRLF: &str = "\r\n";

pub fn multipart_boundary(_ctx: &Rc<Context>) -> String {
    let mut bytes = [0u8; 16];
    getrandom::getrandom(&mut bytes).expect("no source of random bytes for a multipart boundary");
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

// Inside a quoted header parameter nothing may end the quote or the line.
pub fn quoted(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '\\' => out.push_str("%5C"),
            '"' => out.push_str("%22"),
            '\r' => out.push_str("%0D"),
            '\n' => out.push_str("%0A"),
            _ => out.push(c),
        }
    }
    out
}

// A local path never leaves: only its last segment, and nothing for an empty one.
pub fn base_name(name: Option<&str>) -> Option<String> {
    let base = name?.rsplit(['/', '\\']).next().unwrap_or("");
    if base.is_empty() {
        None
    } else {
        Some(base.to_string())
    }
}

struct Part {
    filename: Option<String>,
    ty: Option<String>,
    content: Vec<u8>,
}

// A file part's content is bytes: rust has no stream to refuse here.
fn file_part(field: &Value, value: &ItemValue) -> Part {
    let media = get_str(field, "media");
    match value {
        ItemValue::Source(src) => Part {
            filename: base_name(src.name.as_deref()),
            ty: src.ty.clone().or(media).or(Some(OCTET_MEDIA.to_string())),
            content: src.data.clone(),
        },
        ItemValue::Data(v) => Part {
            filename: None,
            ty: media.or(Some(OCTET_MEDIA.to_string())),
            content: value_bytes(v),
        },
    }
}

fn text_part(field: &Value, value: &ItemValue) -> Part {
    Part {
        filename: None,
        ty: get_str(field, "media"),
        content: match value {
            ItemValue::Source(src) => src.data.clone(),
            ItemValue::Data(v) => value_bytes(v),
        },
    }
}

pub fn encode_multipart(
    ctx: &Rc<Context>,
    data: &Value,
    lifted: &[(String, Lifted)],
) -> Result<Encoded, ProjectNameError> {
    let body = getp(&ctx.point.borrow(), "body");
    let utility = ctx.utility.borrow().clone();
    let boundary = match utility {
        Some(u) => u.multipart_boundary(ctx),
        None => multipart_boundary(ctx),
    };
    let mut out: Vec<u8> = Vec::new();

    for item in body_items(&body, data, lifted) {
        let part = if item.binary {
            file_part(&item.field, &item.value)
        } else {
            text_part(&item.field, &item.value)
        };

        if part.ty.as_deref().map_or(false, |t| t.contains(['\r', '\n'])) {
            return Err(ctx.make_error(
                "binary_source_refused",
                &format!(
                    "The media type of the multipart field \"{}\" contains a line break.",
                    item.name
                ),
            ));
        }

        let mut head = format!(
            "--{}{}Content-Disposition: form-data; name=\"{}\"",
            boundary,
            CRLF,
            quoted(&item.name)
        );
        if let Some(filename) = &part.filename {
            head.push_str(&format!("; filename=\"{}\"", quoted(filename)));
        }
        head.push_str(CRLF);
        if let Some(ty) = &part.ty {
            head.push_str(&format!("Content-Type: {}{}", ty, CRLF));
        }
        head.push_str(CRLF);
        out.extend_from_slice(head.as_bytes());
        out.extend_from_slice(&part.content);
        out.extend_from_slice(CRLF.as_bytes());
    }

    out.extend_from_slice(format!("--{}--{}", boundary, CRLF).as_bytes());

    let declared = get_str(&body, "media")
        .map(|m| m.split(';').next().unwrap_or("").trim().to_string())
        .unwrap_or_default();
    let essence = if declared.is_empty() { MULTIPART_MEDIA.to_string() } else { declared };
    Ok(Encoded { ty: format!("{}; boundary={}", essence, boundary), body: bytes_body(&out) })
}
