import {
  cmp,
  each,
  File,
  Content,
  entityClassName,
  entityCollection,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'

import { zigVarName } from './utility_zig'


// The canary sweep (the zig port of TestClean_ts): every credential slot
// holds a distinctive value, every diagnostic feature this SDK ships is
// switched on with a capturing sink, a real operation runs through every
// outcome, and every string that leaves the SDK is searched for the
// canaries and their encoded forms. It also proves its own sensitivity: with
// clean switched off the canary MUST show.
//
// Zig has no runtime reflection over the client, so the candidate operations
// usableOp drives are emitted here from the model, list and load first; the
// first that completes against a plain 200 with no arguments is the one.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  const entityColl = entityCollection(model)
  const rank: Record<string, number> = { list: 0, load: 1 }

  const candidates: { method: string, mod: string, cls: string, op: string }[] = []
  each(entityColl)
    .filter((e: any) => false !== e.active)
    .forEach((e: any) => {
      const method = zigVarName(e.name)
      const cls = entityClassName(e, entityColl)
      Object.keys(e.op || {})
        .filter((op) => ['list', 'load', 'create', 'update', 'remove'].includes(op))
        .sort((a, b) => ((rank[a] ?? 2) - (rank[b] ?? 2)) || a.localeCompare(b))
        .forEach((op) => candidates.push({ method, mod: method, cls, op }))
    })

  File({ name: 'clean_test.' + target.ext }, () => Content(render(auth, candidates)))
})


function zigbool(b: boolean): string {
  return b ? 'true' : 'false'
}


function zigstr(s: string): string {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}


function candidateFn(c: { method: string, mod: string, cls: string, op: string }): string {
  const name = 'try_' + c.method + '_' + c.op
  const call = 'client.' + c.method + '(vnull()).' + c.op + '(h.omap(), ctrl)'
  if ('list' === c.op) {
    return `
fn ${name}(client: *sdk.SDK, ctrl: Value) Outcome {
    switch (${call}) {
        .ok => |ents| {
            const records = h.olist();
            for (ents) |e| records.array.append(e.asEntity().data(null)) catch {};
            return .{ .ok = true, .err = null, .result = records };
        },
        .err => |e| return .{ .ok = false, .err = e, .result = vnull() },
    }
}
`
  }
  return `
fn ${name}(client: *sdk.SDK, ctrl: Value) Outcome {
    switch (${call}) {
        .ok => |ent| return .{ .ok = true, .err = null, .result = ent.asEntity().data(null) },
        .err => |e| return .{ .ok = false, .err = e, .result = vnull() },
    }
}
`
}


