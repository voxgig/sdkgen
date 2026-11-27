// The application/x-www-form-urlencoded encoder (the zig port of
// tm/ts/src/utility/codec/FormCodec.ts).

const std = @import("std");
const h = @import("../../core/helpers.zig");
const err = @import("../../core/error.zig");
const ctxmod = @import("../../core/context.zig");
const binary = @import("../../core/binary.zig");

const Value = h.Value;
const Context = ctxmod.Context;

const FORM_MEDIA = "application/x-www-form-urlencoded";

const HEX = "0123456789ABCDEF";

// Alphanumerics and `*-._` as they are, a space as `+`, every other byte as %HH.
pub fn form_escape(out: *std.ArrayList(u8), bytes: []const u8) void {
    for (bytes) |byte| {
        if (std.ascii.isAlphanumeric(byte) or byte == '*' or byte == '-' or byte == '.' or byte == '_') {
            out.append(h.A(), byte) catch {};
        } else if (byte == ' ') {
            out.append(h.A(), '+') catch {};
        } else {
            out.appendSlice(h.A(), &[_]u8{ '%', HEX[byte >> 4], HEX[byte & 15] }) catch {};
        }
    }
}

// A source here is bytes alone: zig has no Blob or stream to refuse.
pub fn encode_form(ctx: *Context, data: Value, lifted: []const binary.Lifted) err.E!binary.Encoded {
    const body = h.getp(ctx.point, "body");
    var out: std.ArrayList(u8) = .empty;
    for (binary.body_items(body, data, lifted), 0..) |item, i| {
        if (0 < i) out.append(h.A(), '&') catch {};
        form_escape(&out, item.name);
        out.append(h.A(), '=') catch {};
        form_escape(&out, binary.item_bytes(item.value));
    }
    const declared = h.get_str(body, "media") orelse "";
    return .{
        .ty = if (0 == declared.len) FORM_MEDIA else declared,
        .body = h.vstr(out.toOwnedSlice(h.A()) catch ""),
    };
}
