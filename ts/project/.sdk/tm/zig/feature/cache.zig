// Response caching for safe (read) requests, per client (mirrors go
// feature/cache_feature.go / rust feature/cache.rs): see the features
// reference for the key, the write invalidation and the Cache-Control rules.

const std = @import("std");
const h = @import("../core/helpers.zig");
const err = @import("../core/error.zig");
const types = @import("../core/types.zig");
const sup = @import("support.zig");
const media = @import("../core/utility.zig");

const Value = h.Value;
const Context = types.Context;
const Feature = types.Feature;
const Fetcher = types.Fetcher;
const HmacSha256 = std.crypto.auth.hmac.sha2.HmacSha256;

pub const CacheSnapshot = struct {
    status: i64,
    status_text: []const u8,
    data: Value,
    headers: Value,
};

pub const CacheEntry = struct {
    expiry: i64,
    scope: []const u8,
    snapshot: *CacheSnapshot,
};

pub const CacheTrack = struct {
    store: std.StringHashMap(CacheEntry),
    order: std.ArrayList([]const u8),
    secret: [32]u8 = undefined,

    // Activity tracking (mirrors the ts client._cache record).
    hit: i64 = 0,
    miss: i64 = 0,
    bypass: i64 = 0,
};

pub const CacheFeature = struct {
    name: []const u8 = "cache",
    active: bool = true,
    add_opts: Value = .{ .null = {} },
    options: Value = .{ .null = {} },
    track: *CacheTrack,

    pub fn make() Feature {
        const self = h.A().create(CacheFeature) catch unreachable;
        const track = h.A().create(CacheTrack) catch unreachable;
        track.* = .{
            .store = std.StringHashMap(CacheEntry).init(h.A()),
            .order = .empty,
        };
        self.* = .{ .track = track };
        return .{ .ptr = @ptrCast(self), .vtable = &vtable };
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
        const self = self_of(p);
        self.options = options;
        self.active = sup.fopt_bool(options, "active", false);
        if (!self.active) return;

        h.IO().randomSecure(&self.track.secret) catch h.IO().random(&self.track.secret);

        const util = ctx.util();
        const w = h.A().create(WrapCtx) catch unreachable;
        w.* = .{ .inner = util.fetcher, .options = options, .track = self.track };
        util.fetcher = .{ .ctx = @ptrCast(w), .call = wrapCall };
    }
    fn vdispatch(p: *anyopaque, name: []const u8, ctx: *Context) void {
        _ = p;
        _ = name;
        _ = ctx;
    }

    fn self_of(p: *anyopaque) *CacheFeature {
        return @ptrCast(@alignCast(p));
    }

    const vtable = Feature.VTable{
        .name = vname,
        .active = vactive,
        .add_options = vaddopts,
        .init = vinit,
        .dispatch = vdispatch,
    };
};

const WrapCtx = struct {
    inner: Fetcher,
    options: Value,
    track: *CacheTrack,
};

fn wrapCall(p: *anyopaque, ctx: *Context, url: []const u8, fetchdef: Value) err.E!Value {
    const w: *WrapCtx = @ptrCast(@alignCast(p));
    return through(w.track, w.options, ctx, url, fetchdef, w.inner);
}

fn upperAlloc(s: []const u8) []const u8 {
    const buf = h.A().alloc(u8, s.len) catch return s;
    return std.ascii.upperString(buf, s);
}

fn lowerAlloc(s: []const u8) []const u8 {
    const buf = h.A().alloc(u8, s.len) catch return s;
    return std.ascii.lowerString(buf, s);
}

