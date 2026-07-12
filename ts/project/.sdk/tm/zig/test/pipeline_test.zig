// Pipeline basics (entity-agnostic): prepare() builds a fetchdef, and
// direct() runs a raw request through the transport (an injected mock).

const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const Value = sdk.Value;
const testing = std.testing;

fn vnull() Value {
    return Value{ .null = {} };
}

const Mock = struct {
    calls: i64 = 0,
    fn call(p: *anyopaque, _: std.mem.Allocator, _: Value) anyerror!Value {
        const self: *Mock = @ptrCast(@alignCast(p));
        self.calls += 1;
        return h.jo(&.{
            .{ "status", h.vnum(200) },
            .{ "statusText", h.vstr("OK") },
            .{ "headers", h.omap() },
            .{ "json", h.json_thunk(h.jo(&.{.{ "id", h.vstr("z1") }})) },
            .{ "body", h.vstr("x") },
        });
    }
};

test "prepare: builds a fetchdef with method and url" {
    const client = sdk.new();
    const fd = client.prepare(h.jo(&.{
        .{ "path", h.vstr("/things") },
        .{ "method", h.vstr("GET") },
    })) catch unreachable;
    try testing.expect(fd == .object);
    try testing.expect(std.mem.eql(u8, h.get_str(fd, "method") orelse "", "GET"));
    const url = h.get_str(fd, "url") orelse "";
    try testing.expect(std.mem.indexOf(u8, url, "/things") != null);
}

test "direct: 2xx via injected system.fetch is ok" {
    const m = h.A().create(Mock) catch unreachable;
    m.* = .{};
    const client = sdk.SDK.new(h.jo(&.{
        .{ "system", h.jo(&.{.{ "fetch", h.callable(@ptrCast(m), Mock.call) }}) },
    }));
    const res = client.direct(h.jo(&.{
        .{ "path", h.vstr("/things") },
        .{ "method", h.vstr("GET") },
    }));
    try testing.expect(h.get_bool(res, "ok") orelse false);
    try testing.expect(h.to_int(h.getp(res, "status")) == 200);
    try testing.expect(m.calls == 1);
}
