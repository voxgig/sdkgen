
mod common;
mod omni_resolver;

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::rc::Rc;

use common::*;
use omni_resolver::{entrycount, jpath, tostruct, Json, Run};

use RUSTCRATE::core::helpers::{get_str, getp, ja, jo, setp, to_map, vfn};
use RUSTCRATE::utility::voxgigstruct as vs;
use RUSTCRATE::{
    bytes_value, new as new_sdk, test_sdk, BaseFeature, BinarySource, Context, CtxSpec, Feature,
    FeatureRef, Operation, ProjectNameError, ProjectNameSDK, SdkResult, Sources, Spec, Utility,
    Value,
};

const PENDING_SECTIONS: &[&str] = &[
    "fetcher", "makeFetchDef", "makeResult", "featureAdd",
    "featureHook", "featureInit",
];

fn primary_run() -> Run {
    let run = Run::section("primary");
    assert!(
        run.spec.ismap(),
        "primary section not found in test.json"
    );
    run
}

fn runsection<F>(run: &mut Run, name: &str, subject: F)
where
    F: FnMut(&mut Vec<Value>) -> Result<Value, ProjectNameError> + 'static,
{
    let basic = run.set(&[name, "basic"]);
    assert!(
        basic.ismap(),
        "test corpus section {:?} missing — check the name against .sdk/test/primary/",
        name
    );
    assert!(
        basic.get("set").islist(),
        "test corpus section {:?} has no basic.set list — zero cases would run",
        name
    );
    assert!(
        0 < entrycount(&basic) || PENDING_SECTIONS.contains(&name),
        "test corpus section {:?} is EMPTY — zero cases would run; add cases, \
         or mark the fixture PENDING in .sdk/test/primary/",
        name
    );

    let before = run.failures.len();
    run.run_set_args(&basic, true, name, subject);
    if before < run.failures.len() {
        panic!("{}", run.failures[before..].join("\n"));
    }
}

fn base_client() -> (Rc<ProjectNameSDK>, Rc<Utility>) {
    let client = test_sdk(Value::Noval, Value::Noval);
    let utility = client.get_utility();
    (client, utility)
}

// Helper: create basic test context.
fn make_test_ctx(client: &Rc<ProjectNameSDK>, utility: &Rc<Utility>) -> Rc<Context> {
    utility.make_context(
        CtxSpec {
            opname: Some("load".to_string()),
            client: Some(client.clone()),
            utility: Some(utility.clone()),
            ..Default::default()
        },
        Some(&client.get_root_ctx()),
    )
}

// Helper: create full test context with point and match.
fn make_test_full_ctx(client: &Rc<ProjectNameSDK>, utility: &Rc<Utility>) -> Rc<Context> {
    let ctx = make_test_ctx(client, utility);
    *ctx.point.borrow_mut() = jo(vec![
        ("parts", ja(vec![Value::str("items"), Value::str("{id}")])),
        (
            "args",
            jo(vec![(
                "params",
                ja(vec![jo(vec![
                    ("name", Value::str("id")),
                    ("reqd", Value::Bool(true)),
                ])]),
            )]),
        ),
        ("params", ja(vec![Value::str("id")])),
        ("alias", Value::empty_map()),
        ("select", Value::empty_map()),
        ("active", Value::Bool(true)),
        ("transform", Value::empty_map()),
    ]);
    *ctx.mtch.borrow_mut() = jo(vec![("id", Value::str("item01"))]);
    *ctx.reqmatch.borrow_mut() = jo(vec![("id", Value::str("item01"))]);
    ctx
}

#[test]
fn primary_utility_exists() {
    // The rust utility methods are statically bound; a live smoke test
    // stands in for go's nil-checks.
    let (client, utility) = base_client();
    let ctx = make_test_ctx(&client, &utility);
    assert_eq!(utility.prepare_method(&ctx), "GET");
    assert!(matches!(utility.prepare_headers(&ctx), Value::Map(_)));
    assert!(matches!(utility.prepare_query(&ctx), Value::Map(_)));
    assert!(matches!(utility.prepare_params(&ctx), Value::Map(_)));
    assert!(matches!(utility.make_options(&ctx), Ok(Value::Map(_))));
    let _ = utility.clean(&ctx, &Value::str("x"));
}

#[test]
fn primary_clean_basic() {
    let (client, utility) = base_client();
    let ctx = make_test_ctx(&client, &utility);
    let val = jo(vec![
        ("key", Value::str("secret123")),
        ("name", Value::str("test")),
    ]);
    let cleaned = utility.clean(&ctx, &val);
    assert!(!cleaned.is_noval(), "cleaned should not be nil");
}

#[test]
fn primary_done_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "done", move |args| {
        let ctx = make_ctx_from_map(&args[0], &client, &utility);
        fixctx(&ctx, &client);
        utility.done(&ctx)
    });
}

#[test]
fn primary_make_error_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "makeError", move |args| {
        let arglist = Value::list(args.clone());
        let ctxmap = vs::get_elem(&arglist, &Value::Num(0.0), Value::empty_map());
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);
        fixctx(&ctx, &client);

        let err = match vs::get_elem(&arglist, &Value::Num(1.0), Value::Noval) {
            Value::Map(m) => err_from_map(&Value::Map(m)),
            _ => None,
        };

        utility.make_error(&ctx, err)
    });
}

#[test]
fn primary_make_error_no_throw() {
    let (client, utility) = base_client();
    let ctx = make_test_full_ctx(&client, &utility);
    {
        let ctrl = ctx.ctrl.borrow().clone();
        ctrl.borrow_mut().throw = Some(false);
    }
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(&jo(vec![
        ("ok", Value::Bool(false)),
        ("resdata", jo(vec![("id", Value::str("safe01"))])),
    ])))));

    let out = utility
        .make_error(&ctx, Some(ctx.make_error("test_code", "test message")))
        .expect("expected no error");
    assert_eq!(getp(&out, "id"), Value::str("safe01"));
}

#[test]
fn primary_feature_add_basic() {
    let (client, utility) = base_client();
    let ctx = make_test_ctx(&client, &utility);
    let start_len = client.features.borrow().len();

    let feature: FeatureRef = Rc::new(RefCell::new(BaseFeature::new()));
    utility.feature_add(&ctx, feature);

    assert_eq!(client.features.borrow().len(), start_len + 1);
}

// Helper: test hook feature for the featureHook test (custom hook name).
struct TestHookFeature {
    base: BaseFeature,
    called: Rc<RefCell<bool>>,
}

impl Feature for TestHookFeature {
    fn name(&self) -> String {
        self.base.name.clone()
    }
    fn active(&self) -> bool {
        self.base.active
    }
    fn custom_hook(&mut self, name: &str, _ctx: &Rc<Context>) {
        if name == "TestHook" {
            *self.called.borrow_mut() = true;
        }
    }
}