fn through(track: *CacheTrack, options: Value, ctx: *Context, url: []const u8, fetchdef: Value, inner: Fetcher) err.E!Value {
    const raw_method = h.get_str(fetchdef, "method") orelse "";
    const method_src = if (raw_method.len == 0) "GET" else raw_method;
    const method = upperAlloc(method_src);

    const methods: []const []const u8 = sup.fopt_str_list(options, "methods") orelse &[_][]const u8{"GET"};
    var cacheable = false;
    for (methods) |m| {
        if (std.ascii.eqlIgnoreCase(m, method)) {
            cacheable = true;
            break;
        }
    }
    if (!cacheable) {
        if (std.mem.eql(u8, method, "GET") or std.mem.eql(u8, method, "HEAD")) {
            return inner.invoke(ctx, url, fetchdef);
        }
        defer invalidate(track, url);
        return inner.invoke(ctx, url, fetchdef);
    }

    const hdigest = digest(&track.secret, h.getp(fetchdef, "headers"));
    const key = std.fmt.allocPrint(h.A(), "{s} {s} {s}", .{ method, url, hdigest }) catch method;
    const now = sup.fopt_now(options);

    if (track.store.get(key)) |hit| {
        if (hit.expiry > now) {
            const snap = hit.snapshot;
            track.hit += 1;
            return replay(snap);
        }
    }

    if (inner.invoke(ctx, url, fetchdef)) |res| {
        if (storable(res) and json(res)) {
            const snap = h.A().create(CacheSnapshot) catch unreachable;
            snap.* = snapshot(res);
            const ttl = lifetime(snap.headers, sup.fopt_int(options, "ttl", 5000));
            if (ttl <= 0) {
                track.bypass += 1;
                return replay(snap);
            }
            dropEntry(track, key);
            evict(track, options);
            track.store.put(key, .{ .expiry = now + ttl, .scope = urlScope(url), .snapshot = snap }) catch {};
            track.order.append(h.A(), key) catch {};
            track.miss += 1;
            return replay(snap);
        }
        track.bypass += 1;
        return res;
    } else |e| {
        track.bypass += 1;
        return e;
    }
}

fn headerText(v: Value) ?[]const u8 {
    return switch (v) {
        .string => |t| t,
        .integer => |n| std.fmt.allocPrint(h.A(), "{d}", .{n}) catch null,
        .float => |f| if (f == @floor(f) and @abs(f) < 9.0e15)
            std.fmt.allocPrint(h.A(), "{d}", .{@as(i64, @intFromFloat(f))}) catch null
        else
            std.fmt.allocPrint(h.A(), "{d}", .{f}) catch null,
        .bool => |b| if (b) "true" else "false",
        else => null,
    };
}

const HeaderPair = struct { name: []const u8, value: []const u8 };

fn pairLess(_: void, a: HeaderPair, b: HeaderPair) bool {
    const order = std.mem.order(u8, a.name, b.name);
    if (order != .eq) return order == .lt;
    return std.mem.lessThan(u8, a.value, b.value);
}

fn digest(secret: *const [32]u8, headers: Value) []const u8 {
    var pairs: std.ArrayList(HeaderPair) = .empty;
    if (headers == .object) {
        var it = headers.object.iterator();
        while (it.next()) |kv| {
            const text = headerText(kv.value_ptr.*) orelse continue;
            pairs.append(h.A(), .{ .name = lowerAlloc(kv.key_ptr.*), .value = text }) catch {};
        }
    }
    std.mem.sort(HeaderPair, pairs.items, {}, pairLess);
    var mac = HmacSha256.init(secret);
    for (pairs.items) |p| {
        mac.update(p.name);
        mac.update(":");
        mac.update(p.value);
        mac.update("\n");
    }
    var out: [HmacSha256.mac_length]u8 = undefined;
    mac.final(&out);
    const hex = std.fmt.bytesToHex(out, .lower);
    return h.A().dupe(u8, &hex) catch "";
}

fn invalidate(track: *CacheTrack, url: []const u8) void {
    const path = urlScope(url);
    const collection = urlParent(path);
    var dropped: std.ArrayList([]const u8) = .empty;
    var it = track.store.iterator();
    while (it.next()) |kv| {
        const scope = kv.value_ptr.scope;
        if (scopeUnder(scope, path) or std.mem.eql(u8, scope, collection)) {
            dropped.append(h.A(), kv.key_ptr.*) catch {};
        }
    }
    for (dropped.items) |key| dropEntry(track, key);
}

fn dropEntry(track: *CacheTrack, key: []const u8) void {
    if (!track.store.remove(key)) return;
    var i: usize = track.order.items.len;
    while (i > 0) {
        i -= 1;
        if (std.mem.eql(u8, track.order.items[i], key)) _ = track.order.orderedRemove(i);
    }
}

