import type {
  ModelEntity
} from '@voxgig/apidef'

import {
  cmp,
  each,
  File,
  Content,
  entityCollection,
  targetFeatures,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


import { rustMethodName } from './utility_rust'


// A custom action is not a trait method the sweep can call by name.
const CRUD = ['list', 'load', 'create', 'update', 'remove']

const DIAGNOSTIC = ['log', 'debug', 'audit', 'telemetry', 'cost', 'metrics', 'clienttrack']


// The canary sweep (twin of TestClean_ts). Rust is statically typed, so the
// operation candidates the ts sweep finds by reflection are enumerated here
// at generation time; the sweep still DRIVES them to find the first that
// completes with empty arguments.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$
  const { target, rustcrate } = props

  const Name = model.const.Name

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  const features = Object.keys(targetFeatures(model, target))
    .filter((name) => DIAGNOSTIC.includes(name))
    .sort()

  const candidates: { name: string, fn: string, method: string, op: string }[] = []
  const entities = each(entityCollection(model)).filter((e: any) => false !== e.active)
  each(entities, (entity: ModelEntity) => {
    const method = rustMethodName(entity.name)
    const ops = Object.keys((entity as any).op || {})
      .filter((op) => CRUD.includes(op))
      .sort((a, b) => CRUD.indexOf(a) - CRUD.indexOf(b))
    for (const op of ops) {
      candidates.push({ name: entity.name + '.' + op, fn: 'drive_' + method + '_' + op, method, op })
    }
  })

  File({ name: 'clean_test.' + target.ext }, () => {
    Content(render({ Name, rustcrate, auth, features, candidates }))
  })
})


