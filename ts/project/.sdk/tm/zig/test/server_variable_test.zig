// A templated base URL takes each {name} from the `server` option. A missing
// or empty value refuses construction; test mode fills in test-<name>.

const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const testing = std.testing;

// A variable no API declares, so the API's own server defaults cannot fill it.
const BASE = "https://api.example.test/bot{zzvar}";

fn baseOf(client: *sdk.SDK) []const u8 {
    return h.get_str(client.options_map(), "base") orelse "";
}

test "server variable: a missing or empty value refuses construction" {
    for ([_]sdk.Value{ h.omap(), h.jo(&.{.{ "zzvar", h.vstr("") }}) }) |server| {
        switch (sdk.SDK.new(h.jo(&.{ .{ "base", h.vstr(BASE) }, .{ "server", server } }))) {
            .ok => return error.ConstructionShouldRefuse,
            .err => |e| {
                try testing.expectEqualStrings("server_var_required", e.code);
                try testing.expect(null != std.mem.indexOf(u8, e.msg, "the server variable 'zzvar' is required"));
                try testing.expect(null != std.mem.indexOf(u8, e.msg, BASE));
            },
        }
    }
}

test "server variable: a value fills the base" {
    const client = sdk.SDK.new(h.jo(&.{
        .{ "base", h.vstr(BASE) },
        .{ "server", h.jo(&.{.{ "zzvar", h.vstr("T1") }}) },
    })).ok;
    try testing.expectEqualStrings("https://api.example.test/botT1", baseOf(client));
}

test "server variable: test mode fills test-<name>" {
    const client = sdk.SDK.new(h.jo(&.{
        .{ "base", h.vstr(BASE) },
        .{ "test", h.jo(&.{.{ "active", h.vbool(true) }}) },
    })).ok;
    try testing.expectEqualStrings("https://api.example.test/bottest-zzvar", baseOf(client));

    const mock = sdk.test_sdk(h.vnull(), h.jo(&.{.{ "base", h.vstr(BASE) }}));
    try testing.expectEqualStrings("https://api.example.test/bottest-zzvar", baseOf(mock));
}
