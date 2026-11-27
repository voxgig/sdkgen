// Every form, multipart and raw point this SDK has, driven through a real
// entity operation. This target ships no transport, so the request arrives
// at a system.fetch that decodes it, where the other targets run a local
// listener. The cases come from the client's own config; the entities they
// run on come from the generated table in codec_entities.zig.

const std = @import("std");
const sdk = @import("sdk");
const ents = @import("codec_entities.zig");

const h = sdk.h;
const Value = sdk.Value;
const A = h.A;

const Arrived = struct {
    method: []const u8,
    headers: Value,
    body: []const u8,
};

var answer_type: []const u8 = "";
var answer_body: []const u8 = "";
var arrivals: std.ArrayList(Arrived) = .empty;

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

fn answer(ty: []const u8, body: []const u8) void {
    answer_type = ty;
    answer_body = body;
}

fn arrived() !Arrived {
    if (0 == arrivals.items.len) return error.NothingArrived;
    return arrivals.items[arrivals.items.len - 1];
}

fn header(headers: Value, name: []const u8) []const u8 {
    if (headers != .object) return "";
    var it = headers.object.iterator();
    while (it.next()) |kv| {
        if (std.ascii.eqlIgnoreCase(kv.key_ptr.*, name) and kv.value_ptr.* == .string) return kv.value_ptr.*.string;
    }
    return "";
}

fn fetchCall(_: *anyopaque, _: std.mem.Allocator, arg: Value) anyerror!Value {
    const fetchdef = h.get_elem(arg, h.vnum(1), h.vnull());
    const body = h.getp(fetchdef, "body");
    arrivals.append(A(), .{
        .method = h.get_str(fetchdef, "method") orelse "",
        .headers = h.getp(fetchdef, "headers"),
        .body = if (body == .string) body.string else "",
    }) catch {};
    const ty = if (0 == answer_type.len) "application/json" else answer_type;
    const out = h.jo(&.{
        .{ "status", h.vnum(200) },
        .{ "statusText", h.vstr("OK") },
        .{ "headers", h.jo(&.{
            .{ "content-type", h.vstr(ty) },
            .{ "content-length", h.vstr(std.fmt.allocPrint(A(), "{d}", .{answer_body.len}) catch "0") },
        }) },
        .{ "body", h.vstr(answer_body) },
    });
    if (eql(ty, "application/json")) h.setp(out, "json", h.json_thunk(h.jo(&.{.{ "id", h.vstr("p1") }})));
    return out;
}

var fetch_anchor: u8 = 0;

fn client() *sdk.SDK {
    const opts = h.jo(&.{
        .{ "base", h.vstr("http://codec.local") },
        .{ "system", h.jo(&.{.{ "fetch", h.callable(@ptrCast(&fetch_anchor), fetchCall) }}) },
    });
    return switch (sdk.SDK.new(opts)) {
        .ok => |c| c,
        .err => |e| std.debug.panic("{s}", .{e.msg}),
    };
}

fn content(name: []const u8) []const u8 {
    return std.fmt.allocPrint(A(), "file:{s}\x00\xff\r\n--", .{name}) catch "";
}

fn items(v: Value) []const Value {
    return if (v == .array) v.array.data.items else &.{};
}

fn keys(v: Value) []const []const u8 {
    var out: std.ArrayList([]const u8) = .empty;
    if (v == .object) {
        var it = v.object.iterator();
        while (it.next()) |kv| out.append(A(), kv.key_ptr.*) catch {};
    }
    std.mem.sort([]const u8, out.items, {}, struct {
        fn less(_: void, a: []const u8, b: []const u8) bool {
            return std.mem.lessThan(u8, a, b);
        }
    }.less);
    return out.items;
}

// A value for each path parameter a point names.
fn params(point: Value) Value {
    const out = h.omap();
    for (items(h.getp(point, "parts"))) |part| {
        if (part != .string) continue;
        const s = part.string;
        if (2 < s.len and s[0] == '{' and s[s.len - 1] == '}') h.setp(out, s[1 .. s.len - 1], h.vstr("p1"));
    }
    return out;
}

fn action(point: Value) ?[]const u8 {
    return h.get_str(h.getp(point, "select"), "$action");
}

fn args(point: Value) Value {
    const out = params(point);
    if (action(point)) |a| h.setp(out, "$action", h.vstr(a));
    return out;
}

const Part = struct {
    name: []const u8,
    value: []const u8,
    filename: ?[]const u8 = null,
    ty: ?[]const u8 = null,
    file: bool = false,
};

fn samePart(a: Part, b: Part) bool {
    const opt = struct {
        fn eq(x: ?[]const u8, y: ?[]const u8) bool {
            if (x == null or y == null) return x == null and y == null;
            return eql(x.?, y.?);
        }
    };
    return eql(a.name, b.name) and eql(a.value, b.value) and a.file == b.file and
        opt.eq(a.filename, b.filename) and opt.eq(a.ty, b.ty);
}

