// EJECT-START

pub fn load(self: *EntyClass, reqmatch: Value, ctrl: Value) EntResult {
    return self.load_with(reqmatch, ctrl, .{});
}

pub fn load_with(self: *EntyClass, reqmatch: Value, ctrl: Value, opwith: binmod.OpWith) EntResult {
    const ctx = self.utility.make_context(CtxSpec{
        .opname = "load",
        .ctrl = ctrl,
        .mtch = self.mtch,
        .data = self.data,
        .reqmatch = reqmatch,
        .sources = opwith.sources,
        .transfer = opwith.transfer,
    }, self.ent_ctx());
    return self.run_op_ent(ctx, load_post_done);
}

fn load_post_done(self: *EntyClass, ctx: *Context) void {
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
