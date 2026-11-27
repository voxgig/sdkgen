// An entity's named bytes (the zig port of tm/ts/src/utility/codec/HandleCodec.ts).
// Each call is one run of the entity's own operation on the slot's point; in
// core only whole, in-memory bodies move.

const std = @import("std");
const h = @import("../../core/helpers.zig");
const errmod = @import("../../core/error.zig");
const binary = @import("../../core/binary.zig");
const control_mod = @import("../../core/control.zig");

const Value = h.Value;
const SdkError = errmod.ProjectNameError;

// A slot the entity component derived from the model: the action whose
// points move its bytes ('' for the entity's own), and the operations that
// read and write them.
pub const BinarySlot = struct {
    name: []const u8,
    action: []const u8,
    read: ?[]const u8 = null,
    write: ?[]const u8 = null,
};

pub const BytesResult = union(enum) {
    ok: []const u8,
    err: *SdkError,
};

fn fmt(comptime f: []const u8, args: anytype) []const u8 {
    return std.fmt.allocPrint(h.A(), f, args) catch "";
}

pub fn BinaryHandle(comptime Ent: type) type {
    return struct {
        const Self = @This();

        entity: *Ent,
        slot: []const u8,
        def: ?BinarySlot,

        pub fn make(entity: *Ent, slots: []const BinarySlot, slot: []const u8) Self {
            var def: ?BinarySlot = null;
            for (slots) |s| {
                if (std.mem.eql(u8, s.name, slot)) def = s;
            }
            return .{ .entity = entity, .slot = slot, .def = def };
        }

        // The whole body, within maxBuffer. `opts` takes no key in core but
        // `range`, which needs the binary feature.
        pub fn bytes(self: Self, opts: Value, ctrl: Value) BytesResult {
            if (h.getp(opts, "range") != .null) return .{ .err = self.inactive("read a range") };
            const def = switch (self.direction(true)) {
                .err => |e| return .{ .err = e },
                .ok => |d| d,
            };
            const transfer = control_mod.Transfer.make(self.slot, "read");
            switch (self.entity.load_with(self.select(def), ctrl, .{ .transfer = transfer })) {
                .err => |e| return .{ .err = e },
                .ok => {},
            }
            return .{ .ok = transfer.bytes orelse "" };
        }

        // Sends in-memory content as the slot's body; resolves to the entity.
        pub fn put(self: Self, source: binary.BinarySource, ctrl: Value) Ent.Result {
            const def = switch (self.direction(false)) {
                .err => |e| return .{ .err = e },
                .ok => |d| d,
            };
            const sources = h.A().alloc(binary.SourceEntry, 1) catch unreachable;
            sources[0] = .{ .name = binary.RAW_BODY, .source = source };
            const opwith = binary.OpWith{ .sources = sources, .transfer = control_mod.Transfer.make(self.slot, "write") };
            const write = def.write orelse "update";
            if (std.mem.eql(u8, write, "create")) return self.entity.create_with(self.select(def), ctrl, opwith);
            if (std.mem.eql(u8, write, "patch")) return self.entity.patch_with(self.select(def), ctrl, opwith);
            return self.entity.update_with(self.select(def), ctrl, opwith);
        }

        pub fn save(self: Self) ?*SdkError {
            return self.inactive("save");
        }

        pub fn stream(self: Self) ?*SdkError {
            return self.inactive("stream");
        }

        pub fn open(self: Self) ?*SdkError {
            return self.inactive("open");
        }

        fn select(_: Self, def: BinarySlot) Value {
            if (0 == def.action.len) return h.omap();
            return h.jo(&.{.{ "$action", h.vstr(def.action) }});
        }

        const Direction = union(enum) {
            ok: BinarySlot,
            err: *SdkError,
        };

        fn direction(self: Self, read: bool) Direction {
            const def = self.def orelse return .{ .err = SdkError.make("binary_slot_unknown",
                fmt("Entity \"{s}\" has no binary slot \"{s}\".", .{ self.entity.name, self.slot })) };
            if ((if (read) def.read else def.write) == null) {
                return .{ .err = SdkError.make("binary_slot_direction", fmt("The binary slot \"{s}\" of entity " ++
                    "\"{s}\" cannot be {s}.", .{ self.slot, self.entity.name, if (read) "read" else "written" })) };
            }
            return .{ .ok = def };
        }

        fn inactive(self: Self, what: []const u8) *SdkError {
            return SdkError.make("binary_feature_inactive", fmt("The binary slot \"{s}\" of entity \"{s}\" " ++
                "cannot {s} without the binary feature; in core it answers bytes() and put().", .{ self.slot, self.entity.name, what }));
        }
    };
}
