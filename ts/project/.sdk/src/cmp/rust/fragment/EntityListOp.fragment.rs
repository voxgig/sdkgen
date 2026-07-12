// EJECT-START

fn list(&self, reqmatch: Value, ctrl: Value) -> Result<Value, ProjectNameError> {
    let ctx = self.utility.make_context(
        CtxSpec {
            opname: Some("list".to_string()),
            ctrl: Some(ctrl),
            mtch: Some(self.mtch.borrow().clone()),
            data: Some(self.data.borrow().clone()),
            reqmatch: Some(reqmatch),
            ..Default::default()
        },
        Some(&self.ent_ctx()),
    );

    self.run_op(&ctx, &|ctx| {
        if let Some(result) = ctx.result.borrow().clone() {
            let resmatch = result.borrow().resmatch.clone();
            if let Value::Map(_) = resmatch {
                *self.mtch.borrow_mut() = resmatch;
            }
        }
    })
}

// EJECT-END
