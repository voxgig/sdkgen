// EJECT-START

pub fn create(self: *EntyClass, reqdata: Value, ctrl: Value) EntResult {
    return self.create_with(reqdata, ctrl, .{});
}

pub fn create_with(self: *EntyClass, reqdata: Value, ctrl: Value, opwith: binmod.OpWith) EntResult {
    const ctx = self.utility.make_context(CtxSpec{
        .opname = "create",
        .ctrl = ctrl,
        .mtch = self.mtch,
        .data = self.data,
        .reqdata = reqdata,
        .sources = opwith.sources,
        .transfer = opwith.transfer,
    }, self.ent_ctx());
    return self.run_op_ent(ctx, create_post_done);
}

fn create_post_done(self: *EntyClass, ctx: *Context) void {
    if (ctx.result) |result| {
        const resdata = result.resdata;
        if (!h.is_noval(resdata)) {
            const cm = h.to_map(h.clone(resdata));
            self.data = if (cm == .object) cm else h.omap();
        }
    }
}

// EJECT-END
