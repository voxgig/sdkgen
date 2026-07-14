// The Utility bundle + the operation-pipeline builders (mirrors go
// core/utility_type.go + tm/go/utility, and rust core/utility_type.rs +
// utility/*.rs). Go carries the utilities as swappable function pointers;
// here they are free functions, and the two members that genuinely vary per
// client stay swappable: the transport (`fetcher`, wrapped by
// retry/cache/netsim/proxy) and the `custom` map of caller-supplied
// callables.

const std = @import("std");
const vs = @import("voxgig-struct");
const h = @import("helpers.zig");
const err = @import("error.zig");
const types = @import("types.zig");
const ctxmod = @import("context.zig");
const control_mod = @import("control.zig");
const spec_mod = @import("spec.zig");
const response_mod = @import("response.zig");
const result_mod = @import("result.zig");
const operation_mod = @import("operation.zig");
const jsonparse = @import("../utility/jsonparse.zig");
const sdk = @import("sdk.zig");

const Value = h.Value;
const Context = ctxmod.Context;
const CtxSpec = ctxmod.CtxSpec;
const Spec = spec_mod.Spec;
const Response = response_mod.Response;
const SdkResult = result_mod.SdkResult;
const OutVal = types.OutVal;
const Feature = types.Feature;
const Fetcher = types.Fetcher;
const E = err.E;

fn fmt(comptime f: []const u8, args: anytype) []const u8 {
    return std.fmt.allocPrint(h.A(), f, args) catch "";
}

// ============================================================================
// Utility bundle
// ============================================================================

var fetch_dummy: u8 = 0;

pub const Utility = struct {
    fetcher: Fetcher,
    custom: Value,

    pub fn new() *Utility {
        const u = h.A().create(Utility) catch unreachable;
        u.* = .{
            .fetcher = .{ .ctx = @ptrCast(&fetch_dummy), .call = defaultFetcherCall },
            .custom = h.omap(),
        };
        return u;
    }

    // A fresh view sharing the (possibly feature-wrapped) fetcher, with a
    // shallow copy of the custom map.
    pub fn copy(src: *Utility) *Utility {
        const u = h.A().create(Utility) catch unreachable;
        const custom = h.omap();
        if (src.custom == .object) {
            var it = src.custom.object.iterator();
            while (it.next()) |kv| h.setp(custom, kv.key_ptr.*, kv.value_ptr.*);
        }
        u.* = .{ .fetcher = src.fetcher, .custom = custom };
        return u;
    }

    pub fn fetch(self: *Utility, ctx: *Context, url: []const u8, fetchdef: Value) E!Value {
        return self.fetcher.invoke(ctx, url, fetchdef);
    }

    pub fn clean(self: *Utility, ctx: *Context, val: Value) Value {
        _ = self;
        return clean_util(ctx, val);
    }
    pub fn done(self: *Utility, ctx: *Context) E!Value {
        _ = self;
        return done_util(ctx);
    }
    pub fn make_error(self: *Utility, ctx: *Context) E!Value {
        _ = self;
        return make_error_util(ctx);
    }
    pub fn feature_add(self: *Utility, ctx: *Context, f: Feature) void {
        _ = self;
        feature_add_util(ctx, f);
    }
    pub fn feature_hook(self: *Utility, ctx: *Context, name: []const u8) void {
        _ = self;
        feature_hook_util(ctx, name);
    }
    pub fn feature_init(self: *Utility, ctx: *Context, f: Feature) void {
        _ = self;
        feature_init_util(ctx, f);
    }
    pub fn make_fetch_def(self: *Utility, ctx: *Context) E!Value {
        _ = self;
        return make_fetch_def_util(ctx);
    }
    pub fn make_context(self: *Utility, ctxspec: CtxSpec, basectx: ?*Context) *Context {
        _ = self;
        return Context.new(ctxspec, basectx);
    }
    pub fn make_options(self: *Utility, ctx: *Context) Value {
        _ = self;
        return make_options_util(ctx);
    }
    pub fn make_request(self: *Utility, ctx: *Context) E!*Response {
        _ = self;
        return make_request_util(ctx);
    }
    pub fn make_response(self: *Utility, ctx: *Context) E!*Response {
        _ = self;
        return make_response_util(ctx);
    }
    pub fn make_result(self: *Utility, ctx: *Context) E!*SdkResult {
        _ = self;
        return make_result_util(ctx);
    }
    pub fn make_point(self: *Utility, ctx: *Context) E!Value {
        _ = self;
        return make_point_util(ctx);
    }
    pub fn make_spec(self: *Utility, ctx: *Context) E!*Spec {
        _ = self;
        return make_spec_util(ctx);
    }
    pub fn make_url(self: *Utility, ctx: *Context) E![]const u8 {
        _ = self;
        return make_url_util(ctx);
    }
    pub fn param(self: *Utility, ctx: *Context, paramdef: Value) Value {
        _ = self;
        return param_util(ctx, paramdef);
    }
    pub fn prepare_auth(self: *Utility, ctx: *Context) E!*Spec {
        _ = self;
        return prepare_auth_util(ctx);
    }
    pub fn prepare_headers(self: *Utility, ctx: *Context) Value {
        _ = self;
        return prepare_headers_util(ctx);
    }
};

