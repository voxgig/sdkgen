use std::rc::Rc;

use crate::core::context::Context;
use crate::core::helpers::{get_str, getp, getpath, ja, jo, setp, to_map};
use crate::utility::voxgigstruct as vs;
use crate::utility::voxgigstruct::Value;

pub fn make_options_util(ctx: &Rc<Context>) -> Value {
    let options = match ctx.options.borrow().clone() {
        Value::Map(m) => Value::Map(m),
        _ => Value::empty_map(),
    };

    // Merge custom utility overrides onto the utility object. Read from the
    // original options (function values are shared by reference).
    let custom_utils = to_map(&getp(&options, "utility"));
    if let Value::Map(cm) = &custom_utils {
        if let Some(utility) = ctx.utility.borrow().clone() {
            let custom = utility.custom.borrow().clone();
            for (k, v) in cm.borrow().iter() {
                setp(&custom, k, v.clone());
            }
        }
    }

    let mut opts = vs::clone(&options);

    let config = ctx.config.borrow().clone();
    let cfgopts = match to_map(&getp(&config, "options")) {
        Value::Map(m) => Value::Map(m),
        _ => Value::empty_map(),
    };

    let optspec = jo(vec![
        ("apikey", Value::str("")),
        ("base", Value::str("http://localhost:8000")),
        ("prefix", Value::str("")),
        ("suffix", Value::str("")),
        ("auth", jo(vec![("prefix", Value::str(""))])),
        ("headers", jo(vec![("`$CHILD`", Value::str("`$STRING`"))])),
        (
            "allow",
            jo(vec![
                ("method", Value::str("GET,PUT,POST,PATCH,DELETE,OPTIONS")),
                ("op", Value::str("create,update,load,list,remove,command,direct")),
            ]),
        ),
        (
            "entity",
            jo(vec![(
                "`$CHILD`",
                jo(vec![
                    ("`$OPEN`", Value::Bool(true)),
                    ("active", Value::Bool(false)),
                    ("alias", Value::empty_map()),
                ]),
            )]),
        ),
        (
            "feature",
            jo(vec![(
                "`$CHILD`",
                jo(vec![
                    ("`$OPEN`", Value::Bool(true)),
                    ("active", Value::Bool(false)),
                ]),
            )]),
        ),
        ("utility", Value::empty_map()),
        ("system", Value::empty_map()),
        (
            "test",
            jo(vec![
                ("active", Value::Bool(false)),
                ("entity", jo(vec![("`$OPEN`", Value::Bool(true))])),
            ]),
        ),
        ("clean", jo(vec![("keys", Value::str("key,token,id"))])),
    ]);

    // Preserve system.fetch before merge/validate (validation strips it).
    let sys_fetch = getpath(&["system", "fetch"], &opts);

    let merged = vs::merge(&ja(vec![Value::empty_map(), cfgopts, opts.clone()]), None);
    if let Ok(validated) = vs::validate(&merged, &optspec, None) {
        if let Value::Map(_) = validated {
            opts = validated;
        }
    }

    // Restore system.fetch.
    if !sys_fetch.is_noval() {
        let sys = getp(&opts, "system");
        if let Value::Map(_) = sys {
            setp(&sys, "fetch", sys_fetch);
        } else {
            setp(&opts, "system", jo(vec![("fetch", sys_fetch)]));
        }
    }

    // Derived clean config.
    let clean_keys = match getpath(&["clean", "keys"], &opts) {
        Value::Str(s) => s,
        _ => "key,token,id".to_string(),
    };

    let filtered: Vec<String> = clean_keys
        .split(',')
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .map(|p| vs::esc_re(&Value::str(p)))
        .collect();
    let keyre = filtered.join("|");

    let derived_clean = if keyre.is_empty() {
        Value::empty_map()
    } else {
        jo(vec![("keyre", Value::str(keyre))])
    };
    setp(&opts, "__derived__", jo(vec![("clean", derived_clean)]));

    opts
}

/// Read a string option (helper shared by prepare utilities).
pub fn opt_str(options: &Value, key: &str) -> String {
    get_str(options, key).unwrap_or_default()
}
