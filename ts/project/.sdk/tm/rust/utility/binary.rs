use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::ProjectNameError;
use crate::core::helpers::{get_str, getp, jo, setp};
use crate::utility::media::RAW_BODY;
use crate::utility::voxgigstruct as vs;
use crate::utility::voxgigstruct::Value;

pub const DEFAULT_MAX_BUFFER: usize = 16777216;

// File content a caller hands the SDK, held as given. A string is content,
// sent as its UTF-8: nothing here reads a path.
#[derive(Clone, PartialEq)]
pub struct BinarySource {
    pub data: Vec<u8>,
    pub name: Option<String>,
    pub ty: Option<String>,
}

impl BinarySource {
    pub fn bytes(data: impl Into<Vec<u8>>, name: Option<&str>, ty: Option<&str>) -> BinarySource {
        BinarySource {
            data: data.into(),
            name: name.map(String::from),
            ty: ty.filter(|t| !t.is_empty()).map(String::from),
        }
    }

    pub fn size(&self) -> usize {
        self.data.len()
    }

    // A source serialised anywhere is described, never copied.
    pub fn to_value(&self) -> Value {
        let desc = jo(vec![
            ("binary$", Value::str("bytes")),
            ("size", Value::Num(self.size() as f64)),
        ]);
        if let Some(ty) = &self.ty {
            setp(&desc, "type", Value::str(ty.clone()));
        }
        desc
    }
}

impl std::fmt::Debug for BinarySource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&vs::jsonify(&self.to_value(), Some(&vs::JsonFlags { indent: 0, offset: 0 })))
    }
}

// The one source core builds, as `client.binary().bytes(data, name, type)`.
pub struct Binary;

impl Binary {
    pub fn bytes(&self, data: impl Into<Vec<u8>>, name: Option<&str>, ty: Option<&str>) -> BinarySource {
        BinarySource::bytes(data, name, ty)
    }
}

// The request data is a closed value union with no variant for a source, so
// sources travel beside it, by field name; a repeated name is a list.
pub type Sources = Vec<(String, BinarySource)>;

// A value moved out of the request data: a source the caller passed, or the
// data's own value under a binary name, which is content.
#[derive(Clone)]
pub enum Lifted {
    Source(BinarySource),
    Data(Value),
}

pub struct Encoded {
    pub ty: String,
    pub body: Value,
}

pub type Encoder =
    fn(&Rc<Context>, &Value, &[(String, Lifted)]) -> Result<Encoded, ProjectNameError>;

pub fn max_buffer(ctx: &Context) -> usize {
    let declared = getp(&ctx.options.borrow(), "maxBuffer");
    let spec = getp(&crate::core::schema::optspec(), "maxBuffer");
    for val in [declared, spec] {
        if let Value::Num(n) = val {
            if n.is_finite() && 0.0 <= n {
                return n as usize;
            }
        }
    }
    DEFAULT_MAX_BUFFER
}

// The data keys whose values are file content: a multipart or form body's
// binary fields, and the whole of a raw body.
pub fn binary_names(point: &Value) -> Vec<String> {
    let body = getp(point, "body");
    match get_str(&body, "kind").as_deref() {
        Some("raw") => vec![RAW_BODY.to_string()],
        Some("multipart") | Some("form") => match getp(&body, "fields") {
            Value::List(l) => l
                .borrow()
                .iter()
                .filter(|f| getp(f, "binary") == Value::Bool(true))
                .filter_map(|f| get_str(f, "name"))
                .collect(),
            _ => Vec::new(),
        },
        _ => Vec::new(),
    }
}

// Moves the values of binary fields out of the request data, before a hook,
// a transform, validation or clean reads it. A source passed under any other
// name is refused. A source cannot sit deeper in the data, which holds none,
// so the ts walk of the data and the match has nothing to find here.
pub fn lift_sources(ctx: &Rc<Context>) -> Result<(), ProjectNameError> {
    if ctx.sources.borrow().is_some() {
        return Ok(());
    }

    let names = binary_names(&ctx.point.borrow());
    let passed = std::mem::take(&mut *ctx.passed.borrow_mut());

    if let Some((stray, _)) = passed.iter().find(|(name, _)| !names.contains(name)) {
        return Err(ctx.make_error(
            "binary_source_refused",
            &format!(
                "A binary source was passed in \"{}\", which is not a field the operation \
                 declares binary.",
                stray
            ),
        ));
    }

    let mut lifted: Vec<(String, Lifted)> = Vec::new();
    let reqdata = ctx.reqdata.borrow().clone();
    if let Value::Map(m) = &reqdata {
        if names.iter().any(|name| m.borrow().contains_key(name)) {
            let copy = Value::empty_map();
            for (k, v) in m.borrow().iter() {
                if names.contains(k) {
                    lifted.push((k.clone(), Lifted::Data(v.clone())));
                } else {
                    setp(&copy, k, v.clone());
                }
            }
            *ctx.reqdata.borrow_mut() = copy;
        }
    }

    lifted.extend(passed.into_iter().map(|(name, src)| (name, Lifted::Source(src))));
    *ctx.sources.borrow_mut() = Some(lifted);
    Ok(())
}