// ============================================================================
// clean / done / make_error
// ============================================================================

pub fn clean_util(ctx: *Context, val: Value) Value {
    _ = ctx;
    return val;
}
pub fn clean_str(ctx: *Context, val: []const u8) []const u8 {
    _ = ctx;
    return val;
}

pub fn done_util(ctx: *Context) E!Value {
    {
        const c = ctx.ctrl;
        if (c.has_explain()) {
            const explain = clean_util(ctx, c.explain);
            if (h.getp(explain, "result") == .object) {
                const rm = h.to_map(h.getp(explain, "result"));
                h.del_prop(rm, h.vstr("err"));
            }
            c.explain = explain;
        }
    }

    if (ctx.result) |res| {
        if (res.ok) return res.resdata;
    }

    return make_error_util(ctx);
}

pub fn make_error_util(ctx: *Context) E!Value {
    const in_err = ctx.take_err();

    const op = ctx.op;
    var opname = op.name;
    if (opname.len == 0 or std.mem.eql(u8, opname, "_")) opname = "unknown operation";

    const result: *SdkResult = ctx.result orelse blk: {
        const r = SdkResult.make(h.omap());
        ctx.result = r;
        break :blk r;
    };
    result.ok = false;

    const the_err: *err.ProjectNameError = in_err orelse (result.err orelse ctx.make_error("unknown", "unknown error"));

    const errmsg = the_err.msg;
    const msg0 = fmt("ProjectNameSDK: {s}: {s}", .{ opname, errmsg });
    const msg = clean_str(ctx, msg0);

    result.err = null;

    const spec_val: Value = if (ctx.spec) |s| s.to_value() else h.vnull();

    const c = ctx.ctrl;
    if (c.has_explain()) {
        h.setp(c.explain, "err", h.jo(&.{.{ "message", h.vstr(msg) }}));
    }

    const sdk_err = err.ProjectNameError.make("", msg);
    sdk_err.code = the_err.code;
    sdk_err.result = clean_util(ctx, result.to_value());
    sdk_err.spec = clean_util(ctx, spec_val);

    c.err = sdk_err;

    // Fire PreUnexpected so observability features (metrics, telemetry, audit,
    // debug) close/record error paths that never reach PreDone (e.g. a PrePoint
    // rbac short-circuit). Fires after ctrl.err is set so hooks can read the
    // error; features guard against double-recording when PreDone already fired.
    feature_hook_util(ctx, "PreUnexpected");

    if (c.throw != null and c.throw.? == false) {
        return result.resdata;
    }

    return ctx.fail_err(sdk_err);
}

// ============================================================================
// feature add / hook / init
// ============================================================================

pub fn feature_add_util(ctx: *Context, f: Feature) void {
    const client = ctx.client orelse return;
    const fopts = f.add_options();
    if (fopts == .object) {
        const before = h.get_str(fopts, "__before__") orelse "";
        const after = h.get_str(fopts, "__after__") orelse "";
        const replace = h.get_str(fopts, "__replace__") orelse "";
        if (before.len != 0 or after.len != 0 or replace.len != 0) {
            const feats = &client.features;
            var i: usize = 0;
            while (i < feats.items.len) : (i += 1) {
                const nm = feats.items[i].name();
                if (before.len != 0 and std.mem.eql(u8, before, nm)) {
                    feats.insert(i, f) catch {};
                    return;
                }
                if (after.len != 0 and std.mem.eql(u8, after, nm)) {
                    feats.insert(i + 1, f) catch {};
                    return;
                }
                if (replace.len != 0 and std.mem.eql(u8, replace, nm)) {
                    feats.items[i] = f;
                    return;
                }
            }
        }
    }
    client.features.append(f) catch {};
}

pub fn feature_hook_util(ctx: *Context, name: []const u8) void {
    const client = ctx.client orelse return;
    // Snapshot so a hook that mutates the feature set is safe to iterate.
    var snap = std.ArrayList(Feature).init(h.A());
    for (client.features.items) |f| snap.append(f) catch {};
    for (snap.items) |f| f.dispatch(name, ctx);
}

