use std::cell::RefCell;
use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::ProjectNameError;
use crate::core::helpers::{getp, jo, setp};
use crate::core::response::{header_value, is_binary_response, Response};
use crate::core::spec::Spec;
use crate::utility::media::{is_raw_request, RAW_BODY};
use crate::utility::voxgigstruct as vs;
use crate::utility::voxgigstruct::Value;

// Every registered secret VALUE (and its encoded forms) is replaced wherever
// it appears in a string, and every value under a sensitive KEY name is
// masked whatever it holds. The registry is the Rc-shared `values` list of
// the context's `cleancfg`, held beside the options rather than in them, so a
// feature registering a value later reaches the list every context reads.

const MAXDEPTH: usize = 32;
const CIRCULAR: &str = "[circular]";
const DEFAULT_MASK: &str = "[redacted]";

// The key of what stands in for a body of bytes; its value is the kind.
const BINARY: &str = "binary$";

struct CleanConfig {
    active: bool,
    keys: Vec<String>,
    values: Vec<String>,
    mask: String,
    hint: usize,
}

// Where the live bodies of this call that are bytes are held, each with its
// type. Handles, so a body is compared in place, never copied.
struct BinaryBody {
    spec: Option<Rc<RefCell<Spec>>>,
    reqdata: Value,
    media: Option<String>,
    response: Option<Rc<RefCell<Response>>>,
    ctype: Option<String>,
}

fn normkey(key: &str) -> String {
    key.to_lowercase()
        .chars()
        .filter(|c| '-' != *c && '_' != *c)
        .collect()
}

fn strs(val: &Value) -> Vec<String> {
    match val {
        Value::List(l) => l
            .borrow()
            .iter()
            .filter_map(|v| match v {
                Value::Str(s) => Some(s.clone()),
                _ => None,
            })
            .collect(),
        Value::Str(s) => s
            .split(',')
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty())
            .collect(),
        _ => Vec::new(),
    }
}

fn splitkeys(keys: &Value) -> Vec<String> {
    strs(keys)
        .iter()
        .map(|k| normkey(k))
        .filter(|k| !k.is_empty())
        .collect()
}

/// The comma-separated literal values a caller registers; a list is taken
/// as-is for a caller that has one.
pub fn splitvalues(values: &Value) -> Vec<String> {
    strs(values)
}

// The spec carries numbers as strings, so every target reads it alike.
fn count(val: &Value, dflt: usize) -> usize {
    let n = match val {
        Value::Num(n) => *n,
        Value::Str(s) => s.trim().parse::<f64>().unwrap_or(f64::NAN),
        _ => f64::NAN,
    };
    if n.is_finite() && 0.0 <= n {
        n.floor() as usize
    } else {
        dflt
    }
}

/// The clean registry from a clean option block: what make_options stores
/// on the context as `cleancfg`.
pub fn make_clean_config(cleanopts: &Value) -> Value {
    let active = !matches!(getp(cleanopts, "active"), Value::Bool(false));
    let mask = match getp(cleanopts, "mask") {
        Value::Str(s) => s,
        _ => DEFAULT_MASK.to_string(),
    };
    jo(vec![
        ("active", Value::Bool(active)),
        (
            "keys",
            Value::list(splitkeys(&getp(cleanopts, "keys")).into_iter().map(Value::str).collect()),
        ),
        ("values", Value::empty_list()),
        ("mask", Value::str(mask)),
        ("hint", Value::Num(count(&getp(cleanopts, "hint"), 0) as f64)),
        ("min", Value::Num(count(&getp(cleanopts, "min"), 4).max(1) as f64)),
    ])
}

// A context without a registry (make_error is reached with a bare one) falls
// back to the schema defaults, so nothing leaves raw for want of a
// constructor.
fn config_block(ctx: &Context) -> Value {
    let cfg = ctx.cleancfg.borrow().clone();
    if let Value::Map(_) = cfg {
        return cfg;
    }
    make_clean_config(&getp(&crate::core::schema::optspec(), "clean"))
}

fn read_config(block: &Value) -> CleanConfig {
    CleanConfig {
        active: !matches!(getp(block, "active"), Value::Bool(false)),
        keys: strs(&getp(block, "keys")),
        values: strs(&getp(block, "values")),
        mask: match getp(block, "mask") {
            Value::Str(s) => s,
            _ => DEFAULT_MASK.to_string(),
        },
        hint: count(&getp(block, "hint"), 0),
    }
}

