// EJECT-START

fn create(&self, reqdata: Value, ctrl: Value) -> Result<Value, ProjectNameError> {
    let ctx = self.utility.make_context(
        CtxSpec {
            opname: Some("create".to_string()),
            ctrl: Some(ctrl),
            mtch: Some(self.mtch.borrow().clone()),
            data: Some(self.data.borrow().clone()),
            reqdata: Some(reqdata),
            ..Default::default()
        },
        Some(&self.ent_ctx()),
    );

    self.run_op(&ctx, &|ctx| {
        if let Some(result) = ctx.result.borrow().clone() {
            let resdata = result.borrow().resdata.clone();
            if !resdata.is_noval() && !resdata.is_null() {
                *self.data.borrow_mut() = match to_map(&vs::clone(&resdata)) {
                    Value::Map(m) => Value::Map(m),
                    _ => Value::empty_map(),
                };
            }
        }
    })
}

// EJECT-END
