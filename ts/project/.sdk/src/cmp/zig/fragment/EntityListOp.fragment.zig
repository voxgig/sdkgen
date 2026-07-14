// EJECT-START

pub fn list(self: *EntyClass, reqmatch: Value, ctrl: Value) OpResult {
    const ctx = self.utility.make_context(CtxSpec{
        .opname = "list",
        .ctrl = ctrl,
        .mtch = self.mtch,
        .data = self.data,
        .reqmatch = reqmatch,
    }, self.ent_ctx());
    return self.run_op(ctx, list_post_done);
}

fn list_post_done(self: *EntyClass, ctx: *Context) void {
    if (ctx.result) |result| {
        const resmatch = result.resmatch;
        if (resmatch == .object) self.mtch = resmatch;
    }
}

// EJECT-END