pub fn feature_init_util(ctx: *Context, f: Feature) void {
    const fname = f.name();
    var fopts = h.omap();
    const options = ctx.options;
    if (options == .object) {
        const feature_opts = h.to_map(h.getp(options, "feature"));
        if (feature_opts == .object) {
            const fo = h.to_map(h.getp(feature_opts, fname));
            if (fo == .object) fopts = fo;
        }
    }
    if (h.get_bool(fopts, "active") orelse false) {
        f.callInit(ctx, fopts);
    }
}

// ============================================================================
// make_options
// ============================================================================

fn mo_str_less(_: void, a: []const u8, b: []const u8) bool {
    return std.mem.order(u8, a, b) == .lt;
}

pub fn make_options_util(ctx: *Context) Value {
    const options: Value = switch (ctx.options) {
        .object => ctx.options,
        else => h.omap(),
    };

    // Merge custom utility overrides onto the utility object (function values
    // are shared by reference — gotcha #8).
    const custom_utils = h.to_map(h.getp(options, "utility"));
    if (custom_utils == .object) {
        if (ctx.utility) |utility| {
            const custom = utility.custom;
            var it = custom_utils.object.iterator();
            while (it.next()) |kv| h.setp(custom, kv.key_ptr.*, kv.value_ptr.*);
        }
    }

    var opts = h.clone(options);

    // Feature add-order. options.feature may be an ordered list of
    // { name, active, ...opts } entries (the list position IS the order in
    // which features are added), or a { name: {opts} } map. Normalize a list
    // to a map (so merge/validate are unchanged) and remember the explicit
    // order; a map defaults to test-first so the `test` mock transport is
    // installed as the base of the transport wrapper chain.
    const feature_order = h.olist();
    const raw_feature = h.getp(opts, "feature");
    if (raw_feature == .array) {
        const fmap = h.omap();
        for (raw_feature.array.data.items) |entry| {
            if (entry == .object) {
                if (h.get_str(entry, "name")) |nm| {
                    const fopts = h.clone(entry);
                    h.del_prop(fopts, h.vstr("name"));
                    h.setp(fmap, nm, fopts);
                    feature_order.array.append(h.vstr(nm)) catch {};
                }
            }
        }
        h.setp(opts, "feature", fmap);
    }

    const config = ctx.config;
    const cfgopts: Value = switch (h.to_map(h.getp(config, "options"))) {
        .object => h.to_map(h.getp(config, "options")),
        else => h.omap(),
    };

    const optspec = h.jo(&.{
        .{ "apikey", h.vstr("") },
        .{ "base", h.vstr("http://localhost:8000") },
        .{ "prefix", h.vstr("") },
        .{ "suffix", h.vstr("") },
        .{ "auth", h.jo(&.{.{ "prefix", h.vstr("") }}) },
        .{ "headers", h.jo(&.{.{ "`$CHILD`", h.vstr("`$STRING`") }}) },
        .{ "allow", h.jo(&.{
            .{ "method", h.vstr("GET,PUT,POST,PATCH,DELETE,OPTIONS") },
            .{ "op", h.vstr("create,update,load,list,remove,command,direct") },
        }) },
        .{ "entity", h.jo(&.{.{ "`$CHILD`", h.jo(&.{
            .{ "`$OPEN`", h.vbool(true) },
            .{ "active", h.vbool(false) },
            .{ "alias", h.omap() },
        }) }}) },
        .{ "feature", h.jo(&.{.{ "`$CHILD`", h.jo(&.{
            .{ "`$OPEN`", h.vbool(true) },
            .{ "active", h.vbool(false) },
        }) }}) },
        .{ "utility", h.omap() },
        .{ "system", h.omap() },
        .{ "test", h.jo(&.{
            .{ "active", h.vbool(false) },
            .{ "entity", h.jo(&.{.{ "`$OPEN`", h.vbool(true) }}) },
        }) },
        .{ "clean", h.jo(&.{.{ "keys", h.vstr("key,token,id") }}) },
    });

    // Preserve system.fetch before merge/validate (validation strips it).
    const sys_fetch = h.getpath(&.{ "system", "fetch" }, opts);

    const merged = vs.merge(h.A(), h.ja(&.{ h.omap(), cfgopts, opts }), vs.MAXDEPTH) catch opts;
    const vres = vs.validate(h.A(), merged, optspec) catch null;
    if (vres) |vr| {
        if (vr.err == null and vr.out == .object) opts = vr.out;
    }

    // Restore system.fetch.
    if (!h.is_noval(sys_fetch)) {
        const sysv = h.getp(opts, "system");
        if (sysv == .object) {
            h.setp(sysv, "fetch", sys_fetch);
        } else {
            h.setp(opts, "system", h.jo(&.{.{ "fetch", sys_fetch }}));
        }
    }

    // Derived clean config.
    const clean_keys: []const u8 = switch (h.getpath(&.{ "clean", "keys" }, opts)) {
        .string => |s| s,
        else => "key,token,id",
    };

    var parts = std.ArrayList([]const u8).init(h.A());
    var it = std.mem.splitScalar(u8, clean_keys, ',');
    while (it.next()) |p| {
        const t = std.mem.trim(u8, p, " \t");
        if (t.len != 0) parts.append(h.esc_re(t)) catch {};
    }
    const keyre = std.mem.join(h.A(), "|", parts.items) catch "";

    // Resolve the feature add-order: an explicit list order (above) wins;
    // otherwise order the map test-first, then the remaining names sorted, so
    // the outcome is deterministic and `test` is always the base transport.
    if (feature_order.array.data.items.len == 0) {
        const fmapv = h.getp(opts, "feature");
        if (fmapv == .object) {
            var names = std.ArrayList([]const u8).init(h.A());
            var nit = fmapv.object.iterator();
            while (nit.next()) |kv| names.append(kv.key_ptr.*) catch {};
            std.mem.sort([]const u8, names.items, {}, mo_str_less);
            var has_test = false;
            for (names.items) |nm| {
                if (std.mem.eql(u8, nm, "test")) has_test = true;
            }
            if (has_test) feature_order.array.append(h.vstr("test")) catch {};
            for (names.items) |nm| {
                if (!std.mem.eql(u8, nm, "test")) feature_order.array.append(h.vstr(nm)) catch {};
            }
        }
    }

    const derived_clean = if (keyre.len == 0) h.omap() else h.jo(&.{.{ "keyre", h.vstr(keyre) }});
    h.setp(opts, "__derived__", h.jo(&.{
        .{ "clean", derived_clean },
        .{ "featureorder", feature_order },
    }));

    return opts;
}