const Plan = struct {
    data: Value,
    sources: []const sdk.SourceEntry,
    expect: []const Part,
};

// The data a form or multipart point is sent, the sources beside it, and the
// parts it must arrive as.
fn plan(body: Value) Plan {
    const form = eql(h.get_str(body, "kind") orelse "", "form");
    const data = h.omap();
    var sources: std.ArrayList(sdk.SourceEntry) = .empty;
    var expect: std.ArrayList(Part) = .empty;
    for (items(h.getp(body, "fields"))) |field| {
        const name = h.get_str(field, "name") orelse continue;
        if (h.getp(field, "binary") == .bool and h.getp(field, "binary").bool) {
            const ty: ?[]const u8 = if (form) null else (h.get_str(field, "media") orelse "application/octet-stream");
            const path = std.fmt.allocPrint(A(), "/local/dir/{s}.bin", .{name}) catch "";
            sources.append(A(), .{ .name = name, .source = sdk.BinarySource.bytes(content(name), path, ty) }) catch {};
            expect.append(A(), if (form) .{ .name = name, .value = content(name) } else .{
                .name = name,
                .value = content(name),
                .file = true,
                .filename = std.fmt.allocPrint(A(), "{s}.bin", .{name}) catch "",
                .ty = ty,
            }) catch {};
        } else if (h.getp(field, "list") == .bool and h.getp(field, "list").bool) {
            h.setp(data, name, h.ja(&.{ h.vstr("a"), h.vstr("b c") }));
            expect.append(A(), .{ .name = name, .value = "a" }) catch {};
            expect.append(A(), .{ .name = name, .value = "b c" }) catch {};
        } else if (h.get_str(field, "join")) |join| {
            h.setp(data, name, h.ja(&.{ h.vstr("a"), h.vstr("b") }));
            expect.append(A(), .{ .name = name, .value = std.fmt.allocPrint(A(), "a{s}b", .{join}) catch "" }) catch {};
        } else {
            const v = std.fmt.allocPrint(A(), "v\"{s}\r\n", .{name}) catch "";
            h.setp(data, name, h.vstr(v));
            expect.append(A(), .{ .name = name, .value = v }) catch {};
        }
    }
    return .{ .data = data, .sources = sources.items, .expect = expect.items };
}

fn unhex(c: u8) u8 {
    return std.fmt.charToDigit(c, 16) catch 0;
}

fn formDecode(text: []const u8) []const u8 {
    var out: std.ArrayList(u8) = .empty;
    var i: usize = 0;
    while (i < text.len) : (i += 1) {
        const c = text[i];
        if (c == '+') {
            out.append(A(), ' ') catch {};
        } else if (c == '%' and i + 2 < text.len) {
            out.append(A(), unhex(text[i + 1]) * 16 + unhex(text[i + 2])) catch {};
            i += 2;
        } else {
            out.append(A(), c) catch {};
        }
    }
    return out.items;
}

fn formParts(body: []const u8) []const Part {
    var out: std.ArrayList(Part) = .empty;
    if (0 == body.len) return out.items;
    var pairs = std.mem.splitScalar(u8, body, '&');
    while (pairs.next()) |pair| {
        const at = std.mem.indexOfScalar(u8, pair, '=') orelse pair.len;
        out.append(A(), .{
            .name = formDecode(pair[0..at]),
            .value = if (at < pair.len) formDecode(pair[at + 1 ..]) else "",
        }) catch {};
    }
    return out.items;
}

fn multipartParts(got: Arrived) ![]const Part {
    const ty = header(got.headers, "content-type");
    const at = std.mem.indexOf(u8, ty, "boundary=") orelse return error.NoBoundary;
    const boundary = ty[at + 9 ..];
    const delim = std.fmt.allocPrint(A(), "--{s}", .{boundary}) catch "";
    const close = std.fmt.allocPrint(A(), "--{s}--\r\n", .{boundary}) catch "";
    if (!std.mem.endsWith(u8, got.body, close)) return error.BodyDoesNotClose;

    var out: std.ArrayList(Part) = .empty;
    var pos = std.mem.indexOf(u8, got.body, delim) orelse return error.NoDelimiter;
    while (true) {
        const start = pos + delim.len;
        if (std.mem.startsWith(u8, got.body[start..], "--")) break;
        const next = std.mem.indexOfPos(u8, got.body, start, delim) orelse return error.UnterminatedPart;
        const chunk = got.body[start + 2 .. next - 2];
        const split = std.mem.indexOf(u8, chunk, "\r\n\r\n") orelse return error.NoBlankLine;
        var part = Part{ .name = "", .value = chunk[split + 4 ..] };
        var lines = std.mem.splitSequence(u8, chunk[0..split], "\r\n");
        while (lines.next()) |line| {
            if (std.mem.startsWith(u8, line, "Content-Disposition: form-data; ")) {
                var ps = std.mem.splitSequence(u8, line["Content-Disposition: form-data; ".len..], "; ");
                while (ps.next()) |p| {
                    if (std.mem.startsWith(u8, p, "name=")) part.name = std.mem.trim(u8, p[5..], "\"");
                    if (std.mem.startsWith(u8, p, "filename=")) {
                        part.filename = std.mem.trim(u8, p[9..], "\"");
                        part.file = true;
                    }
                }
            } else if (std.mem.startsWith(u8, line, "Content-Type: ")) {
                part.ty = line[14..];
            } else {
                std.debug.print("codec: a part header that is not allowed: {s}\n", .{line});
                return error.PartHeader;
            }
        }
        if (!part.file) part.ty = null;
        out.append(A(), part) catch {};
        pos = next;
    }
    return out.items;
}

