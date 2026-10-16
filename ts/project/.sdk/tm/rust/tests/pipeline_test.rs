
mod common;

use std::cell::RefCell;
use std::rc::Rc;

use common::*;

use RUSTCRATE::core::helpers::{getp, getpath, ja, jo, setp};
use RUSTCRATE::utility::voxgigstruct as vs;
use RUSTCRATE::{
    test_sdk, BaseFeature, Context, CtxSpec, Entity, FeatureRef, FetcherFn, Operation,
    ProjectNameSDK, Response, SdkResult, Spec, Utility, Value,
};

// plClient builds a client + isolated utility for pipeline utility tests.
fn pl_client(sdkopts: Value) -> (Rc<ProjectNameSDK>, Rc<Utility>) {
    let client = test_sdk(Value::Noval, sdkopts);
    let utility = client.get_utility();
    (client, utility)
}

fn pl_ctx(
    client: &Rc<ProjectNameSDK>,
    utility: &Rc<Utility>,
    ctrl: Option<Value>,
) -> Rc<Context> {
    utility.make_context(
        CtxSpec {
            opname: Some("load".to_string()),
            client: Some(client.clone()),
            utility: Some(utility.clone()),
            ctrl,
            ..Default::default()
        },
        Some(&client.get_root_ctx()),
    )
}

// plEntity: a minimal fake entity for the list-wrap test.
struct PlEntity {
    name: String,
    made: Rc<RefCell<Vec<Value>>>,
}

impl Entity for PlEntity {
    fn get_name(&self) -> String {
        self.name.clone()
    }
    fn make(&self) -> Rc<dyn Entity> {
        Rc::new(PlEntity {
            name: self.name.clone(),
            made: self.made.clone(),
        })
    }
    fn data(&self, args: Option<&Value>) -> Value {
        if let Some(arg) = args {
            if !arg.is_noval() && !arg.is_null() {
                self.made.borrow_mut().push(arg.clone());
                return arg.clone();
            }
        }
        Value::Noval
    }
    // Every operation resolves to the entity; `remove` marks it. The fake
    // has to satisfy the same trait the real entities do.
    fn mark_deleted(&self) {}
    fn deleted(&self) -> bool {
        false
    }
    fn matchv(&self, _args: Option<&Value>) -> Value {
        Value::Noval
    }
}

#[test]
fn pipeline_make_response_guards_missing_spec_response_result() {
    let (client, utility) = pl_client(Value::Noval);

    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = None;
    *ctx.response.borrow_mut() = Some(Rc::new(RefCell::new(Response::new(
        &Value::empty_map(),
    ))));
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(
        &Value::empty_map(),
    ))));
    let err = utility.make_response(&ctx).err();
    assert_eq!(err.map(|e| e.code), Some("response_no_spec".to_string()));

    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![(
        "step",
        Value::str("s"),
    )])))));
    *ctx.response.borrow_mut() = None;
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(
        &Value::empty_map(),
    ))));
    let err = utility.make_response(&ctx).err();
    assert_eq!(
        err.map(|e| e.code),
        Some("response_no_response".to_string())
    );

    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![(
        "step",
        Value::str("s"),
    )])))));
    *ctx.response.borrow_mut() = Some(Rc::new(RefCell::new(Response::new(
        &Value::empty_map(),
    ))));
    *ctx.result.borrow_mut() = None;
    let err = utility.make_response(&ctx).err();
    assert_eq!(err.map(|e| e.code), Some("response_no_result".to_string()));
}