// ============================================================================
// make_point (gotcha #2: rbac PrePoint short-circuit)
// ============================================================================

pub fn make_point_util(ctx: *Context) E!Value {
    if (ctx.out_get("point")) |ov| {
        switch (ov) {
            .err => |e| return ctx.fail_err(e),
            .val => |v| {
                if (v == .object) {
                    ctx.point = v;
                    return v;
                }
            },
            else => {},
        }
    }

    const op = ctx.op;
    const options = ctx.options;

    const allow_op: []const u8 = switch (h.getpath(&.{ "allow", "op" }, options)) {
        .string => |s| s,
        else => "",
    };
    if (std.mem.indexOf(u8, allow_op, op.name) == null) {
        return ctx.fail("point_op_allow", fmt("Operation \"{s}\" not allowed by SDK option allow.op value: \"{s}\"", .{ op.name, allow_op }));
    }

    const points = op.points;
    const plen = h.sizeOf(points);

    if (plen == 0) {
        return ctx.fail("point_no_points", fmt("Operation \"{s}\" has no endpoint definitions.", .{op.name}));
    }

    if (plen == 1) {
        ctx.point = h.get_elem(points, h.vnum(0), h.vnull());
    } else {
        const reqselector: Value = if (std.mem.eql(u8, op.input, "data")) ctx.reqdata else ctx.reqmatch;
        const selector: Value = if (std.mem.eql(u8, op.input, "data")) ctx.data else ctx.mtch;

        var point: Value = h.vnull();
        var i: i64 = 0;
        while (i < plen) : (i += 1) {
            point = h.get_elem(points, h.vnum(i), h.vnull());
            const select_def = h.to_map(h.getp(point, "select"));
            var found = true;

            if (!h.is_noval(selector) and !h.is_noval(select_def)) {
                const exist = h.getp(select_def, "exist");
                if (exist == .array) {
                    for (exist.array.data.items) |ek| {
                        if (ek == .string) {
                            const existkey = ek.string;
                            const rv = h.getp(reqselector, existkey);
                            const sv = h.getp(selector, existkey);
                            if (h.is_noval(rv) and h.is_noval(sv)) {
                                found = false;
                                break;
                            }
                        }
                    }
                }
            }

            if (found) {
                const req_action = h.getp(reqselector, "$action");
                const select_action = h.getp(select_def, "$action");
                if (!h.veq(req_action, select_action)) found = false;
            }

            if (found) break;
        }

        const req_action = h.getp(reqselector, "$action");
        if (!h.is_noval(req_action) and !h.is_noval(point)) {
            const point_select = h.to_map(h.getp(point, "select"));
            const point_action = h.getp(point_select, "$action");
            if (!h.veq(req_action, point_action)) {
                return ctx.fail("point_action_invalid", fmt("Operation \"{s}\" action \"{s}\" is not valid.", .{ op.name, h.stringify(req_action) }));
            }
        }

        ctx.point = point;
    }

    return ctx.point;
}

