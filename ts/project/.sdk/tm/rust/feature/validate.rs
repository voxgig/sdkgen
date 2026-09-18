
use std::rc::Rc;

use crate::core::context::Context;
use crate::core::helpers::{getp, setp};
use crate::core::types::{Feature, OutVal};
use crate::feature::support::*;
use crate::utility::voxgigstruct as vs;
use crate::utility::voxgigstruct::{InjectDef, Value};

// Built rather than written, so the backticks cannot be lost in an edit.
fn open_key() -> String {
    format!("{}$OPEN{}", 96u8 as char, 96u8 as char)
}

pub struct ValidateFeature {
    pub name: String,
    pub active: bool,
    pub add_opts: Option<Value>,
    options: Value,
    spec: Value,

    request: bool,
    response: bool,
    mode: String,
}

impl ValidateFeature {
    pub fn new() -> ValidateFeature {
        ValidateFeature {
            name: "validate".to_string(),
            active: true,
            add_opts: None,
            options: Value::Noval,
            spec: Value::empty_map(),
            request: true,
            response: false,
            mode: "throw".to_string(),
        }
    }

    fn payload(&self, ctx: &Rc<Context>, opname: &str) -> Value {
        let body = "create" == opname || "update" == opname || "patch" == opname;

        let base = if body {
            ctx.data.borrow().clone()
        } else {
            ctx.mtch.borrow().clone()
        };
        let req = if body {
            ctx.reqdata.borrow().clone()
        } else {
            ctx.reqmatch.borrow().clone()
        };

        let out = Value::empty_map();
        for src in [&base, &req] {
            if let Some(m) = src.as_map() {
                for (k, v) in m.borrow().iter() {
                    setp(&out, k, v.clone());
                }
            }
        }

        if let Some(m) = out.as_map() {
            m.borrow_mut().shift_remove("$action");
        }

        out
    }

    fn entity_spec(&self, ctx: &Rc<Context>) -> Value {
        getp(&self.spec, &entname(ctx))
    }

    fn check(
        &self,
        ctx: &Rc<Context>,
        data: &Value,
        spec: &Value,
        direction: &str,
    ) -> Vec<String> {
        let collector = Value::empty_list();
        let injdef = InjectDef {
            errs: Some(collector.clone()),
            ..Default::default()
        };

        // A spec this port cannot run at all (rather than a payload that
        // fails it) must not take the operation down with it: report it like
        // any other failure and let `mode` decide.
        let ran = vs::validate(data, spec, Some(&injdef));

        let mut errs: Vec<String> = Vec::new();
        if let Some(l) = collector.as_list() {
            for e in l.borrow().iter() {
                errs.push(errmsg(e));
            }
        }
        if errs.is_empty() {
            if let Err(e) = ran {
                errs.push(e.message);
            }
        }

        if !errs.is_empty() {
            let report = Value::empty_map();
            setp(&report, "entity", Value::str(entname(ctx)));
            setp(&report, "op", Value::str(opname(ctx)));
            setp(&report, "direction", Value::str(direction));
            setp(
                &report,
                "errs",
                Value::list(errs.iter().map(Value::str).collect()),
            );
            setp(&report, "data", data.clone());
            report_invalid(&self.options, &report);
        }

        errs
    }
}

impl Feature for ValidateFeature {
    fn name(&self) -> String {
        self.name.clone()
    }
    fn active(&self) -> bool {
        self.active
    }
    fn add_options(&self) -> Option<Value> {
        self.add_opts.clone()
    }

    fn init(&mut self, _ctx: &Rc<Context>, options: &Value) {
        self.options = options.clone();
        self.active = fopt_bool(options, "active", false);

        // DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
        // `config.options` documents them and types them; it does not inject
        // them, because each feature entry in the spec is optional and struct
        // fills in nothing through an optional union. So every feature
        // resolves its own.
        self.request = fopt_bool(options, "request", true);
        self.response = fopt_bool(options, "response", false);

        // FAIL CLOSED. Only the exact string "report" selects report mode, so
        // a typo (`mode: "thow"`) still rejects rather than silently turning
        // enforcement off - the failure nobody would notice. The option spec
        // rejects the typo outright; this is what happens if it ever does not.
        self.mode = if "report" == fopt_str(options, "mode", "throw") {
            "report".to_string()
        } else {
            "throw".to_string()
        };

        // `strict` is applied ONCE, here, by rebuilding the spec tree without
        // the `$OPEN` markers - rather than per call, which would clone a
        // spec for every request an SDK ever makes. REBUILT, not mutated:
        // `Value` is Rc-backed, so a clone shares its maps with the module
        // constant every other client in the process reads.
        let entityspec = crate::core::schema::entityspec();
        self.spec = if fopt_bool(options, "strict", false) {
            close(&entityspec)
        } else {
            entityspec
        };
    }