#[test]
fn pipeline_make_response_4xx_sets_result_err_and_copies_headers() {
    let (client, utility) = pl_client(Value::Noval);
    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![(
        "step",
        Value::str("s"),
    )])))));
    *ctx.response.borrow_mut() = Some(Rc::new(RefCell::new(Response::new(&fh_response(
        404,
        Value::Noval,
        jo(vec![("x-a", Value::str("1"))]),
    )))));
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(
        &Value::empty_map(),
    ))));
    utility.make_response(&ctx).expect("no error");
    let result = ctx.result.borrow().clone().unwrap();
    assert!(result.borrow().err.is_some(), "expected result.err on 4xx");
    assert_eq!(result.borrow().status, 404);
    assert_eq!(getp(&result.borrow().headers, "x-a"), Value::str("1"));
}

#[test]
fn pipeline_make_response_2xx_parses_body_and_marks_ok() {
    let (client, utility) = pl_client(Value::Noval);
    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![(
        "step",
        Value::str("s"),
    )])))));
    *ctx.response.borrow_mut() = Some(Rc::new(RefCell::new(Response::new(&fh_response(
        200,
        jo(vec![("v", Value::Num(1.0))]),
        Value::Noval,
    )))));
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(
        &Value::empty_map(),
    ))));
    utility.make_response(&ctx).expect("no error");
    let result = ctx.result.borrow().clone().unwrap();
    assert!(result.borrow().ok, "expected ok result");
    assert_eq!(getp(&result.borrow().body, "v"), Value::Num(1.0));
}

#[test]
fn pipeline_make_response_records_to_ctrl_explain() {
    let (client, utility) = pl_client(Value::Noval);
    let ctx = pl_ctx(
        &client,
        &utility,
        Some(jo(vec![("explain", Value::empty_map())])),
    );
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![(
        "step",
        Value::str("s"),
    )])))));
    *ctx.response.borrow_mut() = Some(Rc::new(RefCell::new(Response::new(&fh_response(
        200,
        jo(vec![("v", Value::Num(2.0))]),
        Value::Noval,
    )))));
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(
        &Value::empty_map(),
    ))));
    utility.make_response(&ctx).expect("no error");
    let ctrl = ctx.ctrl.borrow().clone();
    let explain = ctrl.borrow().explain.clone();
    assert!(
        !getp(&explain, "result").is_noval(),
        "expected explain.result recorded"
    );
}

#[test]
fn pipeline_make_result_guards_missing_spec_result() {
    let (client, utility) = pl_client(Value::Noval);

    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = None;
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(
        &Value::empty_map(),
    ))));
    let err = utility.make_result(&ctx).err();
    assert_eq!(err.map(|e| e.code), Some("result_no_spec".to_string()));

    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![(
        "step",
        Value::str("s"),
    )])))));
    *ctx.result.borrow_mut() = None;
    let err = utility.make_result(&ctx).err();
    assert_eq!(err.map(|e| e.code), Some("result_no_result".to_string()));
}

#[test]
fn pipeline_make_result_list_op_wraps_resdata_into_entities() {
    let (client, utility) = pl_client(Value::Noval);
    let made: Rc<RefCell<Vec<Value>>> = Rc::new(RefCell::new(Vec::new()));

    let ctx = pl_ctx(&client, &utility, None);
    *ctx.op.borrow_mut() = Rc::new(Operation::new(&jo(vec![
        ("entity", Value::str("x")),
        ("name", Value::str("list")),
    ])));
    *ctx.entity.borrow_mut() = Some(Rc::new(PlEntity {
        name: "x".to_string(),
        made: made.clone(),
    }));
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![(
        "step",
        Value::str("s"),
    )])))));
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(&jo(vec![(
        "resdata",
        Value::list(vec![
            jo(vec![("a", Value::Num(1.0))]),
            jo(vec![("a", Value::Num(2.0))]),
        ]),
    )])))));

    let result = utility.make_result(&ctx).expect("no error");
    let resdata = result.borrow().resdata.clone();
    assert_eq!(vs::size(&resdata), 2, "expected 2 wrapped entries");
    assert_eq!(made.borrow().len(), 2, "expected 2 data() calls");
}