// ============================================================================
// make_spec / make_url / make_fetch_def
// ============================================================================

pub fn make_spec_util(ctx: *Context) E!*Spec {
    if (ctx.out_get("spec")) |ov| {
        switch (ov) {
            .spec => |sp| {
                ctx.spec = sp;
                return sp;
            },
            else => {},
        }
    }

    const point = ctx.point;
    const options = ctx.options;

    const specmap = h.omap();
    h.setp(specmap, "base", h.getp(options, "base"));
    h.setp(specmap, "prefix", h.getp(options, "prefix"));
    h.setp(specmap, "suffix", h.getp(options, "suffix"));
    h.setp(specmap, "parts", h.getp(point, "parts"));
    h.setp(specmap, "step", h.vstr("start"));

    const spec = Spec.make(specmap);
    ctx.spec = spec;

    const method = prepare_method_util(ctx);
    spec.method = method;

    const allow_method: []const u8 = switch (h.getpath(&.{ "allow", "method" }, options)) {
        .string => |s| s,
        else => "",
    };
    if (std.mem.indexOf(u8, allow_method, method) == null) {
        return ctx.fail("spec_method_allow", fmt("Method \"{s}\" not allowed by SDK option allow.method value: \"{s}\"", .{ method, allow_method }));
    }

    spec.params = prepare_params_util(ctx);
    spec.query = prepare_query_util(ctx);
    spec.headers = prepare_headers_util(ctx);
    spec.body = prepare_body_util(ctx);
    spec.path = prepare_path_util(ctx);

    const c = ctx.ctrl;
    if (c.has_explain()) h.setp(c.explain, "spec", spec.to_value());

    const spec2 = try prepare_auth_util(ctx);
    ctx.spec = spec2;
    return spec2;
}

pub fn make_url_util(ctx: *Context) E![]const u8 {
    const spec = ctx.spec orelse return ctx.fail("url_no_spec", "Expected context spec property to be defined.");
    const result = ctx.result orelse return ctx.fail("url_no_result", "Expected context result property to be defined.");

    var url = vs.join(h.A(), h.ja(&.{
        h.vstr(spec.base),
        h.vstr(spec.prefix),
        h.vstr(spec.path),
        h.vstr(spec.suffix),
    }), "/", true) catch "";

    const resmatch = h.omap();

    if (spec.params == .object) {
        var it = spec.params.object.iterator();
        while (it.next()) |kv| {
            const key = kv.key_ptr.*;
            const val = kv.value_ptr.*;
            if (!h.is_noval(val)) {
                const needle = fmt("{{{s}}}", .{key});
                const sub = h.esc_url(h.scalar_str(val));
                url = std.mem.replaceOwned(u8, h.A(), url, needle, sub) catch url;
                h.setp(resmatch, key, val);
            }
        }
    }

    var qsep: []const u8 = "?";
    if (spec.query == .object) {
        var it = spec.query.object.iterator();
        while (it.next()) |kv| {
            const key = kv.key_ptr.*;
            const val = kv.value_ptr.*;
            if (!h.is_noval(val)) {
                url = fmt("{s}{s}{s}={s}", .{ url, qsep, h.esc_url(key), h.esc_url(h.scalar_str(val)) });
                qsep = "&";
                h.setp(resmatch, key, val);
            }
        }
    }

    result.resmatch = resmatch;
    return url;
}

pub fn make_fetch_def_util(ctx: *Context) E!Value {
    const spec = ctx.spec orelse return ctx.fail("fetchdef_no_spec", "Expected context spec property to be defined.");

    if (ctx.result == null) ctx.result = SdkResult.make(h.omap());

    spec.step = "prepare";

    const url = try make_url_util(ctx);
    spec.url = url;

    const fetchdef = h.omap();
    h.setp(fetchdef, "url", h.vstr(url));
    h.setp(fetchdef, "method", h.vstr(spec.method));
    h.setp(fetchdef, "headers", spec.headers);

    const body = spec.body;
    if (!h.is_noval(body)) {
        if (body == .object) {
            h.setp(fetchdef, "body", h.vstr(h.jsonify_compact(body)));
        } else {
            h.setp(fetchdef, "body", body);
        }
    }

    return fetchdef;
}

// ============================================================================
// make_request / make_response / make_result
// ============================================================================