/// Standard base64 (RFC 4648), for the encoded form of a registered value
/// and for the `Authorization: Basic` composite.
pub fn base64_encode(input: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);

    for chunk in input.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = *chunk.get(1).unwrap_or(&0) as usize;
        let b2 = *chunk.get(2).unwrap_or(&0) as usize;

        out.push(ALPHABET[b0 >> 2] as char);
        out.push(ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)] as char);
        out.push(if 1 < chunk.len() {
            ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] as char
        } else {
            '='
        });
        out.push(if 2 < chunk.len() {
            ALPHABET[b2 & 0x3f] as char
        } else {
            '='
        });
    }

    out
}

// The encoded forms a value travels in: Basic and Bearer both carry base64,
// a query credential is percent-encoded, and a JSON dump escapes it.
fn forms(value: &str) -> Vec<String> {
    let mut out: Vec<String> = vec![value.to_string()];
    let mut add = |s: String| {
        if !s.is_empty() && !out.contains(&s) {
            out.push(s);
        }
    };
    add(base64_encode(value.as_bytes()));
    add(vs::esc_url(&Value::str(value)));
    let json = vs::jsonify(&Value::str(value), None);
    if 2 <= json.len() {
        add(json[1..json.len() - 1].to_string());
    }
    out
}

/// Register a secret value in a clean registry. Idempotent; shorter than
/// `min` is not a secret the SDK can mask without blanking ordinary text.
/// Anything but a registry map registers nothing.
pub fn clean_add_cfg(block: &Value, value: &str) {
    if !matches!(block, Value::Map(_)) {
        return;
    }
    let min = count(&getp(block, "min"), 4).max(1);
    if value.chars().count() < min {
        return;
    }
    let list = match getp(block, "values") {
        Value::List(l) => l,
        _ => {
            let l = Value::empty_list();
            setp(block, "values", l.clone());
            match l {
                Value::List(l) => l,
                _ => return,
            }
        }
    };
    let mut items = list.borrow_mut();
    let mut changed = false;
    for form in forms(value) {
        if form.chars().count() < min {
            continue;
        }
        let present = items.iter().any(|v| matches!(v, Value::Str(s) if *s == form));
        if !present {
            items.push(Value::str(form));
            changed = true;
        }
    }
    if changed {
        items.sort_by(|a, b| {
            let la = a.as_str().map(|s| s.len()).unwrap_or(0);
            let lb = b.as_str().map(|s| s.len()).unwrap_or(0);
            lb.cmp(&la)
        });
    }
}

/// Register a secret value the context's registry will mask from now on.
pub fn clean_add(ctx: &Rc<Context>, value: &str) {
    let cfg = ctx.cleancfg.borrow().clone();
    clean_add_cfg(&cfg, value);
}

fn mask_value(cfg: &CleanConfig, value: &str) -> String {
    let n = value.chars().count();
    if 0 < cfg.hint && n > 2 * cfg.hint {
        let tail: String = value.chars().skip(n - cfg.hint).collect();
        return format!("{}{}", cfg.mask, tail);
    }
    cfg.mask.clone()
}

fn clean_string(cfg: &CleanConfig, text: &str) -> String {
    let mut out = text.to_string();
    for value in &cfg.values {
        if out.contains(value.as_str()) {
            out = out.replace(value.as_str(), &mask_value(cfg, value));
        }
    }
    out
}

fn sensitive_key(cfg: &CleanConfig, key: Option<&str>) -> bool {
    let key = match key {
        Some(k) => k,
        None => return false,
    };
    let nk = normkey(key);
    cfg.keys.iter().any(|k| nk.contains(k.as_str()))
}

fn node_ptr(val: &Value) -> Option<usize> {
    match val {
        Value::List(l) => Some(Rc::as_ptr(l) as *const () as usize),
        Value::Map(m) => Some(Rc::as_ptr(m) as *const () as usize),
        _ => None,
    }
}

// The request body of a point the model marks binary, and a response body
// that is bytes. A string or a list shorter than the registry accepts is not
// told from ordinary data.
fn binary_body(ctx: &Context) -> Option<BinaryBody> {
    let point = ctx.point.borrow();
    let body = getp(&point, "body");
    let sent = is_raw_request(&point) && getp(&body, "binary") == Value::Bool(true);
    let response = ctx.response.borrow().clone();
    let ctype = response.as_ref().map(|r| header_value(&r.borrow().headers, "content-type"));
    let answered = ctype.as_deref().map_or(false, |t| is_binary_response(&point, t));
    if !sent && !answered {
        return None;
    }
    let min = count(&getp(&config_block(ctx), "min"), 4).max(1);
    let long = |live: &Value| match live {
        Value::Str(s) => min <= s.chars().take(min).count(),
        Value::List(l) => min <= l.borrow().len(),
        _ => false,
    };
    let spec = ctx.spec.borrow().clone().filter(|spec| sent && long(&spec.borrow().body));
    let reqdata = match &*ctx.reqdata.borrow() {
        Value::Map(data) if sent && data.borrow().get(RAW_BODY).map_or(false, &long) => {
            Value::Map(data.clone())
        }
        _ => Value::Noval,
    };
    let response = response.filter(|r| answered && long(&r.borrow().body));
    if spec.is_none() && reqdata.is_noval() && response.is_none() {
        return None;
    }
    let media = match getp(&body, "media") {
        Value::Str(s) => Some(s),
        _ => None,
    };
    let ctype = ctype.filter(|t| !t.is_empty());
    Some(BinaryBody { spec, reqdata, media, response, ctype })
}

