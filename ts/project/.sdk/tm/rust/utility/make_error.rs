use std::cell::RefCell;
use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::ProjectNameError;
use crate::core::helpers::{jo, setp};
use crate::core::result::SdkResult;
use crate::utility::voxgigstruct::Value;

pub fn make_error_util(
    ctx: &Rc<Context>,
    err: Option<ProjectNameError>,
) -> Result<Value, ProjectNameError> {
    let op = ctx.op.borrow().clone();
    let mut opname = op.name.clone();
    if opname.is_empty() || opname == "_" {
        opname = "unknown operation".to_string();
    }

    let result = match ctx.result.borrow().clone() {
        Some(r) => r,
        None => {
            let r = Rc::new(RefCell::new(SdkResult::new(&Value::empty_map())));
            *ctx.result.borrow_mut() = Some(r.clone());
            r
        }
    };
    result.borrow_mut().ok = false;

    let err = err
        .or_else(|| result.borrow().err.clone())
        .unwrap_or_else(|| ctx.make_error("unknown", "unknown error"));

    let errmsg = err.msg.clone();
    let msg = format!("ProjectNameSDK: {}: {}", opname, errmsg);
    let msg = crate::utility::clean::clean_str(ctx, &msg);

    result.borrow_mut().err = None;

    let spec_val = match ctx.spec.borrow().clone() {
        Some(s) => s.borrow().to_value(),
        None => Value::Noval,
    };

    let ctrl = ctx.ctrl.borrow().clone();
    {
        let c = ctrl.borrow();
        if c.has_explain() {
            setp(
                &c.explain,
                "err",
                jo(vec![("message", Value::str(msg.clone()))]),
            );
        }
    }

    let mut sdk_err = ProjectNameError::new("", &msg);
    sdk_err.code = err.code.clone();
    sdk_err.result = crate::utility::clean::clean_util(ctx, &result.borrow().to_value());
    sdk_err.spec = crate::utility::clean::clean_util(ctx, &spec_val);

    ctrl.borrow_mut().err = Some(sdk_err.clone());

    if ctrl.borrow().throw == Some(false) {
        return Ok(result.borrow().resdata.clone());
    }

    Err(sdk_err)
}