pub fn make_request_util(ctx: *Context) E!*Response {
    if (ctx.out_get("request")) |ov| {
        switch (ov) {
            .response => |resp| return resp,
            else => {},
        }
    }

    const response = Response.make(h.omap());
    ctx.result = SdkResult.make(h.omap());

    const spec = ctx.spec orelse return ctx.fail("request_no_spec", "Expected context spec property to be defined.");

    const fetchdef = make_fetch_def_util(ctx) catch {
        response.err = ctx.take_err();
        ctx.response = response;
        spec.step = "postrequest";
        return response;
    };

    const c = ctx.ctrl;
    if (c.has_explain()) h.setp(c.explain, "fetchdef", fetchdef);

    spec.step = "prerequest";

    const url = h.get_str(fetchdef, "url") orelse "";
    const fetched = ctx.util().fetch(ctx, url, fetchdef);

    var out_resp: *Response = response;
    if (fetched) |fv| {
        switch (fv) {
            .object => out_resp = Response.make(fv),
            .null => {
                const r = Response.make(h.omap());
                r.err = ctx.make_error("request_no_response", "response: undefined");
                out_resp = r;
            },
            else => {
                response.err = ctx.make_error("request_invalid_response", "response: invalid type");
                out_resp = response;
            },
        }
    } else |_| {
        response.err = ctx.take_err();
        out_resp = response;
    }

    spec.step = "postrequest";
    ctx.response = out_resp;
    return out_resp;
}

pub fn make_response_util(ctx: *Context) E!*Response {
    if (ctx.out_get("response")) |ov| {
        switch (ov) {
            .response => |resp| return resp,
            else => {},
        }
    }

    const spec = ctx.spec orelse return ctx.fail("response_no_spec", "Expected context spec property to be defined.");
    const response = ctx.response orelse return ctx.fail("response_no_response", "Expected context response property to be defined.");
    const result = ctx.result orelse return ctx.fail("response_no_result", "Expected context result property to be defined.");

    spec.step = "response";

    _ = result_basic_util(ctx);
    _ = result_headers_util(ctx);
    _ = result_body_util(ctx);
    _ = transform_response_util(ctx);

    if (result.err == null) result.ok = true;

    const c = ctx.ctrl;
    if (c.has_explain()) h.setp(c.explain, "result", result.to_value());

    return response;
}

pub fn make_result_util(ctx: *Context) E!*SdkResult {
    if (ctx.out_get("result")) |ov| {
        switch (ov) {
            .result => |res| return res,
            else => {},
        }
    }

    const op = ctx.op;
    const entity = ctx.entity;
    const spec = ctx.spec orelse return ctx.fail("result_no_spec", "Expected context spec property to be defined.");
    const result = ctx.result orelse return ctx.fail("result_no_result", "Expected context result property to be defined.");

    spec.step = "result";

    _ = transform_response_util(ctx);

    if (std.mem.eql(u8, op.name, "list")) {
        const resdata = result.resdata;
        result.resdata = h.olist();

        if (resdata == .array and entity != null) {
            const ent = entity.?;
            if (resdata.array.data.items.len != 0) {
                const entities = h.olist();
                for (resdata.array.data.items) |entry| {
                    const e = ent.makeEnt();
                    const out = if (entry == .object) e.data(entry) else e.data(null);
                    entities.array.append(out) catch {};
                }
                result.resdata = entities;
            }
        }
    }

    const c = ctx.ctrl;
    if (c.has_explain()) h.setp(c.explain, "result", result.to_value());

    return result;
}

// ============================================================================
// param / prepare_* / result_* / transform_*
// ============================================================================

pub fn param_util(ctx: *Context, paramdef: Value) Value {
    const point = ctx.point;
    const spec = ctx.spec;
    const mtch = ctx.mtch;
    const reqmatch = ctx.reqmatch;
    const data = ctx.data;
    const reqdata = ctx.reqdata;

    const pt = h.typify(paramdef);

    const key: []const u8 = if (0 != ((@as(i64, vs.T_string)) & pt))
        (switch (paramdef) {
            .string => |s| s,
            else => "",
        })
    else
        (h.get_str(paramdef, "name") orelse "");

    var akey: []const u8 = "";
    if (!h.is_noval(point)) {
        const alias = h.to_map(h.getp(point, "alias"));
        if (!h.is_noval(alias)) {
            if (h.get_str(alias, key)) |ak| akey = ak;
        }
    }

    var val = h.getp(reqmatch, key);
    if (h.is_noval(val)) val = h.getp(mtch, key);

    if (h.is_noval(val) and akey.len != 0) {
        if (spec) |sp| {
            h.setp(sp.alias, akey, h.vstr(key));
        }
        val = h.getp(reqmatch, akey);
    }

    if (h.is_noval(val)) val = h.getp(reqdata, key);
    if (h.is_noval(val)) val = h.getp(data, key);

    if (h.is_noval(val) and akey.len != 0) {
        val = h.getp(reqdata, akey);
        if (h.is_noval(val)) val = h.getp(data, akey);
    }

    return val;
}