fn is_request_body(bin: &BinaryBody, val: &Value) -> bool {
    if let Some(spec) = &bin.spec {
        if spec.borrow().body == *val {
            return true;
        }
    }
    match &bin.reqdata {
        Value::Map(data) => data.borrow().get(RAW_BODY).map_or(false, |body| body == val),
        _ => false,
    }
}

fn is_response_body(bin: &BinaryBody, val: &Value) -> bool {
    bin.response.as_ref().map_or(false, |r| r.borrow().body == *val)
}

// Bytes are described, never copied (ADR-006). The value union has no
// variant for bytes: a string, or a list of byte values, is bytes only as a
// live body, by identity or equal content. A response read as text does not
// say how many bytes it was, so it is not sized.
fn describe_binary(val: &Value, bin: Option<&BinaryBody>) -> Option<Value> {
    let bin = bin?;
    let size = match val {
        Value::Str(s) => s.len(),
        Value::List(l) => l.borrow().len(),
        _ => return None,
    };
    let (media, sized) = if is_request_body(bin, val) {
        (&bin.media, true)
    } else if is_response_body(bin, val) {
        (&bin.ctype, matches!(val, Value::List(_)))
    } else {
        return None;
    };
    let desc = jo(vec![(BINARY, Value::str("bytes"))]);
    if sized {
        setp(&desc, "size", Value::Num(size as f64));
    }
    if let Some(media) = media {
        setp(&desc, "type", Value::str(media.clone()));
    }
    Some(desc)
}

// A plain-data copy of what is about to leave: functions are dropped,
// cycles are cut, and no live node is shared with the copy - masking the
// copy must never mask the pipeline's own spec.
fn snapshot(
    cfg: &CleanConfig,
    bin: Option<&BinaryBody>,
    val: &Value,
    key: Option<&str>,
    depth: usize,
    seen: &mut Vec<usize>,
) -> Value {
    match val {
        Value::Noval | Value::Null => val.clone(),
        Value::Str(s) => {
            if sensitive_key(cfg, key) {
                Value::str(mask_value(cfg, s))
            } else if let Some(desc) = describe_binary(val, bin) {
                desc
            } else {
                Value::str(clean_string(cfg, s))
            }
        }
        Value::Func(_) => Value::Noval,
        Value::Bool(_) | Value::Num(_) | Value::Sentinel(_) => {
            if sensitive_key(cfg, key) {
                Value::str(cfg.mask.clone())
            } else {
                val.clone()
            }
        }
        Value::List(_) | Value::Map(_) => {
            let ptr = node_ptr(val).unwrap_or(0);
            if MAXDEPTH <= depth || seen.contains(&ptr) {
                return Value::str(CIRCULAR);
            }
            if sensitive_key(cfg, key) {
                return Value::str(cfg.mask.clone());
            }
            if let Some(desc) = describe_binary(val, bin) {
                return desc;
            }
            seen.push(ptr);
            let out = match val {
                Value::List(l) => {
                    let items: Vec<Value> = l
                        .borrow()
                        .iter()
                        .map(|v| snapshot(cfg, bin, v, None, depth + 1, seen))
                        .collect();
                    Value::list(items)
                }
                Value::Map(m) => {
                    let out = Value::empty_map();
                    for (k, v) in m.borrow().iter() {
                        let cv = snapshot(cfg, bin, v, Some(k), depth + 1, seen);
                        if !cv.is_noval() {
                            let name = clean_name(cfg, &out, k);
                            setp(&out, &name, cv);
                        }
                    }
                    out
                }
                _ => Value::Noval,
            };
            seen.pop();
            out
        }
    }
}

