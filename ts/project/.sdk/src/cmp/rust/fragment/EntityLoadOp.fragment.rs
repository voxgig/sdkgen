// EJECT-START

fn load(&self, reqmatch: Value, ctrl: Value) -> Result<Value, ProjectNameError> {
    let ctx = self.utility.make_context(
        CtxSpec {
            opname: Some("load".to_string()),
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
            let (resmatch, resdata) = {
                let r = result.borrow();
                (r.resmatch.clone(), r.resdata.clone())
            };
            if let Value::Map(_) = resmatch {
                *self.mtch.borrow_mut() = resmatch;
            }
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