fn expectParts(got: []const Part, expect: []const Part) !void {
    var kept: std.ArrayList(Part) = .empty;
    for (got) |g| {
        for (expect) |x| {
            if (eql(x.name, g.name)) {
                kept.append(A(), g) catch {};
                break;
            }
        }
    }
    if (kept.items.len != expect.len) return error.PartCount;
    for (kept.items, expect) |g, x| {
        if (!samePart(g, x)) {
            std.debug.print("codec: part {s} arrived as {any}\n", .{ x.name, g });
            return error.PartDiffers;
        }
    }
}

fn expectCode(code: []const u8, got: ?*sdk.ProjectNameError) !void {
    const e = got orelse return error.NotRefused;
    if (!eql(e.code, code)) {
        std.debug.print("codec: expected {s}, got {s}: {s}\n", .{ code, e.code, e.msg });
        return error.WrongCode;
    }
}

const Kind = enum { encoded, raw_write, raw_read, refusals };

const Case = struct {
    name: []const u8,
    kind: Kind,
    entity: []const u8,
    opname: []const u8 = "",
    point: Value = .{ .null = {} },
};

fn runCase(c: Case) !void {
    const e = ents.entity(client(), c.entity) orelse return error.NoEntity;
    const rb = h.getp(c.point, "body");
    const rs = h.getp(c.point, "response");
    switch (c.kind) {
        .encoded => {
            const p = plan(rb);
            const a = args(c.point);
            for (keys(p.data)) |k| h.setp(a, k, h.getp(p.data, k));
            answer("application/json", "{\"id\":\"p1\"}");
            switch (e.op(e.ptr, c.opname, a, h.vnull(), .{ .sources = p.sources })) {
                .err => |x| {
                    std.debug.print("codec: {s}\n", .{x.msg});
                    return error.OperationFailed;
                },
                .ok => {},
            }
            const got = try arrived();
            if (eql(h.get_str(rb, "kind") orelse "", "form")) {
                if (!eql(header(got.headers, "content-type"), h.get_str(rb, "media") orelse "")) return error.ContentType;
                try expectParts(formParts(got.body), p.expect);
            } else {
                try expectParts(try multipartParts(got), p.expect);
            }
        },
        .raw_write => {
            answer("application/json", "{\"id\":\"p1\"}");
            e.set(e.ptr, params(c.point));
            const media = h.get_str(rb, "media") orelse "";
            if (h.getp(rb, "binary") == .bool and h.getp(rb, "binary").bool) {
                const put = e.put orelse return error.NoSlot;
                switch (put(e.ptr, action(c.point) orelse "", sdk.BinarySource.bytes(content(c.name), null, media), h.vnull())) {
                    .err => |x| {
                        std.debug.print("codec: {s}\n", .{x.msg});
                        return error.PutFailed;
                    },
                    .ok => |same| if (!same) return error.PutNotTheEntity,
                }
                if (!eql((try arrived()).body, content(c.name))) return error.BodyDiffers;
            } else {
                const text = std.fmt.allocPrint(A(), "text \"{s}\"\n", .{c.name}) catch "";
                const a = h.omap();
                if (action(c.point)) |act| h.setp(a, "$action", h.vstr(act));
                h.setp(a, "$body", h.vstr(text));
                switch (e.op(e.ptr, c.opname, a, h.vnull(), .{})) {
                    .err => return error.OperationFailed,
                    .ok => {},
                }
                if (!eql((try arrived()).body, text)) return error.BodyDiffers;
            }
            if (!eql(header((try arrived()).headers, "content-type"), media)) return error.ContentType;
        },
        .raw_read => {
            e.set(e.ptr, params(c.point));
            const media = h.get_str(rs, "media") orelse "";
            if (h.getp(rs, "binary") == .bool and h.getp(rs, "binary").bool) {
                answer(media, content(c.name));
                const bytes = e.bytes orelse return error.NoSlot;
                switch (bytes(e.ptr, action(c.point) orelse "", h.vnull(), h.vnull())) {
                    .err => |x| {
                        std.debug.print("codec: {s}\n", .{x.msg});
                        return error.BytesFailed;
                    },
                    .ok => |b| if (!eql(b, content(c.name))) return error.BytesDiffer,
                }
                switch (e.op(e.ptr, "load", args(c.point), h.vnull(), .{})) {
                    .err => |x| try expectCode("binary_sink_required", x),
                    .ok => return error.NotRefused,
                }
            } else {
                const text = std.fmt.allocPrint(A(), "caf\xc3\xa9 {s}", .{c.name}) catch "";
                answer(media, text);
                switch (e.op(e.ptr, "load", args(c.point), h.vnull(), .{})) {
                    .err => return error.OperationFailed,
                    .ok => |data| if (!eql(h.get_str(data, "$body") orelse "", text)) return error.TextDiffers,
                }
            }
        },
        .refusals => {
            const inactive = e.inactive orelse return error.NoSlot;
            for (inactive(e.ptr, "")) |x| try expectCode("binary_feature_inactive", x);
            const bytes = e.bytes.?;
            const put = e.put.?;
            switch (bytes(e.ptr, "", h.jo(&.{.{ "range", h.vstr("bytes=0-1") }}), h.vnull())) {
                .err => |x| try expectCode("binary_feature_inactive", x),
                .ok => return error.NotRefused,
            }
            switch (bytes(e.ptr, "nope", h.vnull(), h.vnull())) {
                .err => |x| try expectCode("binary_slot_unknown", x),
                .ok => return error.NotRefused,
            }
            for (e.slots) |slot| {
                if (!slot.read) switch (bytes(e.ptr, slot.name, h.vnull(), h.vnull())) {
                    .err => |x| try expectCode("binary_slot_direction", x),
                    .ok => return error.NotRefused,
                };
                if (!slot.write) switch (put(e.ptr, slot.name, sdk.BinarySource.bytes("x", null, null), h.vnull())) {
                    .err => |x| try expectCode("binary_slot_direction", x),
                    .ok => return error.NotRefused,
                };
            }
        },
    }
}