#[test]
fn primary_feature_hook_basic() {
    let client = test_sdk(Value::Noval, Value::Noval);
    let utility = client.get_utility();
    let ctx = make_test_ctx(&client, &utility);

    let called = Rc::new(RefCell::new(false));
    let hook_feature: FeatureRef = Rc::new(RefCell::new(TestHookFeature {
        base: BaseFeature::new(),
        called: called.clone(),
    }));
    *client.features.borrow_mut() = vec![hook_feature];

    utility.feature_hook(&ctx, "TestHook");
    assert!(*called.borrow(), "expected TestHook to be called");
}

// Helper: test init feature for the featureInit tests.
struct TestInitFeature {
    name: String,
    active: bool,
    init_called: Rc<RefCell<bool>>,
}

impl Feature for TestInitFeature {
    fn name(&self) -> String {
        self.name.clone()
    }
    fn active(&self) -> bool {
        self.active
    }
    fn init(&mut self, _ctx: &Rc<Context>, _options: &Value) {
        *self.init_called.borrow_mut() = true;
    }
}

#[test]
fn primary_feature_init_basic() {
    let client = test_sdk(Value::Noval, Value::Noval);
    let utility = client.get_utility();
    let ctx = make_test_ctx(&client, &utility);
    setp(
        &ctx.options.borrow(),
        "feature",
        jo(vec![(
            "initfeat",
            jo(vec![("active", Value::Bool(true))]),
        )]),
    );

    let init_called = Rc::new(RefCell::new(false));
    let feature: FeatureRef = Rc::new(RefCell::new(TestInitFeature {
        name: "initfeat".to_string(),
        active: true,
        init_called: init_called.clone(),
    }));

    utility.feature_init(&ctx, &feature);
    assert!(*init_called.borrow(), "expected init to be called");
}

#[test]
fn primary_feature_init_inactive() {
    let client = test_sdk(Value::Noval, Value::Noval);
    let utility = client.get_utility();
    let ctx = make_test_ctx(&client, &utility);
    setp(
        &ctx.options.borrow(),
        "feature",
        jo(vec![(
            "nofeat",
            jo(vec![("active", Value::Bool(false))]),
        )]),
    );

    let init_called = Rc::new(RefCell::new(false));
    let feature: FeatureRef = Rc::new(RefCell::new(TestInitFeature {
        name: "nofeat".to_string(),
        active: false,
        init_called: init_called.clone(),
    }));

    utility.feature_init(&ctx, &feature);
    assert!(
        !*init_called.borrow(),
        "expected init NOT to be called for inactive feature"
    );
}

#[test]
fn primary_fetcher_live() {
    let calls: Rc<RefCell<Vec<Value>>> = Rc::new(RefCell::new(Vec::new()));
    let c = calls.clone();
    let live_client = ProjectNameSDK::new(jo(vec![("base", Value::str("http://localhost:8080")), (
        "system",
        jo(vec![(
            "fetch",
            vfn(move |args| {
                c.borrow_mut().push(args.clone());
                jo(vec![
                    ("status", Value::Num(200.0)),
                    ("statusText", Value::str("OK")),
                ])
            }),
        )]),
    )])).unwrap();
    let live_utility = live_client.get_utility();
    let ctx = live_utility.make_context(
        CtxSpec {
            opname: Some("load".to_string()),
            client: Some(live_client.clone()),
            utility: Some(live_utility.clone()),
            ..Default::default()
        },
        None,
    );

    let fetchdef = jo(vec![
        ("method", Value::str("GET")),
        ("headers", Value::empty_map()),
    ]);
    live_utility
        .fetch(&ctx, "http://example.com/test", &fetchdef)
        .expect("expected no error");
    assert_eq!(calls.borrow().len(), 1, "expected 1 call");
    let url = vs::get_elem(&calls.borrow()[0], &Value::Num(0.0), Value::Noval);
    assert_eq!(url, Value::str("http://example.com/test"));
}

#[test]
fn primary_fetcher_blocked_test_mode() {
    // A live SDK then set mode to test (not using test_sdk, which installs
    // the test feature's mock transport).
    let blocked_client = ProjectNameSDK::new(jo(vec![
        ("base", Value::str("http://localhost:8080")),
        ("system", jo(vec![("fetch", vfn(|_args| Value::empty_map()))])),
    ])).unwrap();
    *blocked_client.mode.borrow_mut() = "test".to_string();

    let blocked_utility = blocked_client.get_utility();
    let ctx = blocked_utility.make_context(
        CtxSpec {
            opname: Some("load".to_string()),
            client: Some(blocked_client.clone()),
            utility: Some(blocked_utility.clone()),
            ..Default::default()
        },
        None,
    );

    let fetchdef = jo(vec![
        ("method", Value::str("GET")),
        ("headers", Value::empty_map()),
    ]);
    let err = blocked_utility
        .fetch(&ctx, "http://example.com/test", &fetchdef)
        .err()
        .expect("expected error for test mode fetch");
    assert!(
        err.msg.to_lowercase().contains("blocked"),
        "expected error containing 'blocked', got {}",
        err.msg
    );
}