pub fn prepare_method_util(ctx: *Context) []const u8 {
    const opname = ctx.op.name;
    if (std.mem.eql(u8, opname, "create")) return "POST";
    if (std.mem.eql(u8, opname, "update")) return "PUT";
    if (std.mem.eql(u8, opname, "load")) return "GET";
    if (std.mem.eql(u8, opname, "list")) return "GET";
    if (std.mem.eql(u8, opname, "remove")) return "DELETE";
    if (std.mem.eql(u8, opname, "patch")) return "PATCH";
    return "GET";
}

pub fn prepare_headers_util(ctx: *Context) Value {
    const options: Value = if (ctx.client) |client| client.options_map() else ctx.options;

    const headers = h.getp(options, "headers");
    if (h.is_noval(headers)) return h.omap();

    return switch (h.clone(headers)) {
        .object => |_| h.clone(headers),
        else => h.omap(),
    };
}

pub fn prepare_body_util(ctx: *Context) Value {
    if (std.mem.eql(u8, ctx.op.input, "data")) {
        return transform_request_util(ctx);
    }
    return h.vnull();
}

pub fn prepare_params_util(ctx: *Context) Value {
    const point = ctx.point;
    const args = h.to_map(h.getp(point, "args"));
    const params: Value = if (args == .object)
        (switch (h.getp(args, "params")) {
            .array => h.getp(args, "params"),
            else => h.olist(),
        })
    else
        h.olist();

    const out = h.omap();
    if (params == .array) {
        for (params.array.data.items) |pd| {
            const val = param_util(ctx, pd);
            if (!h.is_noval(val)) {
                if (pd == .object) {
                    if (h.get_str(pd, "name")) |name| {
                        if (name.len != 0) h.setp(out, name, val);
                    }
                }
            }
        }
    }
    return out;
}

pub fn prepare_path_util(ctx: *Context) []const u8 {
    const point = ctx.point;
    const parts: Value = switch (h.getp(point, "parts")) {
        .array => h.getp(point, "parts"),
        else => h.olist(),
    };
    return vs.join(h.A(), parts, "/", true) catch "";
}

pub fn prepare_query_util(ctx: *Context) Value {
    const point = ctx.point;
    const reqmatch: Value = switch (ctx.reqmatch) {
        .object => ctx.reqmatch,
        else => h.omap(),
    };
    const params: Value = switch (h.getp(point, "params")) {
        .array => h.getp(point, "params"),
        else => h.olist(),
    };

    const out = h.omap();
    if (reqmatch == .object) {
        var it = reqmatch.object.iterator();
        while (it.next()) |kv| {
            const key = kv.key_ptr.*;
            const val = kv.value_ptr.*;
            var contained = false;
            if (params == .array) {
                for (params.array.data.items) |v| {
                    if (v == .string and std.mem.eql(u8, v.string, key)) {
                        contained = true;
                        break;
                    }
                }
            }
            if (!h.is_noval(val) and !contained) h.setp(out, key, val);
        }
    }
    return out;
}

const HEADER_AUTH = "authorization";
const OPTION_APIKEY = "apikey";
const NOT_FOUND = "__NOTFOUND__";

pub fn prepare_auth_util(ctx: *Context) E!*Spec {
    const spec = ctx.spec orelse return ctx.fail("auth_no_spec", "Expected context spec property to be defined.");

    const headers = spec.headers;
    const options: Value = if (ctx.client) |client| client.options_map() else ctx.options;

    const auth = h.getp(options, "auth");
    if (h.is_noval(auth)) {
        h.del_prop(headers, h.vstr(HEADER_AUTH));
        return spec;
    }

    const apikey = vs.getprop(h.A(), options, h.vstr(OPTION_APIKEY), h.vstr(NOT_FOUND)) catch h.vstr(NOT_FOUND);

    const skip = switch (apikey) {
        .null => true,
        .string => |s| std.mem.eql(u8, s, NOT_FOUND) or s.len == 0,
        else => false,
    };

    if (skip) {
        h.del_prop(headers, h.vstr(HEADER_AUTH));
    } else {
        const auth_prefix: []const u8 = switch (h.getpath(&.{ "auth", "prefix" }, options)) {
            .string => |s| s,
            else => "",
        };
        const apikey_val: []const u8 = switch (apikey) {
            .string => |s| s,
            else => "",
        };
        if (auth_prefix.len == 0) {
            h.setp(headers, HEADER_AUTH, h.vstr(apikey_val));
        } else {
            h.setp(headers, HEADER_AUTH, h.vstr(fmt("{s} {s}", .{ auth_prefix, apikey_val })));
        }
    }

    return spec;
}