#[test]
fn pipeline_make_result_empty_list_yields_empty_resdata() {
    let (client, utility) = pl_client(Value::Noval);
    let made: Rc<RefCell<Vec<Value>>> = Rc::new(RefCell::new(Vec::new()));

    let ctx = pl_ctx(&client, &utility, None);
    *ctx.op.borrow_mut() = Rc::new(Operation::new(&jo(vec![
        ("entity", Value::str("x")),
        ("name", Value::str("list")),
    ])));
    *ctx.entity.borrow_mut() = Some(Rc::new(PlEntity {
        name: "x".to_string(),
        made,
    }));
    *ctx.spec.borrow_mut() = Some(Rc::new(RefCell::new(Spec::new(&jo(vec![(
        "step",
        Value::str("s"),
    )])))));
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(&jo(vec![(
        "resdata",
        Value::empty_list(),
    )])))));

    let result = utility.make_result(&ctx).expect("no error");
    let resdata = result.borrow().resdata.clone();
    assert!(matches!(resdata, Value::List(_)));
    assert_eq!(vs::size(&resdata), 0);
}

fn req_spec() -> Rc<RefCell<Spec>> {
    Rc::new(RefCell::new(Spec::new(&jo(vec![
        ("base", Value::str("http://h")),
        ("path", Value::str("a")),
        ("method", Value::str("GET")),
        ("headers", Value::empty_map()),
        ("step", Value::str("s")),
    ]))))
}

fn util_with(client: &Rc<ProjectNameSDK>, fetcher: FetcherFn) -> Rc<Utility> {
    let u = client.get_utility();
    *u.fetcher.borrow_mut() = fetcher;
    u
}

#[test]
fn pipeline_make_request_guards_missing_spec() {
    let (client, _) = pl_client(Value::Noval);
    let utility = util_with(
        &client,
        Rc::new(|_c, _u, _f| Ok(fh_response(200, Value::Noval, Value::Noval))),
    );
    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = None;
    let err = utility.make_request(&ctx).err();
    assert_eq!(err.map(|e| e.code), Some("request_no_spec".to_string()));
}

#[test]
fn pipeline_make_request_transport_error_carried_on_response() {
    let (client, _) = pl_client(Value::Noval);
    let utility = util_with(
        &client,
        Rc::new(|ctx: &Rc<Context>, _u: &str, _f: &Value| {
            Err(ctx.make_error("boom", "boom"))
        }),
    );
    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = Some(req_spec());
    let resp = utility.make_request(&ctx).expect("no error");
    let code = resp.borrow().err.clone().map(|e| e.code);
    assert_eq!(code, Some("boom".to_string()));
}

#[test]
fn pipeline_make_request_nil_transport_result_becomes_response_error() {
    let (client, _) = pl_client(Value::Noval);
    let utility = util_with(&client, Rc::new(|_c, _u, _f| Ok(Value::Noval)));
    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = Some(req_spec());
    let resp = utility.make_request(&ctx).expect("no error");
    assert!(
        resp.borrow().err.is_some(),
        "expected response error for nil transport result"
    );
}

#[test]
fn pipeline_make_request_normal_transport_response_wrapped() {
    let (client, _) = pl_client(Value::Noval);
    let utility = util_with(
        &client,
        Rc::new(|_c, _u, _f| {
            Ok(fh_response(
                200,
                jo(vec![("a", Value::Num(1.0))]),
                Value::Noval,
            ))
        }),
    );
    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = Some(req_spec());
    let resp = utility.make_request(&ctx).expect("no error");
    assert_eq!(resp.borrow().status, 200);
}

