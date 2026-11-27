// The multipart/form-data encoder (the zig port of
// tm/ts/src/utility/codec/MultipartCodec.ts).

const std = @import("std");
const h = @import("../../core/helpers.zig");
const err = @import("../../core/error.zig");
const ctxmod = @import("../../core/context.zig");
const binary = @import("../../core/binary.zig");

const Value = h.Value;
const Context = ctxmod.Context;

const MULTIPART_MEDIA = "multipart/form-data";

const OCTET_MEDIA = "application/octet-stream";

const CRLF = "\r\n";

pub fn multipart_boundary(_: *Context) []const u8 {
    var bytes: [16]u8 = undefined;
    h.IO().randomSecure(&bytes) catch @panic("no source of random bytes for a multipart boundary");
    const hex = std.fmt.bytesToHex(bytes, .lower);
    return h.A().dupe(u8, &hex) catch "";
}

// Inside a quoted header parameter nothing may end the quote or the line.
pub fn quoted(out: *std.ArrayList(u8), text: []const u8) void {
    for (text) |c| {
        const esc: []const u8 = switch (c) {
            '\\' => "%5C",
            '"' => "%22",
            '\r' => "%0D",
            '\n' => "%0A",
            else => {
                out.append(h.A(), c) catch {};
                continue;
            },
        };
        out.appendSlice(h.A(), esc) catch {};
    }
}

// A local path never leaves: only its last segment, and nothing for an empty one.
pub fn base_name(name: ?[]const u8) ?[]const u8 {
    const n = name orelse return null;
    const at = std.mem.lastIndexOfAny(u8, n, "/\\");
    const base = if (at) |i| n[i + 1 ..] else n;
    return if (0 == base.len) null else base;
}

const Part = struct {
    filename: ?[]const u8 = null,
    ty: ?[]const u8 = null,
    content: []const u8,
};

// A file part's content is bytes: zig has no stream to refuse here.
fn file_part(field: Value, value: binary.ItemValue) Part {
    const media = h.get_str(field, "media");
    return switch (value) {
        .source => |s| .{
            .filename = base_name(s.name),
            .ty = s.ty orelse media orelse OCTET_MEDIA,
            .content = s.data,
        },
        .data => |v| .{ .ty = media orelse OCTET_MEDIA, .content = binary.item_text(v) },
    };
}

fn text_part(field: Value, value: binary.ItemValue) Part {
    return .{ .ty = h.get_str(field, "media"), .content = binary.item_bytes(value) };
}

pub fn encode_multipart(ctx: *Context, data: Value, lifted: []const binary.Lifted) err.E!binary.Encoded {
    const body = h.getp(ctx.point, "body");
    const boundary = if (ctx.utility) |u| u.boundary(ctx) else multipart_boundary(ctx);
    var out: std.ArrayList(u8) = .empty;
    const A = h.A();

    for (binary.body_items(body, data, lifted)) |item| {
        const part = if (item.binary) file_part(item.field, item.value) else text_part(item.field, item.value);
        if (part.ty) |t| {
            if (std.mem.indexOfAny(u8, t, "\r\n") != null) {
                return ctx.fail("binary_source_refused", std.fmt.allocPrint(A,
                    "The media type of the multipart field \"{s}\" contains a line break.", .{item.name}) catch "");
            }
        }
        out.appendSlice(A, "--") catch {};
        out.appendSlice(A, boundary) catch {};
        out.appendSlice(A, CRLF ++ "Content-Disposition: form-data; name=\"") catch {};
        quoted(&out, item.name);
        out.append(A, '"') catch {};
        if (part.filename) |f| {
            out.appendSlice(A, "; filename=\"") catch {};
            quoted(&out, f);
            out.append(A, '"') catch {};
        }
        out.appendSlice(A, CRLF) catch {};
        if (part.ty) |t| {
            out.appendSlice(A, "Content-Type: ") catch {};
            out.appendSlice(A, t) catch {};
            out.appendSlice(A, CRLF) catch {};
        }
        out.appendSlice(A, CRLF) catch {};
        out.appendSlice(A, part.content) catch {};
        out.appendSlice(A, CRLF) catch {};
    }
    out.appendSlice(A, "--") catch {};
    out.appendSlice(A, boundary) catch {};
    out.appendSlice(A, "--" ++ CRLF) catch {};

    const media = h.get_str(body, "media") orelse "";
    const semi = std.mem.indexOfScalar(u8, media, ';') orelse media.len;
    const essence = std.mem.trim(u8, media[0..semi], " \t");
    return .{
        .ty = std.fmt.allocPrint(A, "{s}; boundary={s}", .{ if (0 == essence.len) MULTIPART_MEDIA else essence, boundary }) catch "",
        .body = h.vstr(out.toOwnedSlice(A) catch ""),
    };
}