pub fn result_basic_util(ctx: *Context) ?*SdkResult {
    const response = ctx.response;
    const result = ctx.result;

    if (result != null and response != null) {
        const res = result.?;
        const resp = response.?;
        res.status = resp.status;
        res.status_text = resp.status_text;

        if (res.status >= 400) {
            const msg = fmt("request: {d}: {s}", .{ res.status, res.status_text });
            if (res.err) |prev| {
                res.err = ctx.make_error("request_status", fmt("{s}: {s}", .{ prev.msg, msg }));
            } else {
                res.err = ctx.make_error("request_status", msg);
            }
        } else if (resp.err) |rerr| {
            res.err = rerr;
        }
    }
    return result;
}

pub fn result_headers_util(ctx: *Context) ?*SdkResult {
    const response = ctx.response;
    const result = ctx.result;

    if (result) |res| {
        const headers: Value = if (response) |r| (switch (r.headers) {
            .object => r.headers,
            else => h.omap(),
        }) else h.omap();
        res.headers = headers;
    }
    return result;
}

pub fn result_body_util(ctx: *Context) ?*SdkResult {
    const response = ctx.response;
    const result = ctx.result;

    if (result) |res| {
        if (response) |resp| {
            const json = resp.json;
            const body = resp.body;
            if (json == .function and !h.is_noval(body)) {
                res.body = h.call_json(json);
            }
        }
    }
    return result;
}

pub fn transform_request_util(ctx: *Context) Value {
    const spec = ctx.spec;
    const point = ctx.point;

    if (spec) |sp| sp.step = "reqform";

    const transform = h.to_map(h.getp(point, "transform"));
    if (h.is_noval(transform)) return ctx.reqdata;

    const reqform = h.getp(transform, "req");
    if (h.is_noval(reqform)) return ctx.reqdata;

    const store = h.jo(&.{.{ "reqdata", ctx.reqdata }});
    return vs.transform(h.A(), store, reqform) catch ctx.reqdata;
}

pub fn transform_response_util(ctx: *Context) Value {
    const spec = ctx.spec;
    const result = ctx.result;
    const point = ctx.point;

    if (spec) |sp| sp.step = "resform";

    const res = result orelse return h.vnull();
    if (!res.ok) return h.vnull();

    const transform = h.to_map(h.getp(point, "transform"));
    if (h.is_noval(transform)) return h.vnull();

    const resform = h.getp(transform, "res");
    if (h.is_noval(resform)) return h.vnull();

    const store = h.jo(&.{
        .{ "ok", h.vbool(res.ok) },
        .{ "status", h.vnum(res.status) },
        .{ "statusText", h.vstr(res.status_text) },
        .{ "headers", res.headers },
        .{ "body", res.body },
        .{ "resdata", res.resdata },
        .{ "resmatch", res.resmatch },
    });

    const resdata = vs.transform(h.A(), store, resform) catch return h.vnull();
    res.resdata = resdata;
    return resdata;
}

// ============================================================================
// fetcher (default transport)
// ============================================================================

fn defaultFetcherCall(_: *anyopaque, opctx: *Context, url: []const u8, fetchdef: Value) E!Value {
    return fetcher_util(opctx, url, fetchdef);
}

pub fn fetcher_util(ctx: *Context, fullurl: []const u8, fetchdef: Value) E!Value {
    const client = ctx.client orelse return ctx.fail("fetch_no_client", "Expected context client.");

    const mode = client.mode;
    if (!std.mem.eql(u8, mode, "live")) {
        return ctx.fail("fetch_mode_block", fmt("Request blocked by mode: \"{s}\" (URL was: \"{s}\")", .{ mode, fullurl }));
    }

    const options = client.options_map();
    if (h.veq(h.getpath(&.{ "feature", "test", "active" }, options), h.vbool(true))) {
        return ctx.fail("fetch_test_block", fmt("Request blocked as test feature is active (URL was: \"{s}\")", .{fullurl}));
    }

    const sys_fetch = h.getpath(&.{ "system", "fetch" }, options);

    if (h.is_noval(sys_fetch)) {
        return default_http_fetch(ctx, fullurl, fetchdef);
    }

    if (sys_fetch == .function) {
        const out = h.call_vfn(sys_fetch, h.ja(&.{ h.vstr(fullurl), fetchdef }));
        if (h.get_str(out, "__err__")) |msg| {
            return ctx.fail("fetch_system", msg);
        }
        return out;
    }

    return ctx.fail("fetch_invalid", "system.fetch is not a valid function");
}

fn default_http_fetch(ctx: *Context, fullurl: []const u8, fetchdef: Value) E!Value {
    _ = fetchdef;
    // Live HTTP transport. The generated test suite runs entirely against the
    // offline mock (the `test` feature), so this path is not exercised by
    // tests; a real deployment injects `system.fetch`. A std.http.Client
    // implementation can be wired here.
    return ctx.fail("fetch_transport", fmt("live transport unavailable (URL was: \"{s}\")", .{fullurl}));
}