// A Django route answers its slashless form with a relative Location. The
// transport follows each hop, and answers a "manual" fetch with the 3xx.
#[test]
fn primary_fetcher_redirect() {
    use std::io::{BufRead, BufReader, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let seen = std::sync::Arc::new(std::sync::Mutex::new(Vec::<String>::new()));
    let log = seen.clone();
    std::thread::spawn(move || {
        for stream in listener.incoming().take(4) {
            let mut stream = stream.unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut line = String::new();
            reader.read_line(&mut line).unwrap();
            let path = line.split(' ').nth(1).unwrap_or("").to_string();
            let mut header = String::from("-");
            while !header.trim().is_empty() {
                header.clear();
                if 0 == reader.read_line(&mut header).unwrap_or(0) {
                    break;
                }
            }
            let (status, location) = match path.as_str() {
                "/redirect/r1" => (301, "Location: /redirect/r1/\r\n"),
                "/redirect/r1/" => (308, "Location: done\r\n"),
                "/redirect/r1/done" => (200, ""),
                _ => (404, ""),
            };
            let body = if 200 == status { "{\"id\":\"r1\"}" } else { "" };
            log.lock().unwrap().push(path);
            let _ = write!(stream, "HTTP/1.1 {} X\r\n{}Content-Type: application/json\r\n\
                Content-Length: {}\r\nConnection: close\r\n\r\n{}", status, location, body.len(), body);
        }
    });

    let live_client = ProjectNameSDK::new(jo(vec![("base", Value::str(&base))])).unwrap();
    let live_utility = live_client.get_utility();
    let ctx = live_utility.make_context(
        CtxSpec {
            opname: Some("load".to_string()),
            client: Some(live_client.clone()),
            utility: Some(live_utility.clone()),
            ..Default::default()
        },
        None,
    );
    let url = format!("{}/redirect/r1", base);
    let res = live_utility
        .fetch(&ctx, &url, &jo(vec![("method", Value::str("GET")), ("headers", Value::empty_map())]))
        .expect("expected the redirect followed");
    assert!(matches!(getp(&res, "status"), Value::Num(n) if 200.0 == n), "{:?}", getp(&res, "status"));
    assert_eq!(get_str(&res, "body").as_deref(), Some("{\"id\":\"r1\"}"));
    assert_eq!(*seen.lock().unwrap(), vec!["/redirect/r1", "/redirect/r1/", "/redirect/r1/done"]);

    let manual = live_utility
        .fetch(&ctx, &url, &jo(vec![
            ("method", Value::str("GET")),
            ("headers", Value::empty_map()),
            ("redirect", Value::str("manual")),
        ]))
        .expect("expected the 301");
    assert!(matches!(getp(&manual, "status"), Value::Num(n) if 301.0 == n), "{:?}", getp(&manual, "status"));
}

const REDIRECT_SECRET: &str = "REDIRECT-SECRET-q7w3e9r1";
const REDIRECT_CREDENTIALS: [&str; 5] =
    ["authorization", "cookie", "x-api-key", "private-token", "x-acme-auth"];

// The GET-only guard is read from the environment, which every test thread
// shares: held by the test that sets it and by one sending another method.
static GETONLY_ENV: std::sync::Mutex<()> = std::sync::Mutex::new(());

struct Arrived {
    origin: &'static str,
    method: String,
    path: String,
    headers: BTreeMap<String, String>,
    body: String,
}

type Arrivals = std::sync::Arc<std::sync::Mutex<Vec<Arrived>>>;

// One origin: it records each request, and answers the paths named here with
// a redirect, to the other origin (/out...) or to itself.
fn redirect_origin(
    origin: &'static str,
    listener: std::net::TcpListener,
    other: String,
    log: Arrivals,
) {
    use std::io::{BufRead, BufReader, Read, Write};
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let mut stream = match stream {
                Ok(stream) => stream,
                Err(_) => continue,
            };
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut line = String::new();
            reader.read_line(&mut line).unwrap_or(0);
            let mut words = line.split(' ');
            let method = words.next().unwrap_or("").trim().to_string();
            let path = words.next().unwrap_or("").to_string();
            if method.is_empty() {
                continue;
            }
            let mut headers = BTreeMap::new();
            loop {
                let mut header = String::new();
                if 0 == reader.read_line(&mut header).unwrap_or(0) || header.trim().is_empty() {
                    break;
                }
                if let Some((name, value)) = header.split_once(':') {
                    headers.insert(name.trim().to_lowercase(), value.trim().to_string());
                }
            }
            let size = headers
                .get("content-length")
                .and_then(|n| n.parse::<usize>().ok())
                .unwrap_or(0);
            let mut body = vec![0u8; size];
            let _ = reader.read_exact(&mut body);
            let (status, location) = match path.as_str() {
                "/out" => (302, format!("Location: {}/landed\r\n", other)),
                "/out307" => (307, format!("Location: {}/landed\r\n", other)),
                "/in" => (302, "Location: /landed\r\n".to_string()),
                "/in303" => (303, "Location: /landed\r\n".to_string()),
                "/in307" => (307, "Location: /landed\r\n".to_string()),
                "/round" => (302, "Location: /round\r\n".to_string()),
                _ => (200, String::new()),
            };
            let answer = if 200 == status { "{\"id\":\"r1\"}" } else { "" };
            log.lock().unwrap().push(Arrived {
                origin,
                method,
                path,
                headers,
                body: String::from_utf8_lossy(&body).to_string(),
            });
            let _ = write!(stream, "HTTP/1.1 {} X\r\n{}Content-Type: application/json\r\n\
                Content-Length: {}\r\nConnection: close\r\n\r\n{}", status, location, answer.len(), answer);
        }
    });
}

// The API's origin and another: a second port on its host is another origin.
fn redirect_origins() -> (String, Arrivals) {
    let api = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let other = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let apibase = format!("http://{}", api.local_addr().unwrap());
    let otherbase = format!("http://{}", other.local_addr().unwrap());
    let log = Arrivals::default();
    redirect_origin("api", api, otherbase, log.clone());
    redirect_origin("other", other, apibase.clone(), log.clone());
    (apibase, log)
}

// A live client holding the secret as its apikey, as a caller's would, sends
// it under each name a credential travels by.
fn redirect_fetch(
    base: &str,
    clean: bool,
    method: &str,
    path: &str,
    body: Option<&str>,
) -> Result<Value, ProjectNameError> {
    let client = ProjectNameSDK::new(jo(vec![
        ("base", Value::str(base)),
        ("apikey", Value::str(REDIRECT_SECRET)),
        ("clean", jo(vec![("active", Value::Bool(clean))])),
    ])).unwrap();
    let utility = client.get_utility();
    let ctx = utility.make_context(
        CtxSpec {
            opname: Some("load".to_string()),
            client: Some(client.clone()),
            utility: Some(utility.clone()),
            ..Default::default()
        },
        Some(&client.get_root_ctx()),
    );
    let headers = jo(vec![
        ("authorization", Value::str(format!("Bearer {}", REDIRECT_SECRET))),
        ("cookie", Value::str(format!("sid={}", REDIRECT_SECRET))),
        ("x-api-key", Value::str(REDIRECT_SECRET)),
        ("private-token", Value::str("pt-12345")),
        // Not a sensitive name: a credential by the value it holds.
        ("x-acme-auth", Value::str(format!("v1 {}", REDIRECT_SECRET))),
        ("x-tenant", Value::str("acme")),
    ]);
    let mut fetchdef = vec![("method", Value::str(method))];
    if let Some(body) = body {
        setp(&headers, "content-type", Value::str("application/json"));
        fetchdef.push(("body", Value::str(body)));
    }
    fetchdef.push(("headers", headers));
    utility.fetch(&ctx, &format!("{}{}", base, path), &jo(fetchdef))
}

fn redirect_status(res: &Result<Value, ProjectNameError>) -> i64 {
    match res {
        Ok(res) => match getp(res, "status") {
            Value::Num(n) => n as i64,
            _ => -1,
        },
        Err(err) => panic!("expected a response, got {}: {}", err.code, err.msg),
    }
}

fn redirect_trail(arrived: &[Arrived]) -> Vec<String> {
    arrived
        .iter()
        .map(|a| format!("{} {} {}", a.origin, a.method, a.path))
        .collect()
}

