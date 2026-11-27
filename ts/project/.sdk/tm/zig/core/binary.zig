// File content a caller hands the SDK, the lift of the point's binary fields
// out of the request data, and the item order a form or multipart body
// carries (the zig port of tm/ts/src/utility/BinaryUtility.ts).

const std = @import("std");
const h = @import("helpers.zig");
const err = @import("error.zig");
const control_mod = @import("control.zig");
const ctxmod = @import("context.zig");
const schema = @import("schema.zig");

const Value = h.Value;
const Context = ctxmod.Context;
const E = err.E;

pub const RAW_BODY = "$body";

pub const DEFAULT_MAX_BUFFER: usize = 16777216;

// Held as given. A string is content, sent as it is: nothing here reads a path.
pub const BinarySource = struct {
    data: []const u8,
    name: ?[]const u8 = null,
    ty: ?[]const u8 = null,

    // The one source core builds: `BinarySource.bytes(data, name, type)`.
    pub fn bytes(data: []const u8, name: ?[]const u8, ty: ?[]const u8) BinarySource {
        const t: ?[]const u8 = if (ty) |s| (if (0 == s.len) null else s) else null;
        return .{ .data = data, .name = name, .ty = t };
    }

    pub fn size(self: BinarySource) usize {
        return self.data.len;
    }

    // A source serialised anywhere is described, never copied.
    pub fn to_value(self: BinarySource) Value {
        const desc = h.jo(&.{
            .{ "binary$", h.vstr("bytes") },
            .{ "size", h.vnum(@intCast(self.data.len)) },
        });
        if (self.ty) |t| h.setp(desc, "type", h.vstr(t));
        return desc;
    }
};

// The request data is a closed value union with no variant for a source, so
// sources travel beside it, by field name; a repeated name is a list.
pub const SourceEntry = struct {
    name: []const u8,
    source: BinarySource,
};

pub const Sources = []const SourceEntry;

// What an operation's with-form takes beside its data and control.
pub const OpWith = struct {
    sources: Sources = &.{},
    transfer: ?*control_mod.Transfer = null,
};

// A value moved out of the request data: a source the caller passed, or the
// data's own value under a binary name, which is content.
pub const Lifted = struct {
    name: []const u8,
    source: ?BinarySource = null,
    data: Value = .{ .null = {} },
};

pub const Encoded = struct {
    ty: []const u8,
    body: Value,
};

pub const EncodeFn = *const fn (ctx: *Context, data: Value, lifted: []const Lifted) E!Encoded;

pub const ReadFn = *const fn (ctx: *Context) E!void;

fn fmt(comptime f: []const u8, args: anytype) []const u8 {
    return std.fmt.allocPrint(h.A(), f, args) catch "";
}

fn as_size(v: Value) ?usize {
    return switch (v) {
        .integer => |i| if (0 <= i) @intCast(i) else null,
        .float => |f| if (std.math.isFinite(f) and 0 <= f) @intFromFloat(f) else null,
        else => null,
    };
}

pub fn max_buffer(ctx: *Context) usize {
    return as_size(h.getp(ctx.options, "maxBuffer")) orelse
        as_size(h.getp(schema.shared_optspec(), "maxBuffer")) orelse DEFAULT_MAX_BUFFER;
}

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

fn contains(names: []const []const u8, name: []const u8) bool {
    for (names) |n| {
        if (eql(n, name)) return true;
    }
    return false;
}

fn is_true(v: Value) bool {
    return v == .bool and v.bool;
}

// The data keys whose values are file content: a multipart or form body's
// binary fields, and the whole of a raw body.
pub fn binary_names(point: Value) []const []const u8 {
    const body = h.getp(point, "body");
    const kind = h.get_str(body, "kind") orelse return &.{};
    if (eql(kind, "raw")) {
        const one = h.A().alloc([]const u8, 1) catch return &.{};
        one[0] = RAW_BODY;
        return one;
    }
    if (!eql(kind, "multipart") and !eql(kind, "form")) return &.{};
    var out: std.ArrayList([]const u8) = .empty;
    const fields = h.getp(body, "fields");
    if (fields == .array) {
        for (fields.array.data.items) |f| {
            if (!is_true(h.getp(f, "binary"))) continue;
            const name = h.get_str(f, "name") orelse continue;
            out.append(h.A(), name) catch {};
        }
    }
    return out.toOwnedSlice(h.A()) catch &.{};
}

// Moves the values of binary fields out of the request data, before a hook,
// a transform, validation or clean reads it. A source passed under any other
// name is refused. The data and the match hold no source, so the ts walk of
// them has nothing to find here.
pub fn lift_sources(ctx: *Context) E!void {
    if (ctx.sources != null) return;

    const names = binary_names(ctx.point);
    const passed = ctx.passed;
    ctx.passed = &.{};

    for (passed) |entry| {
        if (!contains(names, entry.name)) {
            return ctx.fail("binary_source_refused", fmt("A binary source was passed in \"{s}\", " ++
                "which is not a field the operation declares binary.", .{entry.name}));
        }
    }

    var lifted: std.ArrayList(Lifted) = .empty;
    if (ctx.reqdata == .object) {
        var any = false;
        for (names) |name| {
            if (ctx.reqdata.object.get(name) != null) any = true;
        }
        if (any) {
            const copy = h.omap();
            var it = ctx.reqdata.object.iterator();
            while (it.next()) |kv| {
                if (contains(names, kv.key_ptr.*)) {
                    lifted.append(h.A(), .{ .name = kv.key_ptr.*, .data = kv.value_ptr.* }) catch {};
                } else {
                    h.setp(copy, kv.key_ptr.*, kv.value_ptr.*);
                }
            }
            ctx.reqdata = copy;
        }
    }
    for (passed) |entry| {
        lifted.append(h.A(), .{ .name = entry.name, .source = entry.source }) catch {};
    }
    ctx.sources = lifted.toOwnedSlice(h.A()) catch &.{};
}

