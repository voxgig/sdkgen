// Pagination support for list operations (mirrors go feature/paging_feature.go
// / rust feature/paging.rs). On the way out (PreRequest) it stamps page/limit
// (or a cursor) into the request query; on the way back (PreResult) it reads
// the server's pagination signals — a `Link: rel="next"` header,
// `X-Page`/`X-Next-Page`/`X-Total-Count` headers, or
// `next`/`cursor`/`nextCursor`/`hasMore` fields in the body — and records them
// on `result.paging`. A per-call cursor/page from ctrl takes priority (used by
// auto-iteration). Parameter names (`pageParam`, `limitParam`, `cursorParam`),
// the page size (`limit`) and the start page (`startPage`, default 1) are
// configurable.

const std = @import("std");
const h = @import("../core/helpers.zig");
const types = @import("../core/types.zig");
const sup = @import("support.zig");

const Value = h.Value;
const Context = types.Context;
const Feature = types.Feature;

fn lowerAlloc(s: []const u8) []const u8 {
    const buf = h.A().alloc(u8, s.len) catch return s;
    return std.ascii.lowerString(buf, s);
}

// Extract the URL of the `rel="next"` entry from a Link header value.
fn link_next(link: []const u8) ?[]const u8 {
    var it = std.mem.splitScalar(u8, link, ',');
    while (it.next()) |seg| {
        const lower = lowerAlloc(seg);
        if (std.mem.indexOf(u8, lower, "rel=\"next\"") != null or std.mem.indexOf(u8, lower, "rel=next") != null) {
            const open = std.mem.indexOfScalar(u8, seg, '<') orelse return null;
            const close = std.mem.indexOfScalar(u8, seg, '>') orelse return null;
            if (open < close) {
                return seg[open + 1 .. close];
            }
        }
    }
    return null;
}

fn header_num(headers: Value, name: []const u8, paging: Value, key: []const u8) void {
    const v = sup.fheader_get(headers, name) orelse return;
    switch (v) {
        .string => |s| {
            const n = sup.fparse_int(s, -1);
            if (n >= 0) h.setp(paging, key, h.vnum(n));
        },
        .integer => |n| h.setp(paging, key, h.vnum(n)),
        .float => |f| h.setp(paging, key, h.vfloat(f)),
        else => {},
    }
}

pub const PagingFeature = struct {
    name: []const u8 = "paging",
    active: bool = true,
    add_opts: Value = .{ .null = {} },
    options: Value = .{ .null = {} },

    // Activity tracking (mirrors the ts client._paging record).
    last: Value = .{ .null = {} },

    pub fn make() Feature {
        const self = h.A().create(PagingFeature) catch unreachable;
        self.* = .{};
        return .{ .ptr = @ptrCast(self), .vtable = &vtable };
    }

    fn self_of(p: *anyopaque) *PagingFeature {
        return @ptrCast(@alignCast(p));
    }

    fn is_list(self: *PagingFeature, ctx: *Context) bool {
        const opname = ctx.op.name;
        const ops: []const []const u8 = sup.fopt_str_list(self.options, "ops") orelse &[_][]const u8{"list"};
        for (ops) |o| {
            if (std.mem.eql(u8, o, opname)) return true;
        }
        return false;
    }

    fn pre_request(self: *PagingFeature, ctx: *Context) void {
        if (!self.active or !self.is_list(ctx)) return;
        const sp = ctx.spec orelse return;

        const query: Value = if (sp.query == .object) sp.query else blk: {
            const nq = h.omap();
            sp.query = nq;
            break :blk nq;
        };

        const page_param = sup.fopt_str(self.options, "pageParam", "page");
        const limit_param = sup.fopt_str(self.options, "limitParam", "limit");
        const cursor_param = sup.fopt_str(self.options, "cursorParam", "cursor");

        // A per-call cursor/page from ctrl takes priority (auto-iteration).
        const paging = ctx.ctrl.paging;

        const cursor = h.getp(paging, "cursor");
        if (!h.is_noval(cursor)) {
            h.setp(query, cursor_param, cursor);
        } else if (h.is_noval(h.getp(query, page_param))) {
            const page = h.getp(paging, "page");
            if (!h.is_noval(page)) {
                h.setp(query, page_param, page);
            } else {
                h.setp(query, page_param, h.vnum(sup.fopt_int(self.options, "startPage", 1)));
            }
        }

        if (!h.is_noval(h.getp(self.options, "limit")) and h.is_noval(h.getp(query, limit_param))) {
            h.setp(query, limit_param, h.vnum(sup.fopt_int(self.options, "limit", 0)));
        }
    }

    fn pre_result(self: *PagingFeature, ctx: *Context) void {
        if (!self.active or !self.is_list(ctx)) return;
        const result = ctx.result orelse return;

        const headers = result.headers;
        const body = result.body;

        const paging = h.omap();
        h.setp(paging, "hasMore", h.vbool(false));
        header_num(headers, "x-page", paging, "page");
        header_num(headers, "x-total-count", paging, "totalCount");
        header_num(headers, "x-next-page", paging, "nextPage");

        // Link: <...>; rel="next"
        if (sup.fheader_get(headers, "link")) |lv| {
            if (lv == .string) {
                if (link_next(lv.string)) |next| {
                    h.setp(paging, "next", h.vstr(next));
                }
            }
        }

        // Body-level cursors.
        if (body == .object) {
            const next = h.getp(body, "next");
            if (!h.is_noval(next) and h.is_noval(h.getp(paging, "next"))) {
                h.setp(paging, "next", next);
            }
            const cursor = h.getp(body, "cursor");
            if (!h.is_noval(cursor)) {
                h.setp(paging, "cursor", cursor);
            }
            const next_cursor = h.getp(body, "nextCursor");
            if (!h.is_noval(next_cursor)) {
                h.setp(paging, "cursor", next_cursor);
            }
            if (h.get_bool(body, "hasMore")) |has_more| {
                h.setp(paging, "hasMore", h.vbool(has_more));
            }
        }

        if ((h.get_bool(paging, "hasMore") orelse false) != true and
            (!h.is_noval(h.getp(paging, "next")) or
            !h.is_noval(h.getp(paging, "cursor")) or
            !h.is_noval(h.getp(paging, "nextPage"))))
        {
            h.setp(paging, "hasMore", h.vbool(true));
        }

        result.paging = paging;
        self.last = paging;
    }

    fn vname(p: *anyopaque) []const u8 {
        return self_of(p).name;
    }
    fn vactive(p: *anyopaque) bool {
        return self_of(p).active;
    }
    fn vaddopts(p: *anyopaque) Value {
        return self_of(p).add_opts;
    }
    fn vinit(p: *anyopaque, ctx: *Context, options: Value) void {
        _ = ctx;
        const self = self_of(p);
        self.options = options;
        self.active = sup.fopt_bool(options, "active", false);
    }
    fn vdispatch(p: *anyopaque, name: []const u8, ctx: *Context) void {
        const self = self_of(p);
        if (std.mem.eql(u8, name, "PreRequest")) {
            self.pre_request(ctx);
        } else if (std.mem.eql(u8, name, "PreResult")) {
            self.pre_result(ctx);
        }
    }

    const vtable = Feature.VTable{
        .name = vname,
        .active = vactive,
        .add_options = vaddopts,
        .init = vinit,
        .dispatch = vdispatch,
    };
};