#[test]
fn pipeline_make_request_records_fetchdef_to_ctrl_explain() {
    let (client, _) = pl_client(Value::Noval);
    let utility = util_with(
        &client,
        Rc::new(|_c, _u, _f| Ok(fh_response(200, Value::Noval, Value::Noval))),
    );
    let ctx = pl_ctx(
        &client,
        &utility,
        Some(jo(vec![("explain", Value::empty_map())])),
    );
    *ctx.spec.borrow_mut() = Some(req_spec());
    utility.make_request(&ctx).expect("no error");
    let ctrl = ctx.ctrl.borrow().clone();
    let explain = ctrl.borrow().explain.clone();
    assert!(
        !getp(&explain, "fetchdef").is_noval(),
        "expected explain.fetchdef recorded"
    );
}

#[test]
fn pipeline_done_returns_resdata_on_success() {
    let (client, utility) = pl_client(Value::Noval);
    let ctx = pl_ctx(&client, &utility, None);
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(&jo(vec![
        ("ok", Value::Bool(true)),
        ("resdata", jo(vec![("id", Value::str("i1"))])),
    ])))));
    let out = utility.done(&ctx).expect("no error");
    assert_eq!(getp(&out, "id"), Value::str("i1"));
}

#[test]
fn pipeline_done_errors_when_not_ok() {
    let (client, utility) = pl_client(Value::Noval);
    let ctx = pl_ctx(&client, &utility, None);
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(&jo(vec![(
        "ok",
        Value::Bool(false),
    )])))));
    assert!(
        utility.done(&ctx).is_err(),
        "expected an error when result not ok"
    );
}

#[test]
fn pipeline_make_error_returns_resdata_when_throw_false() {
    let (client, utility) = pl_client(Value::Noval);
    let ctx = pl_ctx(&client, &utility, None);
    {
        let ctrl = ctx.ctrl.borrow().clone();
        ctrl.borrow_mut().throw = Some(false);
    }
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(&jo(vec![
        ("ok", Value::Bool(false)),
        ("resdata", Value::str("fallback")),
    ])))));
    let out = utility
        .make_error(&ctx, Some(ctx.make_error("test_code", "test message")))
        .expect("expected no error with throw=false");
    assert_eq!(out, Value::str("fallback"));
}

#[test]
fn pipeline_make_error_records_to_ctrl_explain() {
    let (client, utility) = pl_client(Value::Noval);
    let ctx = pl_ctx(
        &client,
        &utility,
        Some(jo(vec![("explain", Value::empty_map())])),
    );
    {
        let ctrl = ctx.ctrl.borrow().clone();
        ctrl.borrow_mut().throw = Some(false);
    }
    *ctx.result.borrow_mut() = Some(Rc::new(RefCell::new(SdkResult::new(&jo(vec![(
        "ok",
        Value::Bool(false),
    )])))));
    utility
        .make_error(&ctx, Some(ctx.make_error("x", "x")))
        .expect("no error");
    let ctrl = ctx.ctrl.borrow().clone();
    let explain = ctrl.borrow().explain.clone();
    assert!(
        !getp(&explain, "err").is_noval(),
        "expected explain.err recorded"
    );
}

#[test]
fn pipeline_feature_add_appends_by_default() {
    let (client, utility) = pl_client(Value::Noval);
    let ctx = pl_ctx(&client, &utility, None);
    let start = client.features.borrow().len();
    let f: FeatureRef = Rc::new(RefCell::new(BaseFeature::new()));
    utility.feature_add(&ctx, f);
    assert_eq!(client.features.borrow().len(), start + 1);
    let last = client.features.borrow().last().unwrap().borrow().name();
    assert_eq!(last, "base");
}