fn cases() []const Case {
    const config = sdk.make_config();
    var out: std.ArrayList(Case) = .empty;
    const entmap = h.getp(config, "entity");
    for (keys(entmap)) |ename| {
        const ops = h.getp(h.getp(entmap, ename), "op");
        for (keys(ops)) |opname| {
            for (items(h.getp(h.getp(ops, opname), "points"))) |point| {
                const label = if (action(point)) |a|
                    std.fmt.allocPrint(A(), "{s}.{s}:{s}", .{ ename, opname, a }) catch ""
                else
                    std.fmt.allocPrint(A(), "{s}.{s}", .{ ename, opname }) catch "";
                const rbkind = h.get_str(h.getp(point, "body"), "kind") orelse "";
                const rskind = h.get_str(h.getp(point, "response"), "kind") orelse "";
                const writes = eql(opname, "create") or eql(opname, "update") or eql(opname, "patch");
                const base = Case{ .name = label, .kind = .encoded, .entity = ename, .opname = opname, .point = point };
                if ((eql(rbkind, "form") or eql(rbkind, "multipart")) and writes) {
                    var c = base;
                    c.kind = .encoded;
                    out.append(A(), c) catch {};
                }
                if (eql(rbkind, "raw") and writes) {
                    var c = base;
                    c.kind = .raw_write;
                    out.append(A(), c) catch {};
                }
                if (eql(rskind, "raw") and eql(opname, "load")) {
                    var c = base;
                    c.kind = .raw_read;
                    out.append(A(), c) catch {};
                }
            }
        }
        if (ents.entity(client(), ename)) |e| {
            if (e.inactive != null) {
                out.append(A(), .{ .name = ename, .kind = .refusals, .entity = ename }) catch {};
            }
        }
    }
    return out.items;
}

test "codec: every body point round-trips through system.fetch" {
    const all = cases();
    try std.testing.expect(0 < all.len);

    var ran: usize = 0;
    var failed: usize = 0;
    for (all) |c| {
        ran += 1;
        arrivals.clearRetainingCapacity();
        answer("", "");
        runCase(c) catch |e| {
            failed += 1;
            std.debug.print("codec: FAILED {s} {s}: {s}\n", .{ c.name, @tagName(c.kind), @errorName(e) });
            continue;
        };
        std.debug.print("codec: ok {s} {s}\n", .{ c.name, @tagName(c.kind) });
    }
    std.debug.print("codec: ran {d} case(s), {d} failed\n", .{ ran, failed });
    try std.testing.expectEqual(@as(usize, 0), failed);
}
