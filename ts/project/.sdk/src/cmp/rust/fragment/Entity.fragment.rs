// EntityName entity client (generated — mirrors the go Entity fragment).

// Ops present vary per entity, so some shared imports may go unused.
#![allow(unused_imports)]

use std::cell::RefCell;
use std::rc::Rc;

use crate::core::context::{Context, CtxSpec};
use crate::core::error::ProjectNameError;
use crate::core::helpers::{get_bool, getp, setp, to_map};
use crate::core::sdk::ProjectNameSDK;
use crate::core::types::{Entity, ProjectNameEntity};
use crate::core::utility_type::Utility;
use crate::utility::voxgigstruct as vs;
use crate::utility::voxgigstruct::Value;

pub struct EntyClass {
    name: String,
    #[allow(dead_code)]
    client: Rc<ProjectNameSDK>,
    utility: Rc<Utility>,
    entopts: Value,
    data: RefCell<Value>,
    mtch: RefCell<Value>,
    entctx: RefCell<Option<Rc<Context>>>,
}

impl EntyClass {
    pub fn new(client: &Rc<ProjectNameSDK>, entopts: Value) -> Rc<EntyClass> {
        let entopts = match entopts {
            Value::Map(m) => Value::Map(m),
            _ => Value::empty_map(),
        };
        if get_bool(&entopts, "active").is_none() {
            setp(&entopts, "active", Value::Bool(true));
        } else if get_bool(&entopts, "active") != Some(false) {
            setp(&entopts, "active", Value::Bool(true));
        }

        let e = Rc::new(EntyClass {
            name: "entityname".to_string(),
            client: client.clone(),
            utility: client.get_utility(),
            entopts: entopts.clone(),
            data: RefCell::new(Value::empty_map()),
            mtch: RefCell::new(Value::empty_map()),
            entctx: RefCell::new(None),
        });

        let entctx = e.utility.make_context(
            CtxSpec {
                entity: Some(e.clone() as Rc<dyn Entity>),
                entopts: Some(entopts),
                ..Default::default()
            },
            Some(&client.get_root_ctx()),
        );

        e.utility.feature_hook(&entctx, "PostConstructEntity");

        *e.entctx.borrow_mut() = Some(entctx);

        e
    }

    fn ent_ctx(&self) -> Rc<Context> {
        self.entctx
            .borrow()
            .clone()
            .expect("entity context not initialised")
    }

    fn run_op(
        &self,
        ctx: &Rc<Context>,
        post_done: &dyn Fn(&Rc<Context>),
    ) -> Result<Value, ProjectNameError> {
        let utility = &self.utility;

        // #PrePoint-Hook

        let point = match utility.make_point(ctx) {
            Ok(p) => p,
            Err(err) => return utility.make_error(ctx, Some(err)),
        };
        ctx.out_set("point", crate::core::types::OutVal::Val(point));

        // #PreSpec-Hook

        let spec = match utility.make_spec(ctx) {
            Ok(s) => s,
            Err(err) => return utility.make_error(ctx, Some(err)),
        };
        ctx.out_set("spec", crate::core::types::OutVal::Spec(spec));

        // #PreRequest-Hook

        let resp = match utility.make_request(ctx) {
            Ok(r) => r,
            Err(err) => return utility.make_error(ctx, Some(err)),
        };
        ctx.out_set("request", crate::core::types::OutVal::Response(resp));

        // #PreResponse-Hook

        let resp2 = match utility.make_response(ctx) {
            Ok(r) => r,
            Err(err) => return utility.make_error(ctx, Some(err)),
        };
        ctx.out_set("response", crate::core::types::OutVal::Response(resp2));

        // #PreResult-Hook

        let result = match utility.make_result(ctx) {
            Ok(r) => r,
            Err(err) => return utility.make_error(ctx, Some(err)),
        };
        ctx.out_set("result", crate::core::types::OutVal::Result(result));

        // #PreDone-Hook

        post_done(ctx);

        utility.done(ctx)
    }
}

impl Entity for EntyClass {
    fn get_name(&self) -> String {
        self.name.clone()
    }

    fn make(&self) -> Rc<dyn Entity> {
        let opts = Value::empty_map();
        if let Value::Map(m) = &self.entopts {
            for (k, v) in m.borrow().iter() {
                setp(&opts, k, v.clone());
            }
        }
        EntyClass::new(&self.client, opts) as Rc<dyn Entity>
    }

    fn data(&self, args: Option<&Value>) -> Value {
        if let Some(arg) = args {
            if !arg.is_noval() && !arg.is_null() {
                let cloned = to_map(&vs::clone(arg));
                *self.data.borrow_mut() = match cloned {
                    Value::Map(m) => Value::Map(m),
                    _ => Value::empty_map(),
                };
                self.utility.feature_hook(&self.ent_ctx(), "SetData");
            }
        }

        self.utility.feature_hook(&self.ent_ctx(), "GetData");
        vs::clone(&self.data.borrow())
    }

    fn matchv(&self, args: Option<&Value>) -> Value {
        if let Some(arg) = args {
            if !arg.is_noval() && !arg.is_null() {
                let cloned = to_map(&vs::clone(arg));
                *self.mtch.borrow_mut() = match cloned {
                    Value::Map(m) => Value::Map(m),
                    _ => Value::empty_map(),
                };
                self.utility.feature_hook(&self.ent_ctx(), "SetMatch");
            }
        }

        self.utility.feature_hook(&self.ent_ctx(), "GetMatch");
        vs::clone(&self.mtch.borrow())
    }
}

impl ProjectNameEntity for EntyClass {
    // #LoadOp

    // #ListOp

    // #CreateOp

    // #UpdateOp

    // #RemoveOp
}