#[test]
fn pipeline_feature_add_ordering_before_after_replace() {
    fn named(name: &str) -> Rc<RefCell<BaseFeature>> {
        let mut f = BaseFeature::new();
        f.name = name.to_string();
        Rc::new(RefCell::new(f))
    }

    let (client, utility) = pl_client(Value::Noval);
    let ctx = pl_ctx(&client, &utility, None);
    client.features.borrow_mut().clear();

    let names = |client: &Rc<ProjectNameSDK>| -> String {
        client
            .features
            .borrow()
            .iter()
            .map(|f| f.borrow().name())
            .collect::<Vec<_>>()
            .join(",")
    };

    utility.feature_add(&ctx, named("a"));
    utility.feature_add(&ctx, named("b"));
    assert_eq!(names(&client), "a,b", "setup");

    let before = named("z1");
    before.borrow_mut().add_opts = Some(jo(vec![("__before__", Value::str("b"))]));
    utility.feature_add(&ctx, before);
    assert_eq!(names(&client), "a,z1,b", "__before__");

    let after = named("z2");
    after.borrow_mut().add_opts = Some(jo(vec![("__after__", Value::str("a"))]));
    utility.feature_add(&ctx, after);
    assert_eq!(names(&client), "a,z2,z1,b", "__after__");

    let repl = named("z3");
    repl.borrow_mut().add_opts = Some(jo(vec![("__replace__", Value::str("z1"))]));
    utility.feature_add(&ctx, repl);
    assert_eq!(names(&client), "a,z2,z3,b", "__replace__");

    // An ordering option naming no existing feature falls back to append.
    let miss = named("z4");
    miss.borrow_mut().add_opts = Some(jo(vec![("__before__", Value::str("missing"))]));
    utility.feature_add(&ctx, miss);
    assert_eq!(names(&client), "a,z2,z3,b,z4", "fallback append");
}

// --- feature order (array form + test-first default) --------------------

fn make_opts_with_feature(utility: &Rc<Utility>, feature: Value) -> Value {
    let ctx = utility.make_context(
        CtxSpec {
            utility: Some(utility.clone()),
            options: Some(jo(vec![("feature", feature)])),
            config: Some(jo(vec![("options", Value::empty_map())])),
            ..Default::default()
        },
        None,
    );
    utility.make_options(&ctx)
}

