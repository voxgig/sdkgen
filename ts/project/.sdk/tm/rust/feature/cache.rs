
use std::cell::RefCell;
use std::collections::hash_map::RandomState;
use std::collections::HashMap;
use std::hash::{BuildHasher, Hash, Hasher};
use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::ProjectNameError;
use crate::core::helpers::{call_json, get_str, getp, jo, json_thunk, setp};
use crate::core::types::{Feature, FetcherFn};
use crate::feature::support::*;
use crate::utility::media::is_json_media;
use crate::utility::voxgigstruct::Value;

pub struct CacheSnapshot {
    status: i64,
    status_text: String,
    data: Value,
    headers: Value,
}

pub struct CacheEntry {
    expiry: i64,
    scope: String,
    snapshot: Rc<CacheSnapshot>,
}

#[derive(Default)]
pub struct CacheTrack {
    store: HashMap<String, CacheEntry>,
    order: Vec<String>,
    // No HMAC in std: SipHash under this client's random keys separates
    // header sets within one store without holding a header value. It is not
    // a cryptographic commitment.
    secret: RandomState,

    // Activity tracking (mirrors the ts client._cache record).
    pub hit: i64,
    pub miss: i64,
    pub bypass: i64,
}

pub struct CacheFeature {
    pub name: String,
    pub active: bool,
    pub add_opts: Option<Value>,
    options: Value,
    pub track: Rc<RefCell<CacheTrack>>,
}

impl CacheFeature {
    pub fn new() -> CacheFeature {
        CacheFeature {
            name: "cache".to_string(),
            active: true,
            add_opts: None,
            options: Value::Noval,
            track: Rc::new(RefCell::new(CacheTrack::default())),
        }
    }
}

impl Feature for CacheFeature {
    fn name(&self) -> String {
        self.name.clone()
    }
    fn active(&self) -> bool {
        self.active
    }
    fn add_options(&self) -> Option<Value> {
        self.add_opts.clone()
    }

    fn init(&mut self, ctx: &Rc<Context>, options: &Value) {
        self.options = options.clone();
        self.active = fopt_bool(options, "active", false);

        if !self.active {
            return;
        }

        let util = ctx.util();
        let inner: FetcherFn = util.fetcher.borrow().clone();
        let track = self.track.clone();
        let options = options.clone();

        *util.fetcher.borrow_mut() = Rc::new(move |ctx2, url, fetchdef| {
            through(&track, &options, ctx2, url, fetchdef, &inner)
        });
    }
}

fn through(
    track: &Rc<RefCell<CacheTrack>>,
    options: &Value,
    ctx: &Rc<Context>,
    url: &str,
    fetchdef: &Value,
    inner: &FetcherFn,
) -> Result<Value, ProjectNameError> {
    let method = get_str(fetchdef, "method")
        .filter(|m| !m.is_empty())
        .unwrap_or_else(|| "GET".to_string())
        .to_uppercase();

    let methods = fopt_str_list(options, "methods").unwrap_or_else(|| vec!["GET".to_string()]);
    let cacheable = methods.iter().any(|m| m.to_uppercase() == method);
    if !cacheable {
        let out = inner(ctx, url, fetchdef);
        if method != "GET" && method != "HEAD" {
            invalidate(&mut track.borrow_mut(), url);
        }
        return out;
    }

    let key = format!("{} {} {}", method, url, digest(&track.borrow().secret, &getp(fetchdef, "headers")));
    let now = fopt_now(options)();

    {
        let mut t = track.borrow_mut();
        if let Some(hit) = t.store.get(&key) {
            if hit.expiry > now {
                let snap = hit.snapshot.clone();
                t.hit += 1;
                return Ok(replay(&snap));
            }
        }
    }

    let out = inner(ctx, url, fetchdef);

    if let Ok(res) = &out {
        if storable(res) && json(res) {
            let snap = Rc::new(snapshot(res));
            let ttl = lifetime(&snap.headers, fopt_int(options, "ttl", 5000));
            let mut t = track.borrow_mut();
            if ttl <= 0 {
                t.bypass += 1;
                return Ok(replay(&snap));
            }
            drop_entry(&mut t, &key);
            evict(&mut t, options);
            t.store.insert(
                key.clone(),
                CacheEntry {
                    expiry: now + ttl,
                    scope: url_scope(url),
                    snapshot: snap.clone(),
                },
            );
            t.order.push(key);
            t.miss += 1;
            return Ok(replay(&snap));
        }
    }

    track.borrow_mut().bypass += 1;
    out
}