// A response the model declares to be bytes is read only through the entity's
// binary handle, never into its data.
pub fn bytes_refused(ctx: &Rc<Context>) -> Result<(), ProjectNameError> {
    let response = getp(&ctx.point.borrow(), "response");
    if get_str(&response, "kind").as_deref() != Some("raw")
        || getp(&response, "binary") != Value::Bool(true)
        || ctx.ctrl.borrow().borrow().transfer.is_some()
    {
        return Ok(());
    }
    let action = get_str(&getp(&ctx.point.borrow(), "select"), "$action");
    let call = match action {
        Some(a) => format!("binary(\"{}\")", a),
        None => "binary()".to_string(),
    };
    let op = ctx.op.borrow().clone();
    Err(ctx.make_error(
        "binary_sink_required",
        &format!(
            "Operation \"{}\" on entity \"{}\" answers bytes, which never enter the entity's \
             data: read them with entity.{}.bytes().",
            op.name, op.entity, call
        ),
    ))
}

// A plain value as the text of a form pair or a multipart part.
pub fn item_text(value: &Value) -> String {
    match value {
        Value::Str(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Num(n) if n.is_finite() && 0.0 == n.fract() && n.abs() < 1e21 => {
            format!("{}", *n as i64)
        }
        Value::Num(n) => n.to_string(),
        other => vs::jsonify(other, Some(&vs::JsonFlags { indent: 0, offset: 0 })),
    }
}

// One value a form or multipart body carries for a field.
pub enum ItemValue {
    Source(BinarySource),
    Data(Value),
}

pub struct BodyItem {
    pub name: String,
    pub field: Value,
    pub value: ItemValue,
    pub binary: bool,
}

// The values a form or multipart body carries, in wire order: the fields the
// model declares, in its order, then any other key of the data, in code point
// order. An array repeats its field per item, or is one value joined by the
// field's `join`; an absent or null value sends nothing.
pub fn body_items(body: &Value, data: &Value, lifted: &[(String, Lifted)]) -> Vec<BodyItem> {
    let fields: Vec<Value> = match getp(body, "fields") {
        Value::List(l) => l.borrow().iter().filter(|f| get_str(f, "name").is_some()).cloned().collect(),
        _ => Vec::new(),
    };
    let declared: Vec<String> = fields.iter().filter_map(|f| get_str(f, "name")).collect();
    let plain: Vec<(String, Value)> = match data {
        Value::Map(m) => m.borrow().iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
        _ => Vec::new(),
    };
    let in_plain = |name: &str| plain.iter().any(|(k, _)| k == name);
    let in_lifted = |name: &str| lifted.iter().any(|(k, _)| k == name);

    let mut names: Vec<String> =
        declared.iter().filter(|n| in_plain(n) || in_lifted(n)).cloned().collect();
    let mut rest: Vec<String> =
        plain.iter().map(|(k, _)| k.clone()).filter(|k| !declared.contains(k)).collect();
    rest.sort();
    names.extend(rest);

    let mut items = Vec::new();
    for name in names {
        let field = fields
            .iter()
            .find(|f| get_str(f, "name").as_deref() == Some(name.as_str()))
            .cloned()
            .unwrap_or_else(|| jo(vec![("name", Value::str(name.clone()))]));
        let binary = getp(&field, "binary") == Value::Bool(true);
        let item = |value| BodyItem { name: name.clone(), field: field.clone(), value, binary };

        let sources: Vec<&BinarySource> = lifted
            .iter()
            .filter(|(k, _)| *k == name)
            .filter_map(|(_, v)| match v {
                Lifted::Source(s) => Some(s),
                Lifted::Data(_) => None,
            })
            .collect();
        if !sources.is_empty() {
            items.extend(sources.into_iter().map(|s| item(ItemValue::Source(s.clone()))));
            continue;
        }

        let value = lifted
            .iter()
            .find_map(|(k, v)| match v {
                Lifted::Data(d) if *k == name => Some(d.clone()),
                _ => None,
            })
            .or_else(|| plain.iter().find(|(k, _)| *k == name).map(|(_, v)| v.clone()))
            .unwrap_or(Value::Noval);

        match value {
            Value::Noval | Value::Null => {}
            Value::List(l) => {
                let present: Vec<Value> =
                    l.borrow().iter().filter(|v| !v.is_nullish()).cloned().collect();
                match get_str(&field, "join") {
                    Some(join) if !binary => items.push(item(ItemValue::Data(Value::str(
                        present.iter().map(item_text).collect::<Vec<_>>().join(&join),
                    )))),
                    _ => items.extend(present.into_iter().map(|v| item(ItemValue::Data(v)))),
                }
            }
            other => items.push(item(ItemValue::Data(other))),
        }
    }
    items
}

// The bytes a value sends: a string's UTF-8, else its text.
pub fn value_bytes(value: &Value) -> Vec<u8> {
    item_text(value).into_bytes()
}

// A latin1 string holds any bytes in a struct string, one char per byte.
pub fn latin1(bytes: &[u8]) -> String {
    bytes.iter().map(|b| *b as char).collect()
}

// Bytes as the pipeline carries them: a list of byte values, as a struct
// string must be UTF-8.
pub fn bytes_body(bytes: &[u8]) -> Value {
    crate::utility::media::bytes_value(bytes)
}