// A registered value used as a property name is masked like any other
// string; names that mask alike take a counter, so none is lost.
fn clean_name(cfg: &CleanConfig, out: &Value, key: &str) -> String {
    let taken = |n: &str| match out {
        Value::Map(m) => m.borrow().get(n).is_some(),
        _ => false,
    };
    let name = clean_string(cfg, key);
    if name == key || !taken(&name) {
        return name;
    }
    let mut i = 1;
    while taken(&format!("{}#{}", name, i)) {
        i += 1;
    }
    format!("{}#{}", name, i)
}

fn clean_with(cfg: &CleanConfig, bin: Option<&BinaryBody>, val: &Value) -> Value {
    if !cfg.active {
        return val.clone();
    }
    match val {
        Value::Str(s) => Value::str(clean_string(cfg, s)),
        _ => snapshot(cfg, bin, val, None, 0, &mut Vec::new()),
    }
}

/// Clean a value on its way out. A string is redacted; anything else comes
/// back as a masked plain-data copy. Takes the bare context so a `Debug`
/// impl can reach it.
pub fn clean_value(ctx: &Context, val: &Value) -> Value {
    clean_with(&read_config(&config_block(ctx)), binary_body(ctx).as_ref(), val)
}

pub fn clean_util(ctx: &Rc<Context>, val: &Value) -> Value {
    clean_value(ctx, val)
}

/// String flavour of clean.
pub fn clean_str(ctx: &Rc<Context>, val: &str) -> String {
    let cfg = read_config(&config_block(ctx));
    if !cfg.active {
        return val.to_string();
    }
    clean_string(&cfg, val)
}

/// Clean a value against a registry rather than a context, for a feature
/// that holds the registry but no context.
pub fn clean_cfg(block: &Value, val: &Value) -> Value {
    if !matches!(block, Value::Map(_)) {
        return val.clone();
    }
    clean_with(&read_config(block), None, val)
}

/// Is this key name sensitive under the context's clean configuration?
pub fn clean_key(ctx: &Rc<Context>, key: &str) -> bool {
    sensitive_key(&read_config(&config_block(ctx)), Some(key))
}

/// An error that never passed through make_error, returned as its cleaned
/// self: every text field and both snapshots.
pub fn clean_error(ctx: &Rc<Context>, mut err: ProjectNameError) -> ProjectNameError {
    let cfg = read_config(&config_block(ctx));
    if cfg.active {
        let bin = binary_body(ctx);
        err.msg = clean_string(&cfg, &err.msg);
        err.code = clean_string(&cfg, &err.code);
        err.result = clean_with(&cfg, bin.as_ref(), &err.result);
        err.spec = clean_with(&cfg, bin.as_ref(), &err.spec);
    }
    err
}

/// Every scalar under a sensitive name, at any depth and of any shape, is
/// registered in `block`: a credential mistyped as a map or a number is
/// still a credential.
pub fn clean_add_sensitive_cfg(block: &Value, val: &Value) {
    if !matches!(block, Value::Map(_)) {
        return;
    }
    let cfg = read_config(block);
    add_sensitive(&cfg, block, val, false, 0, &mut Vec::new());
}

pub fn clean_add_sensitive(ctx: &Rc<Context>, val: &Value) {
    let cfg = ctx.cleancfg.borrow().clone();
    clean_add_sensitive_cfg(&cfg, val);
}

fn add_sensitive(
    cfg: &CleanConfig,
    block: &Value,
    val: &Value,
    under: bool,
    depth: usize,
    seen: &mut Vec<usize>,
) {
    if MAXDEPTH <= depth {
        return;
    }
    match val {
        Value::Str(s) if under => clean_add_cfg(block, s),
        Value::Num(n) if under => clean_add_cfg(block, &vs::value::num_to_string(*n)),
        Value::List(_) | Value::Map(_) => {
            let ptr = node_ptr(val).unwrap_or(0);
            if seen.contains(&ptr) {
                return;
            }
            seen.push(ptr);
            match val {
                Value::List(l) => {
                    for v in l.borrow().iter() {
                        add_sensitive(cfg, block, v, under, depth + 1, seen);
                    }
                }
                Value::Map(m) => {
                    for (k, v) in m.borrow().iter() {
                        let sub = under || sensitive_key(cfg, Some(k));
                        add_sensitive(cfg, block, v, sub, depth + 1, seen);
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
}

/// Whether a named value is a secret: by its name, or by a registered value
/// it holds. Answered with clean off too: a redirect asks, not a diagnostic.
pub fn clean_secret(ctx: &Rc<Context>, key: &str, value: &str) -> bool {
    let cfg = read_config(&config_block(ctx));
    sensitive_key(&cfg, Some(key)) || cfg.values.iter().any(|v| value.contains(v.as_str()))
}