fn header_text(v: &Value) -> Option<String> {
    match v {
        Value::Noval | Value::Null => None,
        Value::Str(s) => Some(s.clone()),
        Value::Num(n) if n.fract() == 0.0 => Some(format!("{}", *n as i64)),
        Value::Num(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        other => Some(format!("{:?}", other)),
    }
}

fn digest(secret: &RandomState, headers: &Value) -> String {
    let mut pairs: Vec<(String, String)> = Vec::new();
    if let Value::Map(hm) = headers {
        for (k, v) in hm.borrow().iter() {
            if let Some(text) = header_text(v) {
                pairs.push((k.to_lowercase(), text));
            }
        }
    }
    pairs.sort();
    let mut hasher = secret.build_hasher();
    for (k, v) in &pairs {
        format!("{}:{}\n", k, v).hash(&mut hasher);
    }
    format!("{:016x}", hasher.finish())
}

fn invalidate(t: &mut CacheTrack, url: &str) {
    let path = url_scope(url);
    let collection = url_parent(&path);
    let dropped: Vec<String> = t
        .store
        .iter()
        .filter(|(_, e)| scope_under(&e.scope, &path) || e.scope == collection)
        .map(|(k, _)| k.clone())
        .collect();
    for key in dropped {
        drop_entry(t, &key);
    }
}

fn drop_entry(t: &mut CacheTrack, key: &str) {
    if t.store.remove(key).is_some() {
        t.order.retain(|k| k != key);
    }
}

// The configured ttl capped by the response's Cache-Control; zero when the
// response may not be stored.
fn lifetime(headers: &Value, ttl: i64) -> i64 {
    let mut control = String::new();
    if let Value::Map(hm) = headers {
        for (k, v) in hm.borrow().iter() {
            if k.to_lowercase() == "cache-control" {
                control = header_text(v).unwrap_or_default().to_lowercase();
            }
        }
    }
    let mut life = ttl;
    for part in control.split(',') {
        let directive = part.trim();
        if ["no-store", "private", "no-cache"].contains(&directive) {
            return 0;
        }
        if let Some(rest) = directive.strip_prefix("max-age") {
            if let Some(value) = rest.trim_start().strip_prefix('=') {
                let digits = value.trim().trim_matches('"');
                if !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()) {
                    if let Ok(secs) = digits.parse::<i64>() {
                        life = life.min(secs.saturating_mul(1000));
                    }
                }
            }
        }
    }
    life
}

fn url_scope(url: &str) -> String {
    let base = url.split(|c| c == '?' || c == '#').next().unwrap_or("");
    base.trim_end_matches('/').to_string()
}

fn url_parent(scope: &str) -> String {
    let root = match scope.find("://") {
        None => 0,
        Some(scheme) => match scope[scheme + 3..].find('/') {
            None => return scope.to_string(),
            Some(slash) => scheme + 3 + slash,
        },
    };
    let cut = scope.rfind('/').unwrap_or(0);
    scope[..cut.max(root)].to_string()
}

fn scope_under(scope: &str, prefix: &str) -> bool {
    scope == prefix || scope.starts_with(&format!("{}/", prefix))
}

// A body the transport could not read as JSON passes through, for the operation to report.
fn storable(res: &Value) -> bool {
    matches!(fres_status(res), Some(status) if (200..300).contains(&status))
        && !matches!(getp(res, "unreadable"), Value::Bool(true))
}

// A body that declares another type than JSON passes by, unread.
fn json(res: &Value) -> bool {
    let mut declared = String::new();
    if let Value::Map(hm) = getp(res, "headers") {
        for (k, v) in hm.borrow().iter() {
            if let (true, Value::Str(t)) = (k.eq_ignore_ascii_case("content-type"), v) {
                declared = t.clone();
            }
        }
    }
    declared.trim().is_empty() || is_json_media(&declared)
}

fn snapshot(res: &Value) -> CacheSnapshot {
    let headers = Value::empty_map();
    if let Value::Map(hm) = getp(res, "headers") {
        for (k, v) in hm.borrow().iter() {
            setp(&headers, &k.to_lowercase(), v.clone());
        }
    }

    CacheSnapshot {
        status: fres_status(res).unwrap_or(0),
        status_text: get_str(res, "statusText").unwrap_or_default(),
        data: call_json(&getp(res, "json")),
        headers,
    }
}

// replay builds a fresh transport-shaped response so the body stays
// re-readable for every consumer.
fn replay(snap: &CacheSnapshot) -> Value {
    let headers = Value::empty_map();
    if let Value::Map(hm) = &snap.headers {
        for (k, v) in hm.borrow().iter() {
            setp(&headers, k, v.clone());
        }
    }
    jo(vec![
        ("status", Value::Num(snap.status as f64)),
        ("statusText", Value::str(snap.status_text.clone())),
        ("body", Value::str("not-used")),
        ("json", json_thunk(snap.data.clone())),
        ("headers", headers),
    ])
}

// evict drops oldest entries (FIFO) until the store is under `max`.
fn evict(t: &mut CacheTrack, options: &Value) {
    let max = fopt_int(options, "max", 256) as usize;
    while t.store.len() >= max && !t.order.is_empty() {
        let oldest = t.order.remove(0);
        t.store.remove(&oldest);
    }
}