// The configured ttl capped by the response's Cache-Control; zero when the
// response may not be stored.
fn lifetime(headers: Value, ttl: i64) i64 {
    var control: []const u8 = "";
    if (headers == .object) {
        var it = headers.object.iterator();
        while (it.next()) |kv| {
            if (std.ascii.eqlIgnoreCase(kv.key_ptr.*, "cache-control")) {
                control = lowerAlloc(headerText(kv.value_ptr.*) orelse "");
            }
        }
    }
    var life = ttl;
    var parts = std.mem.splitScalar(u8, control, ',');
    while (parts.next()) |part| {
        const directive = std.mem.trim(u8, part, " \t");
        if (std.mem.eql(u8, directive, "no-store") or std.mem.eql(u8, directive, "private") or
            std.mem.eql(u8, directive, "no-cache")) return 0;
        if (std.mem.startsWith(u8, directive, "max-age")) {
            const rest = std.mem.trim(u8, directive["max-age".len..], " \t");
            if (rest.len == 0 or rest[0] != '=') continue;
            const value = std.mem.trim(u8, std.mem.trim(u8, rest[1..], " \t"), "\"");
            if (value.len == 0) continue;
            var digits = true;
            for (value) |c| digits = digits and std.ascii.isDigit(c);
            if (!digits) continue;
            const secs = std.fmt.parseInt(i64, value, 10) catch continue;
            life = @min(life, secs *| 1000);
        }
    }
    return life;
}

fn urlScope(url: []const u8) []const u8 {
    var end = std.mem.indexOfAny(u8, url, "?#") orelse url.len;
    while (end > 0 and url[end - 1] == '/') end -= 1;
    return url[0..end];
}

fn urlParent(scope: []const u8) []const u8 {
    var root: usize = 0;
    if (std.mem.indexOf(u8, scope, "://")) |scheme| {
        root = std.mem.indexOfScalarPos(u8, scope, scheme + 3, '/') orelse return scope;
    }
    const cut = std.mem.lastIndexOfScalar(u8, scope, '/') orelse 0;
    return scope[0..@max(cut, root)];
}

fn scopeUnder(scope: []const u8, prefix: []const u8) bool {
    if (std.mem.eql(u8, scope, prefix)) return true;
    return scope.len > prefix.len and std.mem.startsWith(u8, scope, prefix) and scope[prefix.len] == '/';
}

// A body the transport could not read as JSON passes through, for the operation to report.
fn storable(res: Value) bool {
    const status = sup.fres_status(res) orelse return false;
    if (h.get_bool(res, "unreadable") orelse false) return false;
    return status >= 200 and status < 300;
}

// A body that declares another type than JSON passes by, unread.
fn json(res: Value) bool {
    const headers = h.getp(res, "headers");
    if (headers != .object) return true;
    var it = headers.object.iterator();
    while (it.next()) |kv| {
        if (!std.ascii.eqlIgnoreCase(kv.key_ptr.*, "content-type") or kv.value_ptr.* != .string) continue;
        const declared = kv.value_ptr.*.string;
        return 0 == std.mem.trim(u8, declared, " \t").len or media.is_json_media(declared);
    }
    return true;
}

fn snapshot(res: Value) CacheSnapshot {
    const headers = h.omap();
    const rh = h.getp(res, "headers");
    if (rh == .object) {
        var it = rh.object.iterator();
        while (it.next()) |kv| {
            h.setp(headers, lowerAlloc(kv.key_ptr.*), kv.value_ptr.*);
        }
    }

    return .{
        .status = sup.fres_status(res) orelse 0,
        .status_text = h.get_str(res, "statusText") orelse "",
        .data = h.call_json(h.getp(res, "json")),
        .headers = headers,
    };
}

// replay builds a fresh transport-shaped response so the body stays
// re-readable for every consumer.
fn replay(snap: *CacheSnapshot) Value {
    const headers = h.omap();
    if (snap.headers == .object) {
        var it = snap.headers.object.iterator();
        while (it.next()) |kv| {
            h.setp(headers, kv.key_ptr.*, kv.value_ptr.*);
        }
    }
    return h.jo(&.{
        .{ "status", h.vnum(snap.status) },
        .{ "statusText", h.vstr(snap.status_text) },
        .{ "body", h.vstr("not-used") },
        .{ "json", h.json_thunk(snap.data) },
        .{ "headers", headers },
    });
}

// evict drops oldest entries (FIFO) until the store is under `max`.
fn evict(track: *CacheTrack, options: Value) void {
    const max: usize = @intCast(@max(sup.fopt_int(options, "max", 256), 0));
    while (track.store.count() >= max and track.order.items.len > 0) {
        const oldest = track.order.orderedRemove(0);
        _ = track.store.remove(oldest);
    }
}