function render(auth: {
  suppressed: boolean, where: string, name: string, basic: boolean
}, candidates: { method: string, mod: string, cls: string, op: string }[]): string {
  return `// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// the SDK is searched for the canaries and their encoded forms. It also
// proves its own sensitivity: with clean switched off the canary MUST show.

const std = @import("std");
const sdk = @import("sdk");
const fh = @import("fh.zig");
const h = sdk.h;
const Value = sdk.Value;
const testing = std.testing;

fn vnull() Value {
    return Value{ .null = {} };
}

fn fmt(comptime f: []const u8, args: anytype) []const u8 {
    return std.fmt.allocPrint(h.A(), f, args) catch "";
}

// Generated: the credential's wire placement is fixed when the SDK is built.
const AUTH = .{
    .suppressed = ${zigbool(auth.suppressed)},
    .where = ${zigstr(auth.where)},
    .name = ${zigstr(auth.name)},
    .basic = ${zigbool(auth.basic)},
};

const CANARY_APIKEY = "CANARY-APIKEY-k9x2m7q4p1";
const CANARY_SECRET = "CANARY-SECRET-w3e8r5t2y6";
const CANARY_HEADER = "CANARY-HEADER-z1x4c7v0b3";
const CANARY_VALUE = "CANARY-VALUE-n5m8b2v9c4";

const MASK = "[redacted]";

fn base64_std(text: []const u8) []const u8 {
    const enc = std.base64.standard.Encoder;
    const buf = h.A().alloc(u8, enc.calcSize(text.len)) catch return "";
    return enc.encode(buf, text);
}

// Every form a canary can travel in.
fn forms() [][]const u8 {
    var out: std.ArrayList([]const u8) = .empty;
    for ([_][]const u8{ CANARY_APIKEY, CANARY_SECRET, CANARY_HEADER, CANARY_VALUE }) |v| {
        out.append(h.A(), v) catch {};
        out.append(h.A(), base64_std(v)) catch {};
        out.append(h.A(), h.esc_url(v)) catch {};
    }
    out.append(h.A(), base64_std(fmt("{s}:{s}", .{ CANARY_APIKEY, CANARY_SECRET }))) catch {};
    return out.toOwnedSlice(h.A()) catch &.{};
}

const Surface = struct { name: []const u8, text: []const u8 };

const Sinks = struct {
    items: std.ArrayList(Surface) = .empty,

    fn push(self: *Sinks, name: []const u8, text: []const u8) void {
        self.items.append(h.A(), .{ .name = name, .text = text }) catch {};
    }

    // A record's JSON, and its stringified form.
    fn value(self: *Sinks, name: []const u8, v: Value) void {
        self.push(fmt("{s}:json", .{name}), h.jsonify_compact(v));
        self.push(fmt("{s}:string", .{name}), h.stringify(v));
    }

    fn err(self: *Sinks, name: []const u8, e: *sdk.h.SdkError) void {
        self.push(fmt("{s}:msg", .{name}), e.msg);
        self.push(fmt("{s}:format", .{name}), fmt("{f}", .{e.*}));
        self.push(fmt("{s}:json", .{name}), e.to_json());
        self.push(fmt("{s}:spec", .{name}), h.jsonify_compact(e.spec));
        self.push(fmt("{s}:result", .{name}), h.jsonify_compact(e.result));
    }

    fn ctx(self: *Sinks, name: []const u8, c: *sdk.Context) void {
        self.push(fmt("{s}:json", .{name}), c.to_json());
        self.push(fmt("{s}:format", .{name}), fmt("{f}", .{c.*}));
    }
};

// A sink callback (audit sink, telemetry exporter, debug onEntry, cost sink)
// that records each record's forms under its name.
const Capture = struct {
    sinks: *Sinks,
    name: []const u8,

    fn call(p: *anyopaque, _: std.mem.Allocator, arg: Value) anyerror!Value {
        const self: *Capture = @ptrCast(@alignCast(p));
        self.sinks.value(self.name, arg);
        return vnull();
    }

    fn make(sinks: *Sinks, name: []const u8) Value {
        const s = h.A().create(Capture) catch unreachable;
        s.* = .{ .sinks = sinks, .name = name };
        return h.callable(@ptrCast(s), call);
    }
};

// Captures the serialised context from inside the pipeline: what a hook
// author would hand to a logger.
const CaptureFeature = struct {
    name: []const u8 = "capture",
    sinks: *Sinks,

    fn make(sinks: *Sinks) sdk.Feature {
        const self = h.A().create(CaptureFeature) catch unreachable;
        self.* = .{ .sinks = sinks };
        return .{ .ptr = @ptrCast(self), .vtable = &vtable };
    }
    fn self_of(p: *anyopaque) *CaptureFeature {
        return @ptrCast(@alignCast(p));
    }
    fn vname(p: *anyopaque) []const u8 {
        return self_of(p).name;
    }
    fn vactive(_: *anyopaque) bool {
        return true;
    }
    fn vaddopts(_: *anyopaque) Value {
        return vnull();
    }
    fn vinit(_: *anyopaque, _: *sdk.Context, _: Value) void {}
    fn vdispatch(p: *anyopaque, hook: []const u8, c: *sdk.Context) void {
        const self = self_of(p);
        if (std.mem.eql(u8, hook, "PreRequest") or
            std.mem.eql(u8, hook, "PreResponse") or
            std.mem.eql(u8, hook, "PreUnexpected"))
        {
            self.sinks.ctx(fmt("ctx@{s}", .{hook}), c);
        }
    }
    const vtable = sdk.Feature.VTable{
        .name = vname,
        .active = vactive,
        .add_options = vaddopts,
        .init = vinit,
        .dispatch = vdispatch,
    };
};

// ---- scenarios: what the transport answers ------------------------------

const Scenario = enum { ok, notfound, server, transport, notjson };

fn response(status: i64, data: Value, headers: Value) Value {
    const hh = h.omap();
    h.setp(hh, "content-type", h.vstr("application/json"));
    if (headers == .object) {
        var it = headers.object.iterator();
        while (it.next()) |kv| h.setp(hh, kv.key_ptr.*, kv.value_ptr.*);
    }
    return h.jo(&.{
        .{ "status", h.vnum(status) },
        .{ "statusText", h.vstr(if (status < 400) "OK" else "ERR") },
        .{ "headers", hh },
        .{ "json", h.json_thunk(data) },
        .{ "body", h.vstr(h.jsonify_compact(data)) },
    });
}

fn notJsonThunk(_: *anyopaque, _: std.mem.Allocator, _: Value) anyerror!Value {
    return error.NotJson;
}
var notjson_dummy: u8 = 0;

// The system.fetch seam: (url, fetchdef) -> transport-shaped response, or a
// map carrying __err__ for a transport failure.
const Transport = struct {
    scenario: Scenario,

    fn call(p: *anyopaque, _: std.mem.Allocator, arg: Value) anyerror!Value {
        const self: *Transport = @ptrCast(@alignCast(p));
        const url = h.scalar_str(h.get_elem(arg, h.vnum(0), vnull()));
        return switch (self.scenario) {
            .ok => response(200, h.jo(&.{ .{ "id", h.vstr("i1") }, .{ "name", h.vstr("n1") } }),
                h.jo(&.{.{ "x-session-token", h.vstr("RESP-TOKEN-a1b2c3d4e5") }})),
            .notfound => response(404, h.jo(&.{.{ "error", h.vstr("no such record") }}), vnull()),
            .server => response(500, h.jo(&.{.{ "error", h.vstr("boom") }}), vnull()),
            .transport => h.jo(&.{.{ "__err__", h.vstr(fmt("socket hang up (URL was: \\"{s}\\")", .{url})) }}),
            .notjson => h.jo(&.{
                .{ "status", h.vnum(200) },
                .{ "statusText", h.vstr("OK") },
                .{ "headers", h.omap() },
                .{ "json", h.callable(@ptrCast(&notjson_dummy), notJsonThunk) },
                .{ "body", h.vstr("<html>") },
            }),
        };
    }

    fn make(scenario: Scenario) Value {
        const s = h.A().create(Transport) catch unreachable;
        s.* = .{ .scenario = scenario };
        return h.callable(@ptrCast(s), call);
    }
};

fn makeSdk(scenario: Scenario, sinks: *Sinks, clean_active: bool) *sdk.SDK {
    const feature = h.omap();
    if (fh.fh_has_feature("log")) h.setp(feature, "log", h.jo(&.{.{ "active", h.vbool(true) }}));
    if (fh.fh_has_feature("debug")) h.setp(feature, "debug", h.jo(&.{
        .{ "active", h.vbool(true) },
        .{ "onEntry", Capture.make(sinks, "debug") },
    }));
    if (fh.fh_has_feature("audit")) h.setp(feature, "audit", h.jo(&.{
        .{ "active", h.vbool(true) },
        .{ "sink", Capture.make(sinks, "audit") },
    }));
    if (fh.fh_has_feature("telemetry")) h.setp(feature, "telemetry", h.jo(&.{
        .{ "active", h.vbool(true) },
        .{ "exporter", Capture.make(sinks, "telemetry") },
    }));
    if (fh.fh_has_feature("cost")) h.setp(feature, "cost", h.jo(&.{
        .{ "active", h.vbool(true) },
        .{ "sink", Capture.make(sinks, "cost") },
    }));
    if (fh.fh_has_feature("metrics")) h.setp(feature, "metrics", h.jo(&.{.{ "active", h.vbool(true) }}));
    if (fh.fh_has_feature("clienttrack")) h.setp(feature, "clienttrack", h.jo(&.{.{ "active", h.vbool(true) }}));

    const clean = h.jo(&.{.{ "values", h.vstr(CANARY_VALUE) }});
    if (!clean_active) h.setp(clean, "active", h.vbool(false));

    const options = h.jo(&.{
        .{ "apikey", h.vstr(CANARY_APIKEY) },
        .{ "secret", h.vstr(CANARY_SECRET) },
        .{ "headers", h.jo(&.{.{ "X-Custom-Token", h.vstr(CANARY_HEADER) }}) },
        .{ "clean", clean },
        .{ "feature", feature },
        .{ "system", h.jo(&.{.{ "fetch", Transport.make(scenario) }}) },
    });

    return sdk.SDK.new_with(options, &.{CaptureFeature.make(sinks)});
}

// ---- the candidate operations, from the model ---------------------------

const Outcome = struct {
    ok: bool,
    err: ?*sdk.h.SdkError,
    result: Value,
};

const Candidate = *const fn (client: *sdk.SDK, ctrl: Value) Outcome;
${candidates.map(candidateFn).join('')}
const CANDIDATES = [_]Candidate{${candidates.map((c) => 'try_' + c.method + '_' + c.op).join(', ')}};

// The first operation that completes against a plain 200 with no arguments
// (a required path parameter would fail before the request is built).
fn usableOp() ?Candidate {
    for (CANDIDATES) |cand| {
        const plain = sdk.SDK.new(h.jo(&.{
            .{ "apikey", h.vstr(CANARY_APIKEY) },
            .{ "system", h.jo(&.{.{ "fetch", Transport.make(.ok) }}) },
        }));
        if (cand(plain, h.omap()).ok) return cand;
    }
    return null;
}

fn drive(client: *sdk.SDK, cand: Candidate, ctrl: Value, sinks: *Sinks) ?*sdk.h.SdkError {
    const out = cand(client, ctrl);
    if (out.err) |e| sinks.err("error", e);
    if (out.ok) sinks.value("result", out.result);
    const explain = h.getp(ctrl, "explain");
    if (explain == .object) sinks.value("explain", explain);
    return out.err;
}

fn leaks(text: []const u8) [][]const u8 {
    var found: std.ArrayList([]const u8) = .empty;
    for (forms()) |f| {
        if (std.mem.indexOf(u8, text, f) != null) found.append(h.A(), f) catch {};
    }
    return found.toOwnedSlice(h.A()) catch &.{};
}

// Header maps keep the caller's spelling; the assertion should not care.
fn header(map: Value, name: []const u8) ?[]const u8 {
    if (map != .object) return null;
    var it = map.object.iterator();
    while (it.next()) |kv| {
        if (std.ascii.eqlIgnoreCase(kv.key_ptr.*, name)) {
            return switch (kv.value_ptr.*) {
                .string => |s| s,
                else => null,
            };
        }
    }
    return null;
}

const Variant = enum { throw, explain, nothrow };

fn ctrlFor(v: Variant) Value {
    return switch (v) {
        .throw => h.omap(),
        .explain => h.jo(&.{.{ "explain", h.omap() }}),
        .nothrow => h.jo(&.{ .{ "throw", h.vbool(false) }, .{ "explain", h.omap() } }),
    };
}

test "clean: no credential leaves the SDK in any form" {
    const cand = usableOp() orelse {
        std.debug.print("clean: no operation completes without arguments; nothing to sweep\\n", .{});
        try testing.expect(false);
        return;
    };

    var sinks = Sinks{};
    var notfound: ?*sdk.h.SdkError = null;
    var explained: Value = vnull();

    for ([_]Scenario{ .ok, .notfound, .server, .transport, .notjson }) |scenario| {
        for ([_]Variant{ .throw, .explain, .nothrow }) |variant| {
            const client = makeSdk(scenario, &sinks, true);
            const ctrl = ctrlFor(variant);
            const err = drive(client, cand, ctrl, &sinks);
            if (scenario == .notfound and variant == .throw) notfound = err;
            if (scenario == .ok and variant == .explain) explained = h.getp(ctrl, "explain");
        }
    }

    var leaked: usize = 0;
    for (sinks.items.items) |s| {
        const found = leaks(s.text);
        if (0 < found.len) {
            leaked += 1;
            std.debug.print("clean: credential leaked through {s}: {s}\\n", .{ s.name, found[0] });
        }
    }

    std.debug.print("clean: swept {d} surface(s), {d} leak(s)\\n", .{ sinks.items.items.len, leaked });

    try testing.expect(0 < sinks.items.items.len);
    try testing.expect(leaked == 0);

    // The positive half: the slot the credential travelled in is masked, and
    // an unregistered token in a response header is masked by name.
    const nf = notfound orelse {
        std.debug.print("clean: the 404 scenario must fail\\n", .{});
        try testing.expect(false);
        return;
    };
    try testing.expect(h.to_int(h.getp(nf.result, "status")) == 404);
    const spec = nf.spec;
    if (!AUTH.suppressed) {
        if (std.mem.eql(u8, AUTH.where, "query")) {
            try testing.expect(std.mem.eql(u8, header(h.getp(spec, "query"), AUTH.name) orelse "", MASK));
        } else if (std.mem.eql(u8, AUTH.where, "cookie")) {
            const cookie = header(h.getp(spec, "headers"), "cookie") orelse "";
            try testing.expect(std.mem.indexOf(u8, cookie, MASK) != null);
        } else {
            const cred = header(h.getp(spec, "headers"), AUTH.name) orelse "";
            try testing.expect(std.mem.endsWith(u8, cred, MASK));
        }
    }
    try testing.expect(std.mem.eql(u8, header(h.getp(spec, "headers"), "x-custom-token") orelse "", MASK));

    try testing.expect(h.getp(explained, "result") == .object);
    try testing.expect(std.mem.eql(u8, header(h.getp(h.getp(explained, "result"), "headers"), "x-session-token") orelse "", MASK));
}

test "clean: the sweep can see a leak: clean switched off shows the credential" {
    const cand = usableOp() orelse {
        try testing.expect(false);
        return;
    };

    var sinks = Sinks{};
    const client = makeSdk(.notfound, &sinks, false);
    const err = drive(client, cand, h.omap(), &sinks);
    try testing.expect(err != null);

    var seen: usize = 0;
    for (sinks.items.items) |s| {
        if (0 < leaks(s.text).len) seen += 1;
    }
    try testing.expect(0 < seen);

    if (!AUTH.suppressed) {
        const text = h.jsonify_compact(err.?.spec);
        const basic = base64_std(fmt("{s}:{s}", .{ CANARY_APIKEY, CANARY_SECRET }));
        try testing.expect(std.mem.indexOf(u8, text, CANARY_APIKEY) != null or
            std.mem.indexOf(u8, text, basic) != null);
    }
}
`
}


export {
  TestClean
}