fn feature_order_str(opts: &Value) -> String {
    match getpath(&["__derived__", "featureorder"], opts) {
        Value::List(l) => l
            .borrow()
            .iter()
            .filter_map(|v| match v {
                Value::Str(s) => Some(s.clone()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join(","),
        _ => String::new(),
    }
}

#[test]
fn pipeline_feature_order_map_is_test_first() {
    let (_c, utility) = pl_client(Value::Noval);
    let opts = make_opts_with_feature(
        &utility,
        jo(vec![
            ("metrics", jo(vec![("active", Value::Bool(true))])),
            ("test", jo(vec![("active", Value::Bool(true))])),
        ]),
    );
    assert_eq!(feature_order_str(&opts), "test,metrics");
}

#[test]
fn pipeline_feature_order_array_is_explicit() {
    let (_c, utility) = pl_client(Value::Noval);
    let opts = make_opts_with_feature(
        &utility,
        ja(vec![
            jo(vec![("name", Value::str("metrics")), ("active", Value::Bool(true))]),
            jo(vec![("name", Value::str("test")), ("active", Value::Bool(true))]),
        ]),
    );
    assert_eq!(feature_order_str(&opts), "metrics,test");
    // the List is normalized to a map for merge/init, opts preserved.
    assert_eq!(getpath(&["feature", "metrics", "active"], &opts), Value::Bool(true));
    assert_eq!(getpath(&["feature", "test", "active"], &opts), Value::Bool(true));
}

#[test]
fn pipeline_feature_order_map_no_test_is_sorted() {
    let (_c, utility) = pl_client(Value::Noval);
    let opts = make_opts_with_feature(
        &utility,
        jo(vec![
            ("retry", jo(vec![("active", Value::Bool(true))])),
            ("cache", jo(vec![("active", Value::Bool(true))])),
        ]),
    );
    assert_eq!(feature_order_str(&opts), "cache,retry");
}

fn auth_spec(headers: Value) -> Rc<RefCell<Spec>> {
    let headers = match headers {
        Value::Map(m) => Value::Map(m),
        _ => Value::empty_map(),
    };
    Rc::new(RefCell::new(Spec::new(&jo(vec![
        ("headers", headers),
        ("step", Value::str("s")),
    ]))))
}

#[test]
fn pipeline_prepare_auth_guards_missing_spec() {
    let (client, utility) = pl_client(jo(vec![("apikey", Value::str("K"))]));
    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = None;
    let err = utility.prepare_auth(&ctx).err();
    assert_eq!(err.map(|e| e.code), Some("auth_no_spec".to_string()));
}

// Where this SDK's prepare_auth puts the credential. The API's own scheme
// decides the container and the name, so the cases read them from a probe
// run instead of assuming the authorization header. `pair` is the
// `<scheme>=` lead-in of a cookie credential, which rides the header bag
// under "cookie"; it is empty for a header or query credential.
struct PlCred {
    query: bool,
    name: String,
    value: Value,
    pair: String,
}

// A cookie credential as prepare_auth writes it for the probe key: one
// `<scheme>=K` pair and nothing else.
fn pl_cookie_pair(text: &str) -> bool {
    match text.split_once('=') {
        Some((scheme, key)) => !scheme.is_empty() && !scheme.contains(';') && "K" == key,
        None => false,
    }
}

// The options auth block every case passes. `basic: false` is explicit: an
// HTTP Basic API's config carries `auth.basic: true`, whose branch needs a
// secret as well and writes nothing without one, which the probe would read
// as a public API.
fn pl_auth(prefix: &str) -> Value {
    jo(vec![("prefix", Value::str(prefix)), ("basic", Value::Bool(false))])
}

fn pl_bag(spec: &Rc<RefCell<Spec>>, query: bool) -> Value {
    let spec = spec.borrow();
    if query {
        spec.query.clone()
    } else {
        spec.headers.clone()
    }
}

// Runs prepare_auth once over empty headers and query, and reports which it
// wrote to, and under what name. None is a public API, a legitimate shape.
fn pl_auth_probe(sdkopts: Value) -> Option<PlCred> {
    let (client, utility) = pl_client(sdkopts);
    let ctx = pl_ctx(&client, &utility, None);
    *ctx.spec.borrow_mut() = Some(auth_spec(Value::Noval));
    if utility.prepare_auth(&ctx).is_err() {
        return None;
    }
    let spec = ctx.spec.borrow().clone().unwrap();
    for query in [false, true] {
        if let Some((name, value)) = vs::items_vec(&pl_bag(&spec, query)).into_iter().next() {
            let mut pair = String::new();
            if let Some(text) = value.as_str() {
                if !query && "cookie" == name && pl_cookie_pair(text) {
                    pair = text[..text.len() - 1].to_string();
                }
            }
            return Some(PlCred { query, name, value, pair });
        }
    }
    None
}

fn pl_auth_credential() -> Option<PlCred> {
    pl_auth_probe(jo(vec![("apikey", Value::str("K")), ("auth", pl_auth("Bearer"))]))
}

// Every credential this SDK could place: both credentials and Basic switched
// on, so whichever branch the API has, something lands unless it is public.
fn pl_auth_any_credential() -> Option<PlCred> {
    pl_auth_probe(jo(vec![
        ("apikey", Value::str("K")),
        ("secret", Value::str("S")),
        ("auth", jo(vec![("prefix", Value::str("Bearer")), ("basic", Value::Bool(true))])),
    ]))
}

// Runs prepare_auth over a fresh spec, seeding the credential's slot first
// when there is a seed, and returns what is left there.
fn pl_auth_placed(sdkopts: Value, seed: Option<&str>) -> Option<Value> {
    let cred = pl_auth_credential()?;
    let (client, utility) = pl_client(sdkopts);
    let ctx = pl_ctx(&client, &utility, None);
    let spec = auth_spec(Value::Noval);
    if let Some(seed) = seed {
        // cred.pair keeps a cookie seed from reading as a stranger's cookie.
        setp(&pl_bag(&spec, cred.query), &cred.name, Value::str(format!("{}{}", cred.pair, seed)));
    }
    *ctx.spec.borrow_mut() = Some(spec.clone());
    utility.prepare_auth(&ctx).expect("no error");
    let value = getp(&pl_bag(&spec, cred.query), &cred.name);
    if value.is_noval() {
        None
    } else {
        Some(value)
    }
}

// Without this the cases below cannot fail for an SDK whose credential the
// probe misses: every one of them takes the public-API path instead.
#[test]
fn pipeline_prepare_auth_probe_finds_the_credential_this_sdk_places() {
    assert_eq!(
        pl_auth_credential().is_none(),
        pl_auth_any_credential().is_none(),
        "the probe missed a credential this SDK places"
    );
}

#[test]
fn pipeline_prepare_auth_apikey_placed_where_this_api_puts_it() {
    let sdkopts = jo(vec![("apikey", Value::str("K")), ("auth", pl_auth("Bearer"))]);
    let Some(cred) = pl_auth_credential() else {
        assert!(pl_auth_placed(sdkopts, None).is_none(), "expected no credential placed");
        return;
    };
    if !cred.pair.is_empty() {
        // A cookie credential is a `<scheme>=<key>` pair, with no room for a prefix.
        assert!(
            cred.value.as_str().map(pl_cookie_pair).unwrap_or(false),
            "expected a cookie pair, got {:?}",
            cred.value
        );
        return;
    }
    // A header credential is prefix-joined; a query credential is the raw key.
    let want = if cred.query { "K" } else { "Bearer K" };
    assert_eq!(cred.value, Value::str(want), "the credential under {:?}", cred.name);
}

#[test]
fn pipeline_prepare_auth_raw_apikey_empty_prefix_as_is() {
    let placed = pl_auth_placed(
        jo(vec![("apikey", Value::str("K")), ("auth", pl_auth(""))]),
        None,
    );
    match pl_auth_credential() {
        Some(cred) => assert_eq!(placed, Some(Value::str(format!("{}K", cred.pair)))),
        None => assert!(placed.is_none(), "expected no credential placed"),
    }
}

#[test]
fn pipeline_prepare_auth_empty_apikey_drops_credential() {
    let placed = pl_auth_placed(
        jo(vec![("apikey", Value::str("")), ("auth", pl_auth("Bearer"))]),
        Some("stale"),
    );
    assert!(placed.is_none(), "expected the credential dropped, got {:?}", placed);
}

#[test]
fn pipeline_prepare_auth_missing_apikey_drops_credential() {
    let sdkopts = jo(vec![("auth", pl_auth("Bearer"))]);
    let (client, _) = pl_client(sdkopts.clone());
    let options = client.options_map();
    if get_str(&options, "apikey")
        .map(|k| !k.is_empty())
        .unwrap_or(false)
    {
        eprintln!("skip: SDK options carry a configured apikey");
        return;
    }
    let placed = pl_auth_placed(sdkopts, Some("stale"));
    assert!(placed.is_none(), "expected the credential dropped, got {:?}", placed);
}

#[test]
fn pipeline_prepare_auth_public_api_no_auth_block_drops_credential() {
    let sdkopts = jo(vec![("apikey", Value::str("K"))]);
    let (client, _) = pl_client(sdkopts.clone());
    let options = client.options_map();
    if !getp(&options, "auth").is_noval() {
        // Option validation supplies an auth shape for this SDK, so a truly
        // auth-less client cannot be constructed here.
        eprintln!("skip: options always carry an auth block in this SDK");
        return;
    }
    let placed = pl_auth_placed(sdkopts, Some("stale"));
    assert!(placed.is_none(), "expected the credential dropped, got {:?}", placed);
}

// (get_str used by the auth guards above)
use RUSTCRATE::core::helpers::get_str;
