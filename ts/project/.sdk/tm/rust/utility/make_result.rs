use std::cell::RefCell;
use std::rc::Rc;

use crate::core::context::Context;
use crate::core::error::ProjectNameError;
use crate::core::helpers::setp;
use crate::core::result::SdkResult;
use crate::core::types::OutVal;
use crate::utility::voxgigstruct::Value;

pub fn make_result_util(
    ctx: &Rc<Context>,
) -> Result<Rc<RefCell<SdkResult>>, ProjectNameError> {
    if let Some(OutVal::Result(res)) = ctx.out_get("result") {
        return Ok(res);
    }

    let op = ctx.op.borrow().clone();
    let entity = ctx.entity.borrow().clone();
    let spec = ctx.spec.borrow().clone().ok_or_else(|| {
        ctx.make_error("result_no_spec", "Expected context spec property to be defined.")
    })?;
    let result = ctx.result.borrow().clone().ok_or_else(|| {
        ctx.make_error("result_no_result", "Expected context result property to be defined.")
    })?;

    spec.borrow_mut().step = "result".to_string();

    crate::utility::transform_response::transform_response_util(ctx);

    // Every operation resolves to PLAIN records — load, create, update and
    // list alike. `list` used to be the outlier: it wrapped each record in
    // an entity instance, so the same record came back with a different
    // type, a different key order and an extra marker depending on which
    // call produced it. Any consumer touching both paths had to normalise
    // defensively, and feeding a wrapped record into a host framework's own
    // metadata silently produced wrong entities with no error at all. A
    // missing or empty list still normalises to an empty list.
    if op.name == "list" {
        let resdata = result.borrow().resdata.clone();
        result.borrow_mut().resdata = match &resdata {
            Value::List(_) => resdata.clone(),
            _ => Value::empty_list(),
        };
    }

    {
        let ctrl = ctx.ctrl.borrow().clone();
        let c = ctrl.borrow();
        if c.has_explain() {
            setp(&c.explain, "result", result.borrow().to_value());
        }
    }

    Ok(result)
}
