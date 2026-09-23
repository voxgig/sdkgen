#![allow(dead_code)]

use std::cell::RefCell;
use std::rc::Rc;
use RUSTCRATE::core::helpers::{getp, jo, setp};
use RUSTCRATE::{test_sdk, CtxSpec, Spec, Value};

pub struct AuthCredential {
    pub bag: String,
    pub name: String,
    pub pair: String,
}

pub fn bag(spec: &Spec, cred: &AuthCredential) -> Value {
    if cred.bag == "query" {
        spec.query.clone()
    } else {
        spec.headers.clone()
    }
}

fn probe(basic: bool) -> Option<AuthCredential> {
    let client = test_sdk(
        Value::Noval,
        jo(vec![
            ("apikey", Value::str("K")),
            ("secret", Value::str(if basic { "S" } else { "" })),
            (
                "auth",
                jo(vec![
                    ("prefix", Value::str("Bearer")),
                    ("basic", Value::Bool(basic)),
                ]),
            ),
        ]),
    );
    let utility = client.get_utility();
    let ctx = utility.make_context(
        CtxSpec {
            client: Some(client.clone()),
            utility: Some(utility.clone()),
            ..Default::default()
        },
        Some(&client.get_root_ctx()),
    );
    let spec = Rc::new(RefCell::new(Spec::new(&Value::empty_map())));
    *ctx.spec.borrow_mut() = Some(spec.clone());
    utility.prepare_auth(&ctx).expect("credential probe failed");
    for container in ["headers", "query"] {
        let mut cred = AuthCredential {
            bag: container.into(),
            name: String::new(),
            pair: String::new(),
        };
        if let Value::Map(values) = bag(&spec.borrow(), &cred) {
            if let Some((name, value)) = values.borrow().iter().next() {
                cred.name = name.clone();
                if container == "headers" && name == "cookie" {
                    if let Value::Str(text) = value {
                        if let Some(pair) = text.strip_suffix("=K") {
                            if !pair.is_empty() && !pair.contains(['=', ';']) {
                                cred.pair = format!("{}=", pair);
                            }
                        }
                    }
                }
                return Some(cred);
            }
        }
    }
    None
}

pub fn credential() -> Option<AuthCredential> {
    let cred = probe(false);
    assert_eq!(
        cred.is_some(),
        probe(true).is_some(),
        "credential probe missed Basic auth"
    );
    cred
}

pub fn expected(cred: &Option<AuthCredential>, prefix: &str, key: &str) -> Value {
    match cred {
        None => Value::Noval,
        Some(c) => Value::str(if !c.pair.is_empty() {
            format!("{}{}", c.pair, key)
        } else if c.bag == "headers" && !prefix.is_empty() {
            format!("{} {}", prefix, key)
        } else {
            key.into()
        }),
    }
}

pub fn actual(spec: &Spec, cred: &Option<AuthCredential>) -> Value {
    if let Some(c) = cred {
        return getp(&bag(spec, c), &c.name);
    }
    assert_eq!(
        spec.headers,
        Value::empty_map(),
        "public API placed a header"
    );
    assert_eq!(
        spec.query,
        Value::empty_map(),
        "public API placed a query credential"
    );
    Value::Noval
}

pub fn seed(cred: &Option<AuthCredential>) -> Rc<RefCell<Spec>> {
    let spec = Spec::new(&Value::empty_map());
    if let Some(c) = cred {
        setp(&bag(&spec, c), &c.name, expected(cred, "", "stale"));
    }
    Rc::new(RefCell::new(spec))
}

pub fn retarget(node: &Value, cred: &Option<AuthCredential>) -> Value {
    match node {
        Value::List(items) => Value::List(Rc::new(RefCell::new(
            items.borrow().iter().map(|v| retarget(v, cred)).collect(),
        ))),
        Value::Map(fields) => {
            let out = Value::empty_map();
            for (key, value) in fields.borrow().iter() {
                if key == "headers" && matches!(value, Value::Map(_)) {
                    let headers = Value::empty_map();
                    if let Value::Map(entries) = value {
                        for (name, v) in entries.borrow().iter() {
                            if name != "authorization" {
                                setp(&headers, name, v.clone());
                            }
                        }
                    }
                    setp(&out, key, headers);
                } else {
                    setp(&out, key, retarget(value, cred));
                }
            }
            let value = getp(&getp(node, "headers"), "authorization");
            if let Some(c) = cred {
                if !value.is_noval() {
                    let mut dest = getp(&out, &c.bag);
                    if !matches!(dest, Value::Map(_)) {
                        dest = Value::empty_map();
                        setp(&out, &c.bag, dest.clone());
                    }
                    let placed = match &value {
                        Value::Str(text) if !c.pair.is_empty() => expected(cred, "", text),
                        _ => value,
                    };
                    setp(&dest, &c.name, placed);
                }
            }
            out
        }
        _ => node.clone(),
    }
}