    fn pre_spec(&mut self, ctx: &Rc<Context>) {
        if !self.active || !self.request {
            return;
        }

        let opname = opname(ctx);
        let opspec = getp(&getp(&self.entity_spec(ctx), "op"), &opname);
        if opspec.is_nullish() {
            return;
        }

        let payload = self.payload(ctx, &opname);
        let errs = self.check(ctx, &payload, &opspec, "request");
        if errs.is_empty() || "report" == self.mode {
            return;
        }

        let err = ctx.make_error(
            "validate_failed",
            &format!(
                "Invalid {} request for entity \"{}\": {}",
                opname,
                entname(ctx),
                errs.join("; ")
            ),
        );
        ctx.out_set("spec", OutVal::Err(err));
    }

    fn pre_done(&mut self, ctx: &Rc<Context>) {
        if !self.active || !self.response {
            return;
        }

        let dataspec = getp(&self.entity_spec(ctx), "data");
        if dataspec.is_nullish() {
            return;
        }

        let result = match ctx.result.borrow().clone() {
            Some(r) => r,
            None => return,
        };

        let resdata = result.borrow().resdata.clone();
        if resdata.is_nullish() {
            return;
        }

        let records: Vec<Value> = match resdata.as_list() {
            Some(l) => l.borrow().clone(),
            None => vec![resdata.clone()],
        };

        let mut errs: Vec<String> = Vec::new();
        for record in records.iter() {
            if record.is_nullish() {
                continue;
            }

            // A NON-OBJECT IS A FAILURE, not something to skip. A load that
            // answered 42 where the entity's spec wants a record must not
            // pass this feature silently - struct rejects it with the field
            // it could not find.
            errs.extend(self.check(ctx, record, &dataspec, "response"));
        }

        if errs.is_empty() || "report" == self.mode {
            return;
        }

        let err = ctx.make_error(
            "validate_failed",
            &format!(
                "Invalid response for entity \"{}\": {}",
                entname(ctx),
                errs.join("; ")
            ),
        );

        let mut r = result.borrow_mut();
        r.ok = false;
        r.err = Some(err);
        r.resdata = Value::Noval;
    }
}

fn opname(ctx: &Rc<Context>) -> String {
    ctx.op.borrow().name.clone()
}

fn entname(ctx: &Rc<Context>) -> String {
    let name = match ctx.entity.borrow().clone() {
        Some(e) => e.get_name(),
        None => String::new(),
    };
    if !name.is_empty() {
        return name;
    }
    ctx.op.borrow().entity.clone()
}

fn errmsg(v: &Value) -> String {
    match v {
        Value::Str(s) => s.clone(),
        _ => vs::stringify(v, None, false),
    }
}

// The `onInvalid` callback, if the options carry one. Held as a struct
// `Value::Func`, which is the only function shape an option map can hold in
// this port; it is called with the report as its value argument and its
// return is discarded.
fn report_invalid(options: &Value, report: &Value) {
    let cb = getp(options, "onInvalid");
    if let Value::Func(f) = cb {
        let inj = crate::utility::voxgigstruct::Injection::from_def(None);
        let _ = f(&inj, report, "", &Value::empty_map());
    }
}

fn close(node: &Value) -> Value {
    match node {
        Value::List(l) => Value::list(l.borrow().iter().map(close).collect()),
        Value::Map(m) => {
            let out = Value::empty_map();
            let open = open_key();
            for (k, v) in m.borrow().iter() {
                if *k != open {
                    setp(&out, k, close(v));
                }
            }
            out
        }
        _ => node.clone(),
    }
}