// Another origin is sent no credential, under any name, with clean active or
// not; the API's own origin was sent each one.
#[test]
fn primary_fetcher_redirect_other_origin() {
    for clean in [true, false] {
        let (base, log) = redirect_origins();
        let res = redirect_fetch(&base, clean, "GET", "/out", None);
        assert_eq!(redirect_status(&res), 200);
        let arrived = log.lock().unwrap();
        assert_eq!(redirect_trail(&arrived), vec!["api GET /out", "other GET /landed"]);
        let unsent: Vec<&str> = REDIRECT_CREDENTIALS
            .into_iter()
            .filter(|name| !arrived[0].headers.contains_key(*name))
            .collect();
        assert!(unsent.is_empty(), "the API itself was not sent {:?}", unsent);
        let leaked: Vec<&str> = REDIRECT_CREDENTIALS
            .into_iter()
            .filter(|name| arrived[1].headers.contains_key(*name))
            .collect();
        assert!(leaked.is_empty(), "another origin was sent {:?} (clean active: {})", leaked, clean);
        assert_eq!(arrived[1].headers.get("x-tenant").map(String::as_str), Some("acme"));
        assert!(!arrived[1].headers.values().any(|v| v.contains(REDIRECT_SECRET)));
    }
}

#[test]
fn primary_fetcher_redirect_same_origin() {
    let (base, log) = redirect_origins();
    let res = redirect_fetch(&base, true, "GET", "/in", None);
    assert_eq!(redirect_status(&res), 200);
    let arrived = log.lock().unwrap();
    assert_eq!(redirect_trail(&arrived), vec!["api GET /in", "api GET /landed"]);
    let lost: Vec<&str> = REDIRECT_CREDENTIALS
        .into_iter()
        .chain(["x-tenant"])
        .filter(|name| !arrived[1].headers.contains_key(*name))
        .collect();
    assert!(lost.is_empty(), "the same origin lost {:?}", lost);
}

// A body is never sent on. A 307 answering a PUT is the answer, on either
// origin; what becomes a GET carries neither the body nor its type.
#[test]
fn primary_fetcher_redirect_body() {
    let _env = GETONLY_ENV.lock().unwrap_or_else(|held| held.into_inner());
    for path in ["/out307", "/in307"] {
        let (base, log) = redirect_origins();
        let body = format!("BODY-{}", REDIRECT_SECRET);
        let res = redirect_fetch(&base, true, "PUT", path, Some(&body));
        assert_eq!(redirect_status(&res), 307);
        assert_eq!(redirect_trail(&log.lock().unwrap()), vec![format!("api PUT {}", path)]);
    }
    for (method, path) in [("PUT", "/in303"), ("POST", "/in")] {
        let (base, log) = redirect_origins();
        let res = redirect_fetch(&base, true, method, path, Some("{\"a\":1}"));
        assert_eq!(redirect_status(&res), 200);
        let arrived = log.lock().unwrap();
        assert_eq!(
            redirect_trail(&arrived),
            vec![format!("api {} {}", method, path), "api GET /landed".to_string()]
        );
        assert_eq!(arrived[0].body, "{\"a\":1}");
        assert_eq!(arrived[1].body, "");
        assert_eq!(arrived[1].headers.get("content-type"), None, "{} {}", method, path);
        assert!(arrived[1].headers.contains_key("x-api-key"), "{} {}", method, path);
    }
    let (base, log) = redirect_origins();
    let res = redirect_fetch(&base, true, "POST", "/out", Some("{\"a\":1}"));
    assert_eq!(redirect_status(&res), 200);
    let arrived = log.lock().unwrap();
    assert_eq!(redirect_trail(&arrived), vec!["api POST /out", "other GET /landed"]);
    assert_eq!(arrived[1].body, "");
    assert_eq!(arrived[1].headers.get("content-type"), None);
    assert!(!arrived[1].headers.values().any(|v| v.contains(REDIRECT_SECRET)));
}

#[test]
fn primary_fetcher_redirect_limit() {
    let (base, log) = redirect_origins();
    let res = redirect_fetch(&base, true, "GET", "/round", None);
    assert_eq!(redirect_status(&res), 302);
    assert_eq!(log.lock().unwrap().len(), 6);
}

// What a redirect asks of the registry: a secret by its name, or by a
// registered value held in a form the registry stores, clean active or not.
#[test]
fn primary_clean_secret() {
    let encoded = RUSTCRATE::utility::clean::base64_encode(REDIRECT_SECRET.as_bytes());
    for clean in [true, false] {
        let client = ProjectNameSDK::new(jo(vec![
            ("base", Value::str("http://localhost:8080")),
            ("apikey", Value::str(REDIRECT_SECRET)),
            ("clean", jo(vec![("active", Value::Bool(clean))])),
        ])).unwrap();
        let utility = client.get_utility();
        let ctx = client.get_root_ctx();
        assert!(utility.clean_secret(&ctx, "X-Api-Key", "anything"));
        assert!(utility.clean_secret(&ctx, "x-acme-auth", &format!("v1 {}", REDIRECT_SECRET)));
        assert!(utility.clean_secret(&ctx, "x-acme-auth", &format!("Basic {}", encoded)));
        assert!(!utility.clean_secret(&ctx, "x-tenant", "acme"));
    }
}

// Nothing listens on port 9: a request the guard let through fails there.
#[test]
fn primary_fetcher_getonly_guard() {
    let _env = GETONLY_ENV.lock().unwrap_or_else(|held| held.into_inner());
    let live_client = ProjectNameSDK::new(jo(vec![("base", Value::str("http://127.0.0.1:9"))])).unwrap();
    let live_utility = live_client.get_utility();
    let ctx = live_utility.make_context(
        CtxSpec {
            opname: Some("create".to_string()),
            client: Some(live_client.clone()),
            utility: Some(live_utility.clone()),
            ..Default::default()
        },
        None,
    );
    let url = "http://127.0.0.1:9/planet/p1?apikey=GUARDKEY01";
    let def = |method: &str| jo(vec![("method", Value::str(method)), ("headers", Value::empty_map())]);

    let prior = std::env::var("VOXGIG_GETONLY_GUARD").ok();
    std::env::set_var("VOXGIG_GETONLY_GUARD", "TRUE");
    let refused = live_utility.fetch(&ctx, url, &def("POST")).err();
    let sent = live_utility.fetch(&ctx, url, &def("GET")).err();
    match prior {
        Some(v) => std::env::set_var("VOXGIG_GETONLY_GUARD", v),
        None => std::env::remove_var("VOXGIG_GETONLY_GUARD"),
    }

    let refused = refused.expect("expected the POST to be refused");
    assert_eq!(refused.code, "fetch_getonly_block");
    assert!(refused.msg.contains("[GET-ONLY GUARD] blocked POST /planet/p1"), "{}", refused.msg);
    assert!(!refused.msg.contains("GUARDKEY01"), "{}", refused.msg);
    let sent = sent.expect("expected the GET to reach the closed port");
    assert_ne!(sent.code, "fetch_getonly_block", "{}", sent.msg);
}

