use std::rc::Rc;

use crate::core::context::Context;

pub fn prepare_method_util(ctx: &Rc<Context>) -> String {
    let opname = ctx.op.borrow().name.clone();

    match opname.as_str() {
        "create" => "POST",
        "update" => "PUT",
        "load" => "GET",
        "list" => "GET",
        "remove" => "DELETE",
        "patch" => "PATCH",
        _ => "GET",
    }
    .to_string()
}
