// EntityName entity client (generated — mirrors the go/rust Entity fragment).

const std = @import("std");
const vs = @import("voxgig-struct");
const h = @import("../core/helpers.zig");
const errmod = @import("../core/error.zig");
const types = @import("../core/types.zig");
const ctxmod = @import("../core/context.zig");
const utility_mod = @import("../core/utility.zig");
const sdk = @import("../core/sdk.zig");

const Value = h.Value;
const Context = ctxmod.Context;
const CtxSpec = ctxmod.CtxSpec;
const Utility = utility_mod.Utility;
const OpResult = types.OpResult;
const OutVal = types.OutVal;
const Entity = types.Entity;

pub const EntyClass = struct {
    name: []const u8 = "entityname",
    client: *sdk.ProjectNameSDK,
    utility: *Utility,
    entopts: Value,
    data: Value,
    mtch: Value,
    entctx: ?*Context = null,

    pub fn new(client: *sdk.ProjectNameSDK, entopts_in: Value) *EntyClass {
        const entopts: Value = switch (entopts_in) {
            .object => entopts_in,
            else => h.omap(),
        };
        const act = h.get_bool(entopts, "active");
        if (act == null) {
            h.setp(entopts, "active", h.vbool(true));
        } else if (act.? != false) {
            h.setp(entopts, "active", h.vbool(true));
        }

        const e = h.A().create(EntyClass) catch unreachable;
        e.* = .{
            .name = "entityname",
            .client = client,
            .utility = client.get_utility(),
            .entopts = entopts,
            .data = h.omap(),
            .mtch = h.omap(),
            .entctx = null,
        };

        const entctx = e.utility.make_context(CtxSpec{
            .entity = e.asEntity(),
            .entopts = entopts,
        }, client.get_root_ctx());

        e.utility.feature_hook(entctx, "PostConstructEntity");
        e.entctx = entctx;
        return e;
    }

    fn ent_ctx(self: *EntyClass) *Context {
        return self.entctx orelse unreachable;
    }

    fn opError(self: *EntyClass, ctx: *Context) OpResult {
        const v = self.utility.make_error(ctx) catch return .{ .err = ctx.pending_err.? };
        return .{ .ok = v };
    }

    fn doneResult(self: *EntyClass, ctx: *Context) OpResult {
        const v = self.utility.done(ctx) catch return .{ .err = ctx.pending_err.? };
        return .{ .ok = v };
    }

    fn run_op(self: *EntyClass, ctx: *Context, post_done: *const fn (*EntyClass, *Context) void) OpResult {
        const utility = self.utility;

        // #PrePoint-Hook

        const point = utility.make_point(ctx) catch return self.opError(ctx);
        ctx.out_set("point", OutVal{ .val = point });

        // #PreSpec-Hook

        const spec = utility.make_spec(ctx) catch return self.opError(ctx);
        ctx.out_set("spec", OutVal{ .spec = spec });

        // #PreRequest-Hook

        const resp = utility.make_request(ctx) catch return self.opError(ctx);
        ctx.out_set("request", OutVal{ .response = resp });

        // #PreResponse-Hook

        const resp2 = utility.make_response(ctx) catch return self.opError(ctx);
        ctx.out_set("response", OutVal{ .response = resp2 });

        // #PreResult-Hook

        const result = utility.make_result(ctx) catch return self.opError(ctx);
        ctx.out_set("result", OutVal{ .result = result });

        // #PreDone-Hook

        post_done(self, ctx);

        return self.doneResult(ctx);
    }

    // ---- Entity interface ----

    fn e_of(p: *anyopaque) *EntyClass {
        return @ptrCast(@alignCast(p));
    }
    fn v_get_name(p: *anyopaque) []const u8 {
        return e_of(p).name;
    }
    fn v_make(p: *anyopaque) Entity {
        const self = e_of(p);
        const opts = h.omap();
        if (self.entopts == .object) {
            var it = self.entopts.object.iterator();
            while (it.next()) |kv| h.setp(opts, kv.key_ptr.*, kv.value_ptr.*);
        }
        return EntyClass.new(self.client, opts).asEntity();
    }
    fn v_data(p: *anyopaque, args: ?Value) Value {
        return e_of(p).data_impl(args);
    }
    fn v_matchv(p: *anyopaque, args: ?Value) Value {
        return e_of(p).matchv_impl(args);
    }

    const entity_vtable = Entity.VTable{
        .get_name = v_get_name,
        .make = v_make,
        .data = v_data,
        .matchv = v_matchv,
    };

    pub fn asEntity(self: *EntyClass) Entity {
        return .{ .ptr = @ptrCast(self), .vtable = &entity_vtable };
    }

    fn data_impl(self: *EntyClass, args: ?Value) Value {
        if (args) |arg| {
            if (!h.is_noval(arg)) {
                const cloned = h.to_map(h.clone(arg));
                self.data = switch (cloned) {
                    .object => cloned,
                    else => h.omap(),
                };
                self.utility.feature_hook(self.ent_ctx(), "SetData");
            }
        }
        self.utility.feature_hook(self.ent_ctx(), "GetData");
        return h.clone(self.data);
    }

    fn matchv_impl(self: *EntyClass, args: ?Value) Value {
        if (args) |arg| {
            if (!h.is_noval(arg)) {
                const cloned = h.to_map(h.clone(arg));
                self.mtch = switch (cloned) {
                    .object => cloned,
                    else => h.omap(),
                };
                self.utility.feature_hook(self.ent_ctx(), "SetMatch");
            }
        }
        self.utility.feature_hook(self.ent_ctx(), "GetMatch");
        return h.clone(self.mtch);
    }

    // ---- CRUD operations ----

    // #LoadOp

    // #ListOp

    // #CreateOp

    // #UpdateOp

    // #RemoveOp
};