#[test]
fn primary_make_context_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "makeContext", move |args| {
        let vin = args[0].clone();
        if let Value::Map(_) = vin {
            let ctx = make_ctx_from_map(&vin, &client, &utility);
            let out = jo(vec![("id", Value::str(ctx.id.clone()))]);
            let op = ctx.op.borrow().clone();
            setp(
                &out,
                "op",
                jo(vec![
                    ("name", Value::str(op.name.clone())),
                    ("input", Value::str(op.input.clone())),
                ]),
            );
            return Ok(out);
        }
        Ok(Value::Noval)
    });
}

#[test]
fn primary_make_fetch_def_basic() {
    let (client, utility) = base_client();
    let ctx = make_test_full_ctx(&client, &utility);
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![
        ("base", Value::str("http://localhost:8080")),
        ("prefix", Value::str("/api")),
        ("path", Value::str("items/{id}")),
        ("suffix", Value::str("")),
        ("params", jo(vec![("id", Value::str("item01"))])),
        ("query", Value::empty_map()),
        (
            "headers",
            jo(vec![("content-type", Value::str("application/json"))]),
        ),
        ("method", Value::str("GET")),
        ("step", Value::str("start")),
    ])))));
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(
        &Value::empty_map(),
    ))));

    let fetchdef = utility.make_fetch_def(&ctx).expect("should not error");
    assert_eq!(getp(&fetchdef, "method"), Value::str("GET"));
    let url = get_str(&fetchdef, "url").unwrap_or_default();
    assert!(
        url.contains("/api/items/item01"),
        "expected url to contain /api/items/item01, got {}",
        url
    );
    assert_eq!(
        getp(&getp(&fetchdef, "headers"), "content-type"),
        Value::str("application/json")
    );
    assert!(getp(&fetchdef, "body").is_noval(), "expected no body");
}

#[test]
fn primary_make_fetch_def_with_body() {
    let (client, utility) = base_client();
    let ctx = make_test_full_ctx(&client, &utility);
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![
        ("base", Value::str("http://localhost:8080")),
        ("prefix", Value::str("")),
        ("path", Value::str("items")),
        ("suffix", Value::str("")),
        ("params", Value::empty_map()),
        ("query", Value::empty_map()),
        ("headers", Value::empty_map()),
        ("method", Value::str("POST")),
        ("step", Value::str("start")),
        ("body", jo(vec![("name", Value::str("test"))])),
    ])))));
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(
        &Value::empty_map(),
    ))));

    let fetchdef = utility.make_fetch_def(&ctx).expect("should not error");
    assert_eq!(getp(&fetchdef, "method"), Value::str("POST"));
    let body = get_str(&fetchdef, "body").expect("expected body string");
    assert!(
        body.contains("\"name\""),
        "expected body to contain name, got {}",
        body
    );
}

#[test]
fn primary_make_options_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "makeOptions", move |args| {
        let vin = args[0].clone();
        let ctx = utility.make_context(
            CtxSpec {
                options: match getp(&vin, "options") {
                    Value::Map(m) => Some(Value::Map(m)),
                    _ => None,
                },
                config: match getp(&vin, "config") {
                    Value::Map(m) => Some(Value::Map(m)),
                    _ => None,
                },
                ..Default::default()
            },
            None,
        );
        *ctx.client.borrow_mut() = Some(client.clone());
        *ctx.utility.borrow_mut() = Some(utility.clone());
        utility.make_options(&ctx)
    });
}

#[test]
fn primary_make_request_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "makeRequest", move |args| {
        let ctxmap = args[0].clone();
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);
        *ctx.options.borrow_mut() = client.options_map();

        utility.make_request(&ctx)?;

        // Write the observable ctx state back into args[0] for the match.
        if let Value::Map(_) = &ctxmap {
            if ctx.response.borrow().is_some() {
                setp(&ctxmap, "response", Value::str("exists"));
            }
            if ctx.result.borrow().is_some() {
                setp(&ctxmap, "result", Value::str("exists"));
            }
        }

        Ok(Value::Noval)
    });
}

#[test]
fn primary_make_response_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "makeResponse", move |args| {
        let ctxmap = args[0].clone();
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);
        fixctx(&ctx, &client);

        utility.make_response(&ctx)?;

        // Update entry ctx for match checking with result data.
        if let (Value::Map(_), Some(result)) = (&ctxmap, ctx.result.borrow().clone()) {
            let r = result.borrow();
            setp(
                &ctxmap,
                "result",
                jo(vec![
                    ("ok", Value::Bool(r.ok)),
                    ("status", Value::Num(r.status as f64)),
                    ("statusText", Value::str(r.status_text.clone())),
                    ("headers", r.headers.clone()),
                    ("body", r.body.clone()),
                ]),
            );
        }

        Ok(Value::Noval)
    });
}

#[test]
fn primary_make_result_basic() {
    let (client, utility) = base_client();
    let ctx = make_test_full_ctx(&client, &utility);
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![
        ("base", Value::str("http://localhost:8080")),
        ("prefix", Value::str("/api")),
        ("path", Value::str("items/{id}")),
        ("params", jo(vec![("id", Value::str("item01"))])),
        ("query", Value::empty_map()),
        ("headers", Value::empty_map()),
        ("method", Value::str("GET")),
        ("step", Value::str("start")),
    ])))));
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(&jo(vec![
        ("ok", Value::Bool(true)),
        ("status", Value::Num(200.0)),
        ("statusText", Value::str("OK")),
        ("headers", Value::empty_map()),
        (
            "resdata",
            jo(vec![
                ("id", Value::str("item01")),
                ("name", Value::str("Test")),
            ]),
        ),
    ])))));

    let result = utility.make_result(&ctx).expect("expected no error");
    assert_eq!(result.borrow().status, 200);
}

#[test]
fn primary_make_result_no_spec() {
    let (client, utility) = base_client();
    let ctx = make_test_full_ctx(&client, &utility);
    *ctx.spec.borrow_mut() = None;
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(&jo(vec![
        ("ok", Value::Bool(true)),
        ("status", Value::Num(200.0)),
    ])))));
    assert!(
        utility.make_result(&ctx).is_err(),
        "expected error for nil spec"
    );
}

#[test]
fn primary_make_result_no_result() {
    let (client, utility) = base_client();
    let ctx = make_test_full_ctx(&client, &utility);
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![(
        "step",
        Value::str("start"),
    )])))));
    *ctx.result.borrow_mut() = None;
    assert!(
        utility.make_result(&ctx).is_err(),
        "expected error for nil result"
    );
}

