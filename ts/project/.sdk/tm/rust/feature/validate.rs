// Payload validation against the model's own field types. The rust port of
// tm/ts/src/feature/validate/ValidateFeature.ts.
//
// The specs are NOT written here and not written in the model either: every
// entity field already carries a canonical type sentinel (`$STRING`,
// `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
// vocabulary `vs::validate` speaks. The generator maps them once
// (helpers/canonSpec) and emits `core::schema::entityspec()`, so a field
// whose type changes in the API spec changes what this feature enforces with
// no edit anywhere.
//
// WHAT IS CHECKED
//   outbound (pre_spec)  the payload the caller asked to send, against
//                        spec.op[opname] - the operation's request shape.
//   inbound  (pre_done)  each record the operation returned, against
//                        spec.data - the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds, so this checks the shape the model
// knows and nothing more.

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

    // The payload an operation is about to send.
    //
    // TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries
    // the caller's argument in `reqdata` over the entity's `data`; a match op
    // (load/list/remove) carries it in `reqmatch` over `mtch`. That is what
    // the entity operations pass to Context::new and what make_point reads -
    // so reading `reqdata` for every op would check a `load({id})` against
    // the entity's STALE stored match and reject it for the id the caller had
    // just supplied.
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

        // `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the
        // record. make_point reads it off this same argument and the request
        // transformer drops it before the body is built, so a spec built from
        // the API's own fields will never name it - and under `strict` every
        // custom-action call would be rejected for the one key that made it
        // reachable.
        if let Some(m) = out.as_map() {
            m.borrow_mut().shift_remove("$action");
        }

        out
    }

    fn entity_spec(&self, ctx: &Rc<Context>) -> Value {
        getp(&self.spec, &entname(ctx))
    }

    // One validate call. Errors are COLLECTED, never thrown: `vs::validate`
    // returns the first failure as a StructError unless given an `errs` list,
    // and a caller fixing a payload wants every problem with it, not the
    // first one.
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
            // A callback receiving every failure, whatever `mode` does with
            // it. `Value::Func` is the struct-level function type and takes
            // an injection, not a report, so the report is handed to an
            // `on_invalid` closure held in feature state instead - set with
            // `ValidateFeature::on_invalid` after construction, the same way
            // the retry port takes its injectable sleep.
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

    // Outbound. make_spec short-circuits on an `out["spec"]` that is already
    // set, and surfaces an `OutVal::Err` there as the operation's error - the
    // same seam rbac uses one stage earlier through `out["point"]`.
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

    // Inbound. pre_done rather than pre_result: the records are extracted
    // from the response body by make_result, which runs between the two, so
    // at pre_result there is nothing to check but the envelope.
    //
    // HOOK ORDER MATTERS HERE, and the default order is not the one you want.
    // pre_done hooks fire in feature ADD order, which defaults to `test`
    // first and then names sorted - and `validate` sorts last, after audit,
    // cost, debug, metrics and telemetry. Those observers therefore record
    // the operation as a success before this hook has looked at it.
    // Activating features as an ORDERED LIST fixes it.
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

        // A list op returns many records and a load returns one; both are
        // checked against the same record spec, because they are the same
        // entity.
        //
        // NO UNWRAP STEP, unlike the ts and go ports: make_result already
        // stores a list entry as the entity's own `data()` Value rather than
        // as the entity object (utility/make_result.rs), so what arrives here
        // is records either way.
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

        // BOTH, and `ok` is the load-bearing half: `done` returns `resdata`
        // whenever `result.ok` is true and never looks at `err`, so setting
        // the error alone would hand the caller the very records that failed
        // the spec.
        //
        // AND THE DATA GOES. The load/update paths copy `result.resdata` into
        // the entity's own state on any non-null value, BEFORE `done` raises
        // - so rejecting the operation while leaving the records in place
        // would leave the caller holding an entity populated from a payload
        // this feature had just declared invalid.
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

// A collected failure as a message. `stringify` would quote a plain string,
// which is what every struct failure already is.
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

// The spec tree with every `$OPEN` marker removed, so an undeclared key is an
// error rather than a pass. Rebuilt rather than mutated: `Value` is Rc-backed
// and `core::schema::entityspec()` hands out the process-wide constant.
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
