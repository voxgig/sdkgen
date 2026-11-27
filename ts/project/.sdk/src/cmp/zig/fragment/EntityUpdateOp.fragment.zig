// EJECT-START

pub fn update(self: *EntyClass, reqdata: Value, ctrl: Value) EntResult {
    return self.update_with(reqdata, ctrl, .{});
}

pub fn update_with(self: *EntyClass, reqdata: Value, ctrl: Value, opwith: binmod.OpWith) EntResult {
    const ctx = self.utility.make_context(CtxSpec{
        .opname = "update",
        .ctrl = ctrl,
        .mtch = self.mtch,
        .data = self.data,
        .reqdata = reqdata,
        .sources = opwith.sources,
        .transfer = opwith.transfer,
    }, self.ent_ctx());
    return self.run_op_ent(ctx, update_post_done);
}

fn update_post_done(self: *EntyClass, ctx: *Context) void {
    if (ctx.result) |result| {
        const resmatch = result.resmatch;
        const resdata = result.resdata;
        if (resmatch == .object) self.mtch = resmatch;
        if (!h.is_noval(resdata)) {
            const cm = h.to_map(h.clone(resdata));
            self.data = if (cm == .object) cm else h.omap();
        }
    }
}

// EJECT-END