#[test]
fn primary_make_spec_basic() {
    let mut run = primary_run();
    let setup_opts = tostruct(&jpath(&run.spec, &["makeSpec", "DEF", "setup", "a"]));
    let spec_client = test_sdk(Value::Noval, setup_opts);
    let spec_utility = spec_client.get_utility();

    runsection(&mut run, "makeSpec", move |args| {
        let ctxmap = args[0].clone();
        let ctx = make_ctx_from_map(&ctxmap, &spec_client, &spec_utility);
        *ctx.options.borrow_mut() = spec_client.options_map();

        spec_utility.make_spec(&ctx)?;

        // Update entry ctx for match.
        if let (Value::Map(_), Some(spec)) = (&ctxmap, ctx.spec.borrow().clone()) {
            let s = spec.borrow();
            setp(
                &ctxmap,
                "spec",
                jo(vec![
                    ("base", Value::str(s.base.clone())),
                    ("prefix", Value::str(s.prefix.clone())),
                    ("suffix", Value::str(s.suffix.clone())),
                    ("method", Value::str(s.method.clone())),
                    ("params", s.params.clone()),
                    ("query", s.query.clone()),
                    ("headers", s.headers.clone()),
                    ("step", Value::str(s.step.clone())),
                ]),
            );
        }

        Ok(Value::Noval)
    });
}

#[test]
fn primary_make_point_basic() {
    let (client, utility) = base_client();
    let ctx = make_test_ctx(&client, &utility);
    let point = jo(vec![
        ("parts", ja(vec![Value::str("items"), Value::str("{id}")])),
        ("args", jo(vec![("params", Value::empty_list())])),
        ("params", Value::empty_list()),
        ("alias", Value::empty_map()),
        ("select", Value::empty_map()),
        ("active", Value::Bool(true)),
        ("transform", Value::empty_map()),
    ]);
    *ctx.op.borrow_mut() = Rc::new(Operation::new(&jo(vec![
        ("entity", Value::str("x")),
        ("name", Value::str("load")),
        ("points", ja(vec![point])),
    ])));

    utility.make_point(&ctx).expect("expected no error");
    assert!(
        !ctx.point.borrow().is_noval(),
        "expected point to be set"
    );
}

#[test]
fn primary_make_url_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "makeUrl", move |args| {
        let ctxmap = args[0].clone();
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);
        if ctx.result.borrow().is_none() {
            *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(
                &Value::empty_map(),
            ))));
        }
        utility.make_url(&ctx).map(Value::str)
    });
}

#[test]
fn primary_operator_basic() {
    let (_client, _utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "operator", move |args| {
        let vin = args[0].clone();
        let op = Operation::new(&vin);
        Ok(jo(vec![
            ("entity", Value::str(op.entity.clone())),
            ("name", Value::str(op.name.clone())),
            ("input", Value::str(op.input.clone())),
            ("points", op.points.clone()),
        ]))
    });
}

#[test]
fn primary_param_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "param", move |args| {
        if args.len() < 2 {
            return Ok(Value::Noval);
        }

        let ctxmap = match &args[0] {
            Value::Map(m) => Value::Map(m.clone()),
            _ => {
                let fresh = Value::empty_map();
                args[0] = fresh.clone();
                fresh
            }
        };
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);
        let paramdef = args[1].clone();

        let result = utility.param(&ctx, &paramdef);

        // Write the resolved spec alias back into args[0] — the map a
        // `match: {ctx: {spec: {alias: ...}}}` assertion reads (resolver
        if let Some(spec) = ctx.spec.borrow().clone() {
            setp(
                &ctxmap,
                "spec",
                jo(vec![("alias", spec.borrow().alias.clone())]),
            );
        }

        Ok(result)
    });
}

// Where this SDK's prepare_auth puts the credential, probed once over empty
// headers and query. `pair` is the `<scheme>=` lead-in of a cookie
// credential, which rides the header bag under "cookie".
struct AuthCred {
    query: bool,
    name: String,
    pair: String,
}

fn auth_credential() -> Option<AuthCred> {
    let client = test_sdk(
        Value::Noval,
        jo(vec![
            ("apikey", Value::str("PROBE")),
            ("auth", jo(vec![("prefix", Value::str("")), ("basic", Value::Bool(false))])),
        ]),
    );
    let utility = client.get_utility();
    let ctx = make_test_ctx(&client, &utility);
    let spec = Rc::new(RefCell::new(Spec::new(&jo(vec![("step", Value::str("s"))]))));
    *ctx.spec.borrow_mut() = Some(spec.clone());
    utility.prepare_auth(&ctx).ok()?;
    for query in [false, true] {
        let bag = if query { spec.borrow().query.clone() } else { spec.borrow().headers.clone() };
        let first = vs::keysof_vec(&bag).into_iter().next()
            .map(|k| { let v = vs::lookup(&bag, &vs::Value::str(k.clone())); (k, v) });
        if let Some((name, value)) = first {
            let text = value.as_str().unwrap_or("");
            let pair = if !query && "cookie" == name && text.ends_with("=PROBE") {
                text[..text.len() - "PROBE".len()].to_string()
            } else {
                String::new()
            };
            return Some(AuthCred { query, name, pair });
        }
    }
    None
}

// The corpus states the credential as `headers.authorization`, a placeholder
// for wherever this SDK puts it. Only that entry moves, under the real name
// and into the real container, and a cookie credential's value becomes its
// pair: every other header and query parameter stays where it was.
fn auth_retarget(node: &Json, cred: &AuthCred) -> Json {
    match node {
        Json::List(items) => Json::List(items.iter().map(|n| auth_retarget(n, cred)).collect()),
        Json::Map(entries) => {
            let mut out = BTreeMap::new();
            let mut placed = None;
            for (key, val) in entries {
                match val {
                    Json::Map(inner) if "headers" == key => {
                        let mut bag = inner.clone();
                        placed = bag.remove("authorization").map(|v| match v {
                            Json::Str(text) => Json::Str(format!("{}{}", cred.pair, text)),
                            other => other,
                        });
                        out.insert(key.clone(), Json::Map(bag));
                    }
                    _ => {
                        out.insert(key.clone(), auth_retarget(val, cred));
                    }
                }
            }
            if let Some(value) = placed {
                let to = if cred.query { "query" } else { "headers" };
                let dest = out.entry(to.to_string()).or_insert_with(|| Json::Map(BTreeMap::new()));
                if !matches!(dest, Json::Map(_)) {
                    *dest = Json::Map(BTreeMap::new());
                }
                if let Json::Map(bag) = dest {
                    bag.insert(cred.name.clone(), value);
                }
            }
            Json::Map(out)
        }
        other => other.clone(),
    }
}

