// Transport-wrapping feature tests (entity-agnostic). Each drives the wrapped
// fetcher directly via utility.fetch with an injected `system.fetch` mock and
// injectable now/sleep, so behaviour is deterministic (gotcha #5).

const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const Value = sdk.Value;
const testing = std.testing;

fn vnull() Value {
    return Value{ .null = {} };
}

// ---- programmable transport mock ---------------------------------------

const Mock = struct {
    calls: i64 = 0,
    statuses: []const i64,
    last_headers: Value = .{ .null = {} },

    fn call(p: *anyopaque, _: std.mem.Allocator, arg: Value) anyerror!Value {
        const self: *Mock = @ptrCast(@alignCast(p));
        if (arg == .array and arg.array.data.items.len >= 2) {
            self.last_headers = h.getp(arg.array.data.items[1], "headers");
        }
        const n: i64 = @intCast(self.statuses.len);
        const idx: usize = if (self.calls >= n) @intCast(n - 1) else @intCast(self.calls);
        self.calls += 1;
        const status = self.statuses[idx];
        return h.jo(&.{
            .{ "status", h.vnum(status) },
            .{ "statusText", h.vstr("OK") },
            .{ "headers", h.omap() },
            .{ "json", h.json_thunk(h.jo(&.{.{ "ok", h.vbool(true) }})) },
            .{ "body", h.vstr("x") },
        });
    }
};

fn makeMock(statuses: []const i64) *Mock {
    const m = h.A().create(Mock) catch unreachable;
    m.* = .{ .statuses = h.A().dupe(i64, statuses) catch statuses };
    return m;
}
fn mockVal(m: *Mock) Value {
    return h.callable(@ptrCast(m), Mock.call);
}

const Clock = struct {
    idx: i64 = 0,
    seq: []const i64,
    fn call(p: *anyopaque, _: std.mem.Allocator, _: Value) anyerror!Value {
        const self: *Clock = @ptrCast(@alignCast(p));
        const n: i64 = @intCast(self.seq.len);
        const i: usize = if (self.idx >= n) @intCast(n - 1) else @intCast(self.idx);
        self.idx += 1;
        return h.vnum(self.seq[i]);
    }
};
fn makeClock(seq: []const i64) Value {
    const c = h.A().create(Clock) catch unreachable;
    c.* = .{ .seq = h.A().dupe(i64, seq) catch seq };
    return h.callable(@ptrCast(c), Clock.call);
}

var noop_dummy: u8 = 0;
fn noopCall(_: *anyopaque, _: std.mem.Allocator, _: Value) anyerror!Value {
    return vnull();
}
fn noopSleep() Value {
    return h.callable(@ptrCast(&noop_dummy), noopCall);
}

fn fetchdef(url: []const u8) Value {
    return h.jo(&.{ .{ "url", h.vstr(url) }, .{ "method", h.vstr("GET") } });
}

// ---- retry (injectable sleep, gotcha #5) --------------------------------

test "retry: retries transient failures then succeeds" {
    const m = makeMock(&[_]i64{ 503, 503, 200 });
    const opts = h.jo(&.{
        .{ "feature", h.jo(&.{.{ "retry", h.jo(&.{
            .{ "active", h.vbool(true) },
            .{ "retries", h.vnum(2) },
            .{ "jitter", h.vbool(false) },
            .{ "sleep", noopSleep() },
        }) }}) },
        .{ "system", h.jo(&.{.{ "fetch", mockVal(m) }}) },
    });
    const client = sdk.SDK.new(opts);
    const ctx = client.get_root_ctx();
    const r = client.utility.fetch(ctx, "http://x", fetchdef("http://x")) catch unreachable;
    try testing.expect(m.calls == 3);
    try testing.expect(h.to_int(h.getp(r, "status")) == 200);
}

// ---- timeout (injectable now, gotcha #5) --------------------------------

test "timeout: injected clock past deadline errors" {
    const m = makeMock(&[_]i64{200});
    const opts = h.jo(&.{
        .{ "feature", h.jo(&.{.{ "timeout", h.jo(&.{
            .{ "active", h.vbool(true) },
            .{ "ms", h.vnum(100) },
            .{ "now", makeClock(&[_]i64{ 0, 200 }) },
        }) }}) },
        .{ "system", h.jo(&.{.{ "fetch", mockVal(m) }}) },
    });
    const client = sdk.SDK.new(opts);
    const ctx = client.get_root_ctx();
    const r = client.utility.fetch(ctx, "http://x", fetchdef("http://x"));
    try testing.expectError(error.Sdk, r);
    try testing.expect(std.mem.eql(u8, ctx.pending_err.?.code, "timeout"));
}

// ---- cache (dedup, injectable now) --------------------------------------

test "cache: second fetch of same url is served from cache" {
    const m = makeMock(&[_]i64{ 200, 200 });
    const opts = h.jo(&.{
        .{ "feature", h.jo(&.{.{ "cache", h.jo(&.{
            .{ "active", h.vbool(true) },
            .{ "ttl", h.vnum(5000) },
            .{ "now", makeClock(&[_]i64{1000}) },
        }) }}) },
        .{ "system", h.jo(&.{.{ "fetch", mockVal(m) }}) },
    });
    const client = sdk.SDK.new(opts);
    const ctx = client.get_root_ctx();
    _ = client.utility.fetch(ctx, "http://x", fetchdef("http://x")) catch unreachable;
    _ = client.utility.fetch(ctx, "http://x", fetchdef("http://x")) catch unreachable;
    try testing.expect(m.calls == 1);
}