function render(spec: {
  Name: string,
  rustcrate: string,
  auth: { suppressed: boolean, where: string, name: string, basic: boolean },
  features: string[],
  candidates: { name: string, fn: string, method: string, op: string }[],
}): string {
  const { Name, rustcrate, auth, features, candidates } = spec

  const drivers = candidates.map((c) => 'list' === c.op
    ? `fn ${c.fn}(sdk: &Rc<${Name}SDK>, ctrl: Value) -> Result<Value, ${Name}Error> {
    sdk.${c.method}(Value::Noval)
        .list(Value::empty_map(), ctrl)
        .map(|items| Value::list(items.iter().map(|e| e.data(None)).collect()))
}
`
    : `fn ${c.fn}(sdk: &Rc<${Name}SDK>, ctrl: Value) -> Result<Value, ${Name}Error> {
    sdk.${c.method}(Value::Noval)
        .${c.op}(Value::empty_map(), ctrl)
        .map(|e| e.data(None))
}
`).join('\n')

  const table = candidates.map((c) => `    ("${c.name}", ${c.fn}),`).join('\n')

  return `// Generated canary sweep (see TestClean_rust): no credential leaves the
// SDK in any form, and the sweep can see one when clean is switched off.

#![allow(dead_code, unused_imports)]

use std::cell::RefCell;
use std::rc::Rc;

use ${rustcrate}::core::helpers::{getp, jo, json_thunk, setp, vfn};
use ${rustcrate}::utility::voxgigstruct as vs;
use ${rustcrate}::{
    Context, Entity, Feature, FeatureRef, ${Name}Entity, ${Name}Error, ${Name}SDK, Value,
};

// Generated: the credential's wire placement is fixed when the SDK is built.
const AUTH_SUPPRESSED: bool = ${auth.suppressed};
const AUTH_WHERE: &str = "${ruststr(auth.where)}";
const AUTH_NAME: &str = "${ruststr(auth.name)}";
const AUTH_BASIC: bool = ${auth.basic};

// The diagnostic features this SDK ships.
const FEATURES: &[&str] = &[${features.map((f) => '"' + f + '"').join(', ')}];

const CANARY_APIKEY: &str = "CANARY-APIKEY-k9x2m7q4p1";
const CANARY_SECRET: &str = "CANARY-SECRET-w3e8r5t2y6";
const CANARY_HEADER: &str = "CANARY-HEADER-z1x4c7v0b3";
const CANARY_VALUE: &str = "CANARY-VALUE-n5m8b2v9c4";

const MASK: &str = "[redacted]";

// The sweep's own encoders: a leak of an encoded form must not hide behind
// the SDK's encoder.
fn b64(input: &str) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = *chunk.get(1).unwrap_or(&0) as usize;
        let b2 = *chunk.get(2).unwrap_or(&0) as usize;
        out.push(ALPHABET[b0 >> 2] as char);
        out.push(ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)] as char);
        out.push(if 1 < chunk.len() { ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] as char } else { '=' });
        out.push(if 2 < chunk.len() { ALPHABET[b2 & 0x3f] as char } else { '=' });
    }
    out
}

fn pct(input: &str) -> String {
    let mut out = String::new();
    for b in input.bytes() {
        let c = b as char;
        if c.is_ascii_alphanumeric() || "-_.!~*'()".contains(c) {
            out.push(c);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}

// Every form a canary can travel in.
fn forms() -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for v in [CANARY_APIKEY, CANARY_SECRET, CANARY_HEADER, CANARY_VALUE] {
        out.push(v.to_string());
        out.push(b64(v));
        out.push(pct(v));
    }
    out.push(b64(&format!("{}:{}", CANARY_APIKEY, CANARY_SECRET)));
    out
}

struct Sink {
    name: String,
    text: String,
}

type Sinks = Rc<RefCell<Vec<Sink>>>;

fn push(sinks: &Sinks, name: &str, text: String) {
    sinks.borrow_mut().push(Sink { name: name.to_string(), text });
}

fn push_value(sinks: &Sinks, name: &str, val: &Value) {
    push(sinks, &format!("{}:json", name), vs::jsonify(val, None));
    push(sinks, &format!("{}:debug", name), format!("{:?}", val));
    push(sinks, &format!("{}:string", name), vs::stringify(val, None, false));
}

fn push_error(sinks: &Sinks, name: &str, err: &${Name}Error) {
    push(sinks, &format!("{}:message", name), err.to_string());
    push(sinks, &format!("{}:debug", name), format!("{:?}", err));
    push(sinks, &format!("{}:json", name), err.to_json());
}

fn capture(sinks: &Sinks, name: &'static str) -> Value {
    let sinks = sinks.clone();
    vfn(move |rec| {
        push_value(&sinks, name, rec);
        Value::Noval
    })
}

// Captures the serialised context from inside the pipeline: what a hook
// author would hand to a logger.
struct CaptureFeature {
    sinks: Sinks,
}

impl CaptureFeature {
    fn grab(&self, name: &str, ctx: &Rc<Context>) {
        push(&self.sinks, &format!("{}:debug", name), format!("{:?}", ctx));
        push(&self.sinks, &format!("{}:display", name), format!("{}", ctx));
        push_value(&self.sinks, name, &ctx.to_value());
    }
}

impl Feature for CaptureFeature {
    fn name(&self) -> String {
        "capture".to_string()
    }
    fn active(&self) -> bool {
        true
    }
    fn pre_request(&mut self, ctx: &Rc<Context>) {
        self.grab("ctx@PreRequest", ctx);
    }
    fn pre_response(&mut self, ctx: &Rc<Context>) {
        self.grab("ctx@PreResponse", ctx);
    }
    fn pre_unexpected(&mut self, ctx: &Rc<Context>) {
        self.grab("ctx@PreUnexpected", ctx);
    }
}

fn response(status: i64, data: Value, headers: &[(&str, &str)]) -> Value {
    let h = jo(vec![("content-type", Value::str("application/json"))]);
    for (k, v) in headers {
        setp(&h, k, Value::str(*v));
    }
    jo(vec![
        ("status", Value::Num(status as f64)),
        ("statusText", Value::str(if status < 400 { "OK" } else { "ERR" })),
        ("headers", h),
        ("body", Value::str(vs::jsonify(&data, None))),
        ("json", json_thunk(data)),
    ])
}

#[derive(Clone, Copy, PartialEq)]
enum Scenario {
    Ok,
    NotFound,
    Server,
    Transport,
    NotJson,
}

const SCENARIOS: [Scenario; 5] = [
    Scenario::Ok,
    Scenario::NotFound,
    Scenario::Server,
    Scenario::Transport,
    Scenario::NotJson,
];

impl Scenario {
    fn name(&self) -> &'static str {
        match self {
            Scenario::Ok => "ok",
            Scenario::NotFound => "notfound",
            Scenario::Server => "server",
            Scenario::Transport => "transport",
            Scenario::NotJson => "notjson",
        }
    }

    fn respond(&self, url: &str) -> Value {
        match self {
            Scenario::Ok => response(
                200,
                jo(vec![("id", Value::str("i1")), ("name", Value::str("n1"))]),
                &[("x-session-token", "RESP-TOKEN-a1b2c3d4e5")],
            ),
            Scenario::NotFound => response(404, jo(vec![("error", Value::str("no such record"))]), &[]),
            Scenario::Server => response(500, jo(vec![("error", Value::str("boom"))]), &[]),
            Scenario::Transport => jo(vec![(
                "__err__",
                Value::str(format!("socket hang up (URL was: \\"{}\\")", url)),
            )]),
            Scenario::NotJson => jo(vec![
                ("status", Value::Num(200.0)),
                ("statusText", Value::str("OK")),
                ("headers", Value::empty_map()),
                ("body", Value::str("<html>")),
                ("json", json_thunk(Value::Noval)),
            ]),
        }
    }
}

// The transport seam: system.fetch is called with [url, fetchdef].
fn transport(scenario: Scenario) -> Value {
    Value::func(move |_inj, args, _r, _st| {
        let url = match vs::get_elem(args, &Value::Num(0.0), Value::Noval) {
            Value::Str(s) => s,
            _ => String::new(),
        };
        scenario.respond(&url)
    })
}

fn make_sdk(scenario: Scenario, sinks: &Sinks, cleanopts: Option<Value>) -> Rc<${Name}SDK> {
    let feature = Value::empty_map();
    for name in FEATURES {
        let fopts = jo(vec![("active", Value::Bool(true))]);
        match *name {
            "log" => setp(&fopts, "logger", capture(sinks, "log")),
            "debug" => setp(&fopts, "onEntry", capture(sinks, "debug")),
            "audit" => setp(&fopts, "sink", capture(sinks, "audit")),
            "telemetry" => setp(&fopts, "exporter", capture(sinks, "telemetry")),
            "cost" => setp(&fopts, "sink", capture(sinks, "cost")),
            _ => {}
        }
        setp(&feature, name, fopts);
    }

    let clean = jo(vec![("values", Value::str(CANARY_VALUE))]);
    if let Some(Value::Map(m)) = cleanopts {
        for (k, v) in m.borrow().iter() {
            setp(&clean, k, v.clone());
        }
    }

    let sdk = ${Name}SDK::new(jo(vec![
        ("apikey", Value::str(CANARY_APIKEY)),
        ("secret", Value::str(CANARY_SECRET)),
        ("headers", jo(vec![("X-Custom-Token", Value::str(CANARY_HEADER))])),
        ("clean", clean),
        ("feature", feature),
        ("system", jo(vec![("fetch", transport(scenario))])),
    ]));

    // Rust options are pure data, so the extension feature is added after
    // construction (the \`extend\` option of the ts client).
    let f: FeatureRef = Rc::new(RefCell::new(CaptureFeature { sinks: sinks.clone() }));
    sdk.features.borrow_mut().push(f);

    sdk
}

type Drive = fn(&Rc<${Name}SDK>, Value) -> Result<Value, ${Name}Error>;

${drivers}
// Generated: every CRUD operation of every active entity, list and load
// first (they need no body).
const CANDIDATES: &[(&str, Drive)] = &[
${table}
];

// The first operation that completes against a plain 200 with no arguments
// (a required path parameter would fail before the request is built).
fn usable_op() -> Option<(&'static str, Drive)> {
    let plain = ${Name}SDK::new(jo(vec![
        ("apikey", Value::str(CANARY_APIKEY)),
        ("system", jo(vec![("fetch", transport(Scenario::Ok))])),
    ]));
    for (name, drive) in CANDIDATES {
        if drive(&plain, Value::Noval).is_ok() {
            return Some((name, *drive));
        }
    }
    None
}

fn drive(sdk: &Rc<${Name}SDK>, op: Drive, ctrl: Value, sinks: &Sinks) -> Option<${Name}Error> {
    match op(sdk, ctrl) {
        Ok(out) => {
            push_value(sinks, "result", &out);
            None
        }
        Err(err) => {
            push_error(sinks, "error", &err);
            Some(err)
        }
    }
}

// Header maps keep the caller's spelling; the assertion should not care.
fn header(map: &Value, name: &str) -> Option<String> {
    if let Value::Map(m) = map {
        for (k, v) in m.borrow().iter() {
            if k.to_lowercase() == name.to_lowercase() {
                return match v {
                    Value::Str(s) => Some(s.clone()),
                    other => Some(vs::stringify(other, None, false)),
                };
            }
        }
    }
    None
}

fn leaks(text: &str) -> Vec<String> {
    forms().into_iter().filter(|f| text.contains(f.as_str())).collect()
}

#[test]
fn clean_no_credential_leaves_the_sdk_in_any_form() {
    let (_opname, op) = usable_op()
        .expect("no operation completes without arguments; nothing to sweep");

    let sinks: Sinks = Rc::new(RefCell::new(Vec::new()));
    let mut errors: Vec<(String, ${Name}Error)> = Vec::new();
    let mut explains: Vec<(String, Value)> = Vec::new();

    for scenario in SCENARIOS {
        for variant in ["throw", "explain", "nothrow"] {
            let sdk = make_sdk(scenario, &sinks, None);
            let explain = Value::empty_map();
            let ctrl = match variant {
                "explain" => jo(vec![("explain", explain.clone())]),
                "nothrow" => jo(vec![("throw", Value::Bool(false)), ("explain", explain.clone())]),
                _ => Value::Noval,
            };
            let key = format!("{}/{}", scenario.name(), variant);
            if let Some(err) = drive(&sdk, op, ctrl, &sinks) {
                errors.push((key.clone(), err));
            }
            if "throw" != variant {
                push_value(&sinks, "explain", &explain);
                explains.push((key, explain));
            }
            push(&sinks, "sdk:debug", format!("{:?}", sdk));
            push(&sinks, "sdk:display", format!("{}", sdk));
        }
    }

    let leaked: Vec<String> = sinks
        .borrow()
        .iter()
        .filter_map(|s| {
            let found = leaks(&s.text);
            if found.is_empty() {
                None
            } else {
                Some(format!("{} [{}]", s.name, found.join(", ")))
            }
        })
        .collect();

    println!(
        "clean: swept {} surface(s), {} leak(s)",
        sinks.borrow().len(),
        leaked.len()
    );

    assert!(leaked.is_empty(), "credential leaked through: {}", leaked.join("; "));

    // The positive half: the slot the credential travelled in is masked,
    // and an unregistered token in a response header is masked by name.
    let notfound = errors
        .iter()
        .find(|(k, _)| k == "notfound/throw")
        .map(|(_, e)| e.clone())
        .expect("the 404 scenario must throw");
    assert_eq!(notfound.status, 404);

    let headers = getp(&notfound.spec, "headers");
    if !AUTH_SUPPRESSED {
        if "query" == AUTH_WHERE {
            assert_eq!(header(&getp(&notfound.spec, "query"), AUTH_NAME), Some(MASK.to_string()));
        } else if "cookie" == AUTH_WHERE {
            let cookie = header(&headers, "cookie").unwrap_or_default();
            assert!(cookie.contains(MASK), "cookie: {}", cookie);
        } else {
            let cred = header(&headers, AUTH_NAME).unwrap_or_default();
            assert!(cred.ends_with(MASK), "{}: {}", AUTH_NAME, cred);
        }
    }
    assert_eq!(header(&headers, "x-custom-token"), Some(MASK.to_string()));

    let explained = explains
        .iter()
        .find(|(k, _)| k == "ok/explain")
        .map(|(_, e)| e.clone())
        .unwrap_or(Value::Noval);
    let result = getp(&explained, "result");
    assert!(matches!(result, Value::Map(_)), "the explain record should carry the result");
    assert_eq!(header(&getp(&result, "headers"), "x-session-token"), Some(MASK.to_string()));
}

#[test]
fn clean_the_sweep_can_see_a_leak() {
    let (_opname, op) = usable_op()
        .expect("no operation completes without arguments; nothing to sweep");

    let sinks: Sinks = Rc::new(RefCell::new(Vec::new()));
    let sdk = make_sdk(
        Scenario::NotFound,
        &sinks,
        Some(jo(vec![("active", Value::Bool(false))])),
    );
    let err = drive(&sdk, op, Value::Noval, &sinks).expect("the 404 scenario must throw");

    let leaked = sinks.borrow().iter().filter(|s| !leaks(&s.text).is_empty()).count();
    assert!(0 < leaked, "with clean off, nothing showed the canary: the sweep is blind");

    if !AUTH_SUPPRESSED {
        let text = vs::jsonify(&err.spec, None);
        assert!(
            text.contains(CANARY_APIKEY)
                || text.contains(&b64(&format!("{}:{}", CANARY_APIKEY, CANARY_SECRET))),
            "the raw spec should carry the credential when clean is off"
        );
    }
    let _ = AUTH_BASIC;
}
`
}


function ruststr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}


export {
  TestClean
}