// A response the model declares to be bytes is read only through the entity's
// binary handle, never into its data.
pub fn bytes_refused(ctx: *Context) E!void {
    const response = h.getp(ctx.point, "response");
    const kind = h.get_str(response, "kind") orelse return;
    if (!eql(kind, "raw") or !is_true(h.getp(response, "binary")) or ctx.ctrl.transfer != null) return;
    const call = if (h.get_str(h.getp(ctx.point, "select"), "$action")) |a|
        fmt("binary(\"{s}\")", .{a})
    else
        "binary(\"\")";
    return ctx.fail("binary_sink_required", fmt("Operation \"{s}\" on entity \"{s}\" answers bytes, " ++
        "which never enter the entity's data: read them with entity.{s}.bytes().", .{ ctx.op.name, ctx.op.entity, call }));
}

// A plain value as the text of a form pair or a multipart part.
pub fn item_text(value: Value) []const u8 {
    return switch (value) {
        .string => |s| s,
        .number_string => |s| s,
        .bool => |b| if (b) "true" else "false",
        .integer => |i| fmt("{d}", .{i}),
        .float => |f| if (std.math.isFinite(f) and @floor(f) == f and @abs(f) < 1e18)
            fmt("{d}", .{@as(i64, @intFromFloat(f))})
        else
            fmt("{d}", .{f}),
        else => h.jsonify_compact(value),
    };
}

// One value a form or multipart body carries for a field.
pub const ItemValue = union(enum) {
    source: BinarySource,
    data: Value,
};

pub const BodyItem = struct {
    name: []const u8,
    field: Value,
    value: ItemValue,
    binary: bool,
};

fn str_less(_: void, a: []const u8, b: []const u8) bool {
    return std.mem.lessThan(u8, a, b);
}

fn lifted_has(lifted: []const Lifted, name: []const u8) bool {
    for (lifted) |l| {
        if (eql(l.name, name)) return true;
    }
    return false;
}

// The values a form or multipart body carries, in wire order: the fields the
// model declares, in its order, then any other key of the data, in code point
// order. An array repeats its field per item, or is one value joined by the
// field's `join`; an absent or null value sends nothing.
pub fn body_items(body: Value, data: Value, lifted: []const Lifted) []const BodyItem {
    var fields: std.ArrayList(Value) = .empty;
    var declared: std.ArrayList([]const u8) = .empty;
    const fl = h.getp(body, "fields");
    if (fl == .array) {
        for (fl.array.data.items) |f| {
            const name = h.get_str(f, "name") orelse continue;
            fields.append(h.A(), f) catch {};
            declared.append(h.A(), name) catch {};
        }
    }

    var names: std.ArrayList([]const u8) = .empty;
    for (declared.items) |name| {
        const in_data = data == .object and data.object.get(name) != null;
        if (in_data or lifted_has(lifted, name)) names.append(h.A(), name) catch {};
    }
    var rest: std.ArrayList([]const u8) = .empty;
    if (data == .object) {
        var it = data.object.iterator();
        while (it.next()) |kv| {
            if (!contains(declared.items, kv.key_ptr.*)) rest.append(h.A(), kv.key_ptr.*) catch {};
        }
    }
    std.mem.sort([]const u8, rest.items, {}, str_less);
    names.appendSlice(h.A(), rest.items) catch {};

    var items: std.ArrayList(BodyItem) = .empty;
    for (names.items) |name| {
        var field: Value = h.jo(&.{.{ "name", h.vstr(name) }});
        for (fields.items, declared.items) |f, d| {
            if (eql(d, name)) {
                field = f;
                break;
            }
        }
        const binary = is_true(h.getp(field, "binary"));

        var sourced = false;
        for (lifted) |l| {
            if (!eql(l.name, name)) continue;
            if (l.source) |src| {
                items.append(h.A(), .{ .name = name, .field = field, .value = .{ .source = src }, .binary = binary }) catch {};
                sourced = true;
            }
        }
        if (sourced) continue;

        var value: Value = h.vnull();
        var found = false;
        for (lifted) |l| {
            if (eql(l.name, name) and l.source == null) {
                value = l.data;
                found = true;
                break;
            }
        }
        if (!found) value = h.getp(data, name);

        switch (value) {
            .null => {},
            .array => |l| {
                const join = h.get_str(field, "join");
                if (!binary and join != null) {
                    var text: std.ArrayList(u8) = .empty;
                    var first = true;
                    for (l.data.items) |v| {
                        if (v == .null) continue;
                        if (!first) text.appendSlice(h.A(), join.?) catch {};
                        text.appendSlice(h.A(), item_text(v)) catch {};
                        first = false;
                    }
                    const joined = text.toOwnedSlice(h.A()) catch "";
                    items.append(h.A(), .{ .name = name, .field = field, .value = .{ .data = h.vstr(joined) }, .binary = binary }) catch {};
                } else {
                    for (l.data.items) |v| {
                        if (v == .null) continue;
                        items.append(h.A(), .{ .name = name, .field = field, .value = .{ .data = v }, .binary = binary }) catch {};
                    }
                }
            },
            else => items.append(h.A(), .{ .name = name, .field = field, .value = .{ .data = value }, .binary = binary }) catch {},
        }
    }
    return items.toOwnedSlice(h.A()) catch &.{};
}

// The bytes an item sends: a source's data, else the value's text.
pub fn item_bytes(value: ItemValue) []const u8 {
    return switch (value) {
        .source => |s| s.data,
        .data => |v| item_text(v),
    };
}