// Read from the config, never from a probe: a probe that finds no credential
// is the regression this section exists to catch.
#[test]
fn primary_prepare_auth_basic() {
    if !matches!(getp(&getp(&RUSTCRATE::make_config(), "options"), "auth"), Value::Map(_)) {
        println!("SKIP prepareAuth: this SDK's config declares no auth, so it places no credential");
        return;
    }
    let mut run = primary_run();
    let cred = auth_credential().expect("prepare_auth placed no credential in headers or query");
    if let Json::Map(sections) = &mut run.spec {
        if let Some(section) = sections.get_mut("prepareAuth") {
            *section = auth_retarget(section, &cred);
        }
    }
    let setup_opts = tostruct(&jpath(&run.spec, &["prepareAuth", "DEF", "setup", "a"]));
    let auth_client = test_sdk(Value::Noval, setup_opts);
    let auth_utility = auth_client.get_utility();

    runsection(&mut run, "prepareAuth", move |args| {
        let ctxmap = args[0].clone();
        let ctx = make_ctx_from_map(&ctxmap, &auth_client, &auth_utility);
        fixctx(&ctx, &auth_client);

        auth_utility.prepare_auth(&ctx)?;

        // Update entry ctx for match.
        if let (Value::Map(_), Some(spec)) = (&ctxmap, ctx.spec.borrow().clone()) {
            let spec = spec.borrow();
            setp(
                &ctxmap,
                "spec",
                jo(vec![("headers", spec.headers.clone()), ("query", spec.query.clone())]),
            );
        }

        Ok(Value::Noval)
    });
}

#[test]
fn primary_prepare_body_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "prepareBody", move |args| {
        let ctx = make_ctx_from_map(&args[0].clone(), &client, &utility);
        fixctx(&ctx, &client);
        utility.prepare_body(&ctx)
    });
}

#[test]
fn primary_prepare_headers_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "prepareHeaders", move |args| {
        let ctx = make_ctx_from_map(&args[0].clone(), &client, &utility);
        Ok(utility.prepare_headers(&ctx))
    });
}

#[test]
fn primary_prepare_method_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "prepareMethod", move |args| {
        let ctx = make_ctx_from_map(&args[0].clone(), &client, &utility);
        // An op the API does not define resolves NO method: ts answers
        // undefined and rust answers "" — both are "no value" to the
        // corpus, which pins it with an entry that declares no `out`.
        let method = utility.prepare_method(&ctx);
        if method.is_empty() {
            return Ok(Value::Noval);
        }
        Ok(Value::str(method))
    });
}

#[test]
fn primary_prepare_params_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "prepareParams", move |args| {
        let ctx = make_ctx_from_map(&args[0].clone(), &client, &utility);
        Ok(utility.prepare_params(&ctx))
    });
}

// preparePath fixture shipped as an empty `set: []`). Now driven by the
// corpus like every other section, so all ports assert the same separator /
// blank-segment behaviour.
#[test]
fn primary_prepare_path_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "preparePath", move |args| {
        let ctx = make_ctx_from_map(&args[0].clone(), &client, &utility);
        Ok(Value::str(utility.prepare_path(&ctx)))
    });
}

#[test]
fn primary_prepare_query_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "prepareQuery", move |args| {
        let ctx = make_ctx_from_map(&args[0].clone(), &client, &utility);
        Ok(utility.prepare_query(&ctx))
    });
}

#[test]
fn primary_result_basic_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "resultBasic", move |args| {
        let ctx = make_ctx_from_map(&args[0].clone(), &client, &utility);
        fixctx(&ctx, &client);

        let result = utility.result_basic(&ctx);

        let out = Value::empty_map();
        if let Some(result) = result {
            let r = result.borrow();
            setp(&out, "status", Value::Num(r.status as f64));
            setp(&out, "statusText", Value::str(r.status_text.clone()));
            if let Some(err) = &r.err {
                setp(
                    &out,
                    "err",
                    jo(vec![("message", Value::str(err.msg.clone()))]),
                );
            }
        }

        Ok(out)
    });
}

#[test]
fn primary_result_body_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "resultBody", move |args| {
        let ctxmap = args[0].clone();
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);

        utility.result_body(&ctx);

        if let (Value::Map(_), Some(result)) = (&ctxmap, ctx.result.borrow().clone()) {
            setp(
                &ctxmap,
                "result",
                jo(vec![("body", result.borrow().body.clone())]),
            );
        }

        Ok(Value::Noval)
    });
}

#[test]
fn primary_result_headers_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "resultHeaders", move |args| {
        let ctxmap = args[0].clone();
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);

        utility.result_headers(&ctx);

        if let (Value::Map(_), Some(result)) = (&ctxmap, ctx.result.borrow().clone()) {
            setp(
                &ctxmap,
                "result",
                jo(vec![("headers", result.borrow().headers.clone())]),
            );
        }

        Ok(Value::Noval)
    });
}

#[test]
fn primary_transform_request_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "transformRequest", move |args| {
        let ctxmap = args[0].clone();
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);

        let result = utility.transform_request(&ctx);

        // Update entry ctx for match (step changed).
        if let Some(spec) = ctx.spec.borrow().clone() {
            if let Value::Map(_) = getp(&ctxmap, "spec") {
                setp(
                    &getp(&ctxmap, "spec"),
                    "step",
                    Value::str(spec.borrow().step.clone()),
                );
            }
        }

        Ok(result)
    });
}

#[test]
fn primary_transform_response_basic() {
    let (client, utility) = base_client();
    let mut run = primary_run();
    runsection(&mut run, "transformResponse", move |args| {
        let ctxmap = args[0].clone();
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);

        let result = utility.transform_response(&ctx);

        if let Some(spec) = ctx.spec.borrow().clone() {
            if let Value::Map(_) = getp(&ctxmap, "spec") {
                setp(
                    &getp(&ctxmap, "spec"),
                    "step",
                    Value::str(spec.borrow().step.clone()),
                );
            }
        }

        Ok(result)
    });
}

// keep new_sdk / to_map referenced (parity helpers).
#[test]
fn primary_new_sdk_smoke() {
    // A templated base URL with no default refuses a client with no options.
    match new_sdk() {
        Ok(client) => assert_eq!(*client.mode.borrow(), "live"),
        Err(err) => assert_eq!(err.code, "server_var_required"),
    }
    let _ = to_map(&Value::Noval);
}

// Cases a closed value union cannot state: the data and the match are a
// `Value`, which holds no source, so a source sits only beside the data, by
// field name. One passed under a field not declared binary is refused, as the
// sections' other cases check.
const INEXPRESSIBLE: &[&str] = &[
    "multipart: a source nested in other data is refused",
    "multipart: a source in the match is refused",
    "a source in a record",
];

