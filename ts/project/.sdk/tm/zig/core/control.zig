// Per-call control state (mirrors go core/control.go).

const h = @import("helpers.zig");
const err = @import("error.zig");
const Value = h.Value;

pub const Control = struct {
    throw: ?bool = null,
    err: ?*err.ProjectNameError = null,
    // explain / paging are Value maps when supplied (.null otherwise). They
    // are the caller's own maps (reference-shared), so recorded entries are
    // visible to the caller after the operation completes.
    explain: Value = .{ .null = {} },
    actor: []const u8 = "",
    paging: Value = .{ .null = {} },
    // Set by an entity's binary handle: the slot and the direction its bytes move.
    transfer: ?*Transfer = null,

    pub fn make() *Control {
        const c = h.A().create(Control) catch unreachable;
        c.* = .{};
        return c;
    }

    pub fn has_explain(self: *const Control) bool {
        return self.explain == .object;
    }
};

pub const Transfer = struct {
    slot: []const u8 = "",
    direction: []const u8 = "",
    bytes: ?[]const u8 = null,

    pub fn make(slot: []const u8, direction: []const u8) *Transfer {
        const t = h.A().create(Transfer) catch unreachable;
        t.* = .{ .slot = slot, .direction = direction };
        return t;
    }
};
