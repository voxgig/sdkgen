// The bounded raw reader (the zig port of tm/ts/src/utility/codec/RawCodec.ts).
// The SDK ships no transport: the bound applies to what system.fetch returns.

const std = @import("std");
const h = @import("../../core/helpers.zig");
const err = @import("../../core/error.zig");
const ctxmod = @import("../../core/context.zig");
const binary = @import("../../core/binary.zig");
const response_mod = @import("../../core/response.zig");

const Value = h.Value;
const Context = ctxmod.Context;
const Response = response_mod.Response;

fn header(headers: Value, name: []const u8) []const u8 {
    if (headers != .object) return "";
    var it = headers.object.iterator();
    while (it.next()) |kv| {
        if (std.ascii.eqlIgnoreCase(kv.key_ptr.*, name)) {
            return if (kv.value_ptr.* == .string) kv.value_ptr.*.string else h.scalar_str(kv.value_ptr.*);
        }
    }
    return "";
}

fn too_large(ctx: *Context, code: []const u8, max: usize, declared: ?usize) err.E {
    const msg = if (declared) |n|
        std.fmt.allocPrint(h.A(), "response: body of {d} bytes exceeds maxBuffer ({d} bytes)", .{ n, max })
    else
        std.fmt.allocPrint(h.A(), "response: body is longer than maxBuffer ({d} bytes)", .{max});
    return ctx.fail(code, msg catch "response: body exceeds maxBuffer");
}

// The whole body, refused past the bound: by its declared length before a
// byte is taken, else by the count.
pub fn read_bounded(ctx: *Context, response: *Response, max: usize, code: []const u8) err.E![]const u8 {
    const length = std.mem.trim(u8, header(response.headers, "content-length"), " \t");
    if (0 < length.len) {
        for (length) |c| {
            if (!std.ascii.isDigit(c)) break;
        } else {
            const declared = std.fmt.parseInt(usize, length, 10) catch std.math.maxInt(usize);
            if (max < declared) return too_large(ctx, code, max, declared);
        }
    }
    const body: []const u8 = switch (response.body) {
        .null => "",
        .string => |s| s,
        else => |v| h.stringify(v),
    };
    if (max < body.len) return too_large(ctx, code, max, null);
    return body;
}

// A raw success body: text into the record under `$body`; bytes only into a
// binary handle's read, never into the record.
pub fn read_raw(ctx: *Context) err.E!void {
    const response = ctx.response orelse return;
    const result = ctx.result orelse return;
    const max = binary.max_buffer(ctx);
    const rs = h.getp(ctx.point, "response");

    if (h.getp(rs, "binary") == .bool and h.getp(rs, "binary").bool) {
        result.body = h.vnull();
        if (ctx.ctrl.transfer) |transfer| {
            if (std.mem.eql(u8, transfer.direction, "read")) {
                transfer.bytes = try read_bounded(ctx, response, max, "binary_too_large");
            }
        }
        return;
    }

    const bytes = try read_bounded(ctx, response, max, "response_too_large");
    result.body = h.jo(&.{.{ binary.RAW_BODY, h.vstr(bytes) }});
}