// A codec section a project's corpus has not pulled yet is skipped, as is one
// for a codec this SDK was generated without: its model has no such point.
fn runcodec<F>(name: &str, kind: &str, codec: Option<&str>, subject: F)
where
    F: FnMut(&mut Vec<Value>) -> Result<Value, ProjectNameError> + 'static,
{
    let mut run = primary_run();
    let section = run.set(&[name, kind]);
    if section.isabsent() {
        println!("SKIP {}.{}: this project's test.json has no such section", name, kind);
        return;
    }
    if let Some(codec) = codec {
        if !RUSTCRATE::utility::codec::CODECS.contains(&codec) {
            println!("SKIP {}.{}: this SDK was generated without a {} codec", name, kind, codec);
            return;
        }
    }
    let all = section.get("set").aslist().cloned().unwrap_or_default();
    assert!(!all.is_empty(), "test corpus section '{}.{}' is EMPTY", name, kind);
    let kept: Vec<Json> = all
        .into_iter()
        .filter(|entry| !INEXPRESSIBLE.contains(&entry.get("name").asstr().unwrap_or("")))
        .collect();
    let mut entries: Vec<(&str, Json)> = Vec::new();
    if let Some(m) = section.asmap() {
        for (k, v) in m.iter().filter(|(k, _)| "set" != k.as_str()) {
            entries.push((k.as_str(), v.clone()));
        }
    }
    entries.push(("set", Json::list(kept)));
    let section = Json::map(entries);

    let before = run.failures.len();
    run.run_set_args(&section, true, &format!("{}.{}", name, kind), subject);
    if before < run.failures.len() {
        panic!("{}", run.failures[before..].join("\n"));
    }
}

fn marker_bytes(val: &Value, key: &str) -> Option<Vec<u8>> {
    match getp(val, key) {
        Value::Str(s) => Some(s.chars().map(|c| c as u32 as u8).collect()),
        _ => None,
    }
}

// `source$` (latin1) is a source built by binary().bytes, `bytes$` bytes.
fn marked_source(val: &Value) -> Option<BinarySource> {
    if let Some(data) = marker_bytes(val, "source$") {
        return Some(BinarySource::bytes(
            data,
            get_str(val, "name").as_deref(),
            get_str(val, "type").as_deref(),
        ));
    }
    marker_bytes(val, "bytes$").map(|data| BinarySource::bytes(data, None, None))
}

// The data's top-level sources move beside it, as a caller passes them.
fn sourced_data(data: &Value) -> (Value, Sources) {
    let out = Value::empty_map();
    let mut sources = Vec::new();
    if let Value::Map(m) = data {
        for (k, v) in m.borrow().iter() {
            if let Some(src) = marked_source(v) {
                sources.push((k.clone(), src));
            } else if let Value::List(items) = v {
                let srcs: Vec<BinarySource> = items.borrow().iter().filter_map(marked_source).collect();
                if !srcs.is_empty() && srcs.len() == items.borrow().len() {
                    sources.extend(srcs.into_iter().map(|s| (k.clone(), s)));
                } else {
                    setp(&out, k, v.clone());
                }
            } else {
                setp(&out, k, v.clone());
            }
        }
    }
    (out, sources)
}

// Bytes as the pipeline carries them.
fn sourced_bytes(val: &Value) -> Value {
    match marker_bytes(val, "bytes$") {
        Some(data) => bytes_value(&data),
        None => val.clone(),
    }
}

fn latin1_of(body: &Value) -> Value {
    match body {
        Value::List(_) => match RUSTCRATE::utility::media::body_bytes(body) {
            Some(bytes) => Value::str(bytes.iter().map(|b| *b as char).collect::<String>()),
            None => body.clone(),
        },
        other => other.clone(),
    }
}

fn boundary_client() -> (Rc<ProjectNameSDK>, Rc<Utility>) {
    let (client, utility) = base_client();
    *utility.multipart_boundary.borrow_mut() = Rc::new(|_ctx| "BOUNDARY".to_string());
    (client, utility)
}

fn body_codec(kind: &'static str) {
    let (client, utility) = boundary_client();
    runcodec("prepareBody", kind, if "raw" == kind { None } else { Some(kind) }, move |args| {
        let ctxmap = args[0].clone();
        let (reqdata, sources) = sourced_data(&getp(&ctxmap, "reqdata"));
        setp(&ctxmap, "reqdata", reqdata);
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);
        fixctx(&ctx, &client);
        *ctx.passed.borrow_mut() = sources;
        *ctx.spec.borrow_mut() =
            Some(Rc::new(RefCell::new(Spec::new(&jo(vec![("headers", Value::empty_map())])))));
        let body = utility.prepare_body(&ctx)?;
        let out = jo(vec![("body", latin1_of(&body))]);
        let spec = ctx.spec.borrow().clone().unwrap();
        if let Value::Str(ty) = getp(&spec.borrow().headers, "content-type") {
            setp(&out, "type", Value::str(ty));
        }
        Ok(out)
    });
}

#[test]
fn primary_body_form() {
    body_codec("form");
}

#[test]
fn primary_body_multipart() {
    body_codec("multipart");
}

#[test]
fn primary_body_raw() {
    body_codec("raw");
}

#[test]
fn primary_resbody_raw() {
    let (client, utility) = base_client();
    runcodec("resultBody", "raw", Some("raw"), move |args| {
        let ctxmap = args[0].clone();
        let response = getp(&ctxmap, "response");
        if let Value::Map(_) = response {
            setp(&response, "body", sourced_bytes(&getp(&response, "body")));
        }
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);
        if let Value::Map(_) = getp(&ctxmap, "options") {
            *ctx.options.borrow_mut() = getp(&ctxmap, "options");
        }
        let result = utility.result_body(&ctx).expect("a result");
        if let Some(err) = result.borrow().err.clone() {
            return Err(err);
        }
        setp(&ctxmap, "result", jo(vec![("body", result.borrow().body.clone())]));
        let transfer = ctx.ctrl.borrow().borrow().transfer.clone();
        if let Some(bytes) = transfer.and_then(|t| t.borrow().bytes.clone()) {
            let t = getp(&getp(&ctxmap, "ctrl"), "transfer");
            setp(&t, "bytes", latin1_of(&bytes_value(&bytes)));
        }
        Ok(Value::Noval)
    });
}

#[test]
fn primary_fetchdef_encoded() {
    let (client, utility) = base_client();
    runcodec("makeFetchDef", "encoded", None, move |args| {
        let ctxmap = args[0].clone();
        let spec = getp(&ctxmap, "spec");
        setp(&spec, "body", sourced_bytes(&getp(&spec, "body")));
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);
        fixctx(&ctx, &client);
        let fetchdef = utility.make_fetch_def(&ctx)?;
        setp(&fetchdef, "body", latin1_of(&getp(&fetchdef, "body")));
        Ok(fetchdef)
    });
}

#[test]
fn primary_clean_binary() {
    let (client, utility) = base_client();
    runcodec("clean", "binary", None, move |args| {
        let ctxmap = args[0].clone();
        let spec = getp(&ctxmap, "spec");
        if let Value::Map(_) = spec {
            setp(&spec, "body", sourced_bytes(&getp(&spec, "body")));
        }
        let ctx = make_ctx_from_map(&ctxmap, &client, &utility);
        let val = if Value::str("spec$") == args[1] { spec } else { args[1].clone() };
        Ok(utility.clean(&ctx, &val))
    });
}
