
import {
  Content,
  File,
  cmp,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated. The zig peer of PrepareAuth_ts; read that one
// first, it carries the full account of the defect.
//
// zig differs from the other twelve ports in ONE way: it had no
// prepare_auth template to delete. The logic was EMBEDDED in
// `tm/zig/core/utility.zig` — three file-scope constants and a
// `pub fn prepare_auth_util` in the middle of a 1500-line module that also
// holds make_spec, make_url, the result builders and the Utility bundle
// itself. So this is an EXTRACTION, not a replacement:
//
//   core/prepare_auth.zig   GENERATED here, one function.
//   core/utility.zig        keeps
//                             pub const prepare_auth_util =
//                                 @import("prepare_auth.zig").prepare_auth_util;
//
// THE OWN-FILE SHAPE, not the whole-module-as-a-component fallback. A zig
// file IS a struct, so a function in its own file is a first-class
// compilation unit reached by a relative `@import` — no build.zig entry, no
// module declaration, nothing to register. Generating the whole of
// utility.zig instead would turn 1500 lines of hand-maintained template
// into a TypeScript string for the sake of 40, which is the opposite of the
// trade the other targets made.
//
// THE BINDING DOES NOT MOVE. Three call sites name this symbol and all three
// keep resolving to it through the re-export:
//   - `Utility.prepare_auth` (core/utility.zig) — the method the pipeline
//     dispatches through, called by core/sdk.zig (Main.fragment.zig line
//     `self.sdkUtility.prepare_auth(ctx)`) and asserted on by
//     test/pipeline_test.zig.
//   - `make_spec_util` (core/utility.zig) — `try prepare_auth_util(ctx)`,
//     unqualified, so the file-scope const is what it finds.
//   - `sdk.utilmod.prepare_auth_util` — root.zig exports core/utility.zig as
//     `utilmod`, and test/primary_utility_test.zig drives the shared
//     corpus's `prepareAuth` section through it.
//
// A template cannot fix the defect, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — and zig makes that
// stricter than most: an unused LOCAL is a compile error, so a file that
// bound `auth_prefix` and then dropped it for a query placement would not
// build at all.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const active = isAuthActive_zig(model)
  const where = resolveAuthIn(model)
  const name = resolveAuthName(model)
  // Read so the resolution is visible at generation time even though the
  // emitted code takes the prefix from `options.auth.prefix` at RUNTIME -
  // it has to, because the secrets feature rewrites it there.
  const prefix = resolveAuthPrefix(model)
  const basic = isHttpBasicAuth(model)

  // FOLDER NESTING — NO Folder IS OPENED HERE, and that is worked out from
  // two facts, not assumed.
  //
  // 1. The template this extracts from is `tm/zig/core/utility.zig`, and
  //    Main_zig's `Copy({from: 'tm/zig'})` runs at the TARGET ROOT with no
  //    folder open (zig's layout is flat there: core/, feature/, utility/,
  //    entity/, test/ — Main_zig's own comment says the idiomatic src/ is
  //    deliberately not used). So that template lands at `<root>/core/`,
  //    and the extracted function must land in the same directory for
  //    `@import("prepare_auth.zig")` — a SIBLING-relative path — to resolve.
  //
  // 2. Main_zig ALREADY opens `Folder({name: 'core'})` for core/sdk.zig and
  //    for Config, and that is where this component is called. Config_zig
  //    writes `File({name: 'config.zig'})` with no Folder of its own for
  //    exactly this reason.
  //
  // Opening a second `core` here would write `core/core/prepare_auth.zig`:
  // a file no `@import` names, invisible to `zig build` (which analyses only
  // what a module root reaches), while core/utility.zig's re-export fails to
  // resolve — or, worse in the ts port's version of this trap, silently
  // keeps using a stale sibling. Verified by generating the target and
  // running `zig build test` against the result, not by eye: a file zig
  // never reaches produces no error at all.
  File({ name: 'prepare_auth.' + target.ext }, () => {
    Content(render({ active, where, name, prefix, basic }))
  })
})


type AuthSpec = {
  active: boolean
  where: string
  name: string
  prefix: string
  basic: boolean
}


const HEAD = `// prepare_auth — GENERATED from the model (src/cmp/zig/PrepareAuth_zig.ts),
// not copied from tm/zig, because WHERE THE CREDENTIAL GOES IS A FACT ABOUT
// THIS API. apidef resolves the security scheme's \`in\` and \`name\` into
// main.kit.info.security; a template can hold only one answer, and the one it
// held was an \`authorization\` header, so an apiKey-in-query API was sent a
// header it does not read and never sent the query parameter it does.
//
// This function used to live in core/utility.zig. It is re-exported from
// there (\`pub const prepare_auth_util = @import("prepare_auth.zig")...\`), so
// Utility.prepare_auth, make_spec_util and sdk.utilmod.prepare_auth_util all
// still reach the same symbol.
`


function render(spec: AuthSpec): string {
  // NO GENERATION-TIME GATE ON WHETHER TO PLACE A CREDENTIAL AT ALL, beyond
  // the project's own explicit switch — see isAuthActive_zig below for why
  // `isAuthActive` is the wrong predicate here.
  if (!spec.active) return renderInactive()

  if ('query' === spec.where) return renderQuery(spec)
  if ('cookie' === spec.where) return renderCookie(spec)

  return renderHeader(spec)
}


// AUTH SWITCHED OFF BY THE PROJECT (`main.kit.config.auth.active: false`).
// The SDK gets a prepare_auth that is honest about it rather than one that
// deletes a header nobody set. Nothing but the Context and Spec types is
// imported: zig tolerates an unused file-scope const, but a reader should
// not have to decide whether `vs` here means something.
function renderInactive(): string {
  return HEAD + `//
// THIS SDK SENDS NO CREDENTIAL: the project set
// \`main.kit.config.auth.active: false\`, which is the documented, explicit
// way to say so. The function stays in the pipeline because make_spec calls
// it unconditionally.

const h = @import("helpers.zig");
const ctxmod = @import("context.zig");
const spec_mod = @import("spec.zig");

const Context = ctxmod.Context;
const Spec = spec_mod.Spec;
const E = h.E;
` + facts('header', false, false) + `
pub fn prepare_auth_util(ctx: *Context) E!*Spec {
    const spec = ctx.spec orelse return ctx.fail("auth_no_spec", "Expected context spec property to be defined.");
    return spec;
}
`
}


// HEADER — the default, and BYTE-FOR-BYTE the body that was in
// core/utility.zig when the scheme resolves to header/Authorization. Only
// the constant's VALUE moves with the model, plus the HTTP Basic block,
// which is emitted only for a basic scheme.
function renderHeader(spec: AuthSpec): string {
  const withBasic = spec.basic

  return HEAD + imports({ vs: true, fmt: true }) +
    facts(spec.where, withBasic, true) + `
const CRED_NAME = ${zigstr(credLiteral(spec.where, spec.name))};
const OPTION_APIKEY = "apikey";
` + (withBasic ? `const OPTION_SECRET = "secret";
` : '') + `const NOT_FOUND = "__NOTFOUND__";
` + (withBasic ? basicHelpers() : '') + `
pub fn prepare_auth_util(ctx: *Context) E!*Spec {
    const spec = ctx.spec orelse return ctx.fail("auth_no_spec", "Expected context spec property to be defined.");

    const headers = spec.headers;
    const options: Value = if (ctx.client) |client| client.options_map() else ctx.options;

    // Public APIs that need no auth omit the options.auth block entirely.
    const auth = h.getp(options, "auth");
    if (h.is_noval(auth)) {
        h.del_prop(headers, h.vstr(CRED_NAME));
        return spec;
    }

    const apikey = vs.getprop(h.A(), options, h.vstr(OPTION_APIKEY), h.vstr(NOT_FOUND)) catch h.vstr(NOT_FOUND);

    const skip = switch (apikey) {
        .null => true,
        .string => |s| std.mem.eql(u8, s, NOT_FOUND) or s.len == 0,
        else => false,
    };
` + (withBasic ? basicBlock() : '') + `
    if (skip) {
        h.del_prop(headers, h.vstr(CRED_NAME));
    } else {
        const auth_prefix: []const u8 = switch (h.getpath(&.{ "auth", "prefix" }, options)) {
            .string => |s| s,
            else => "",
        };
        const apikey_val: []const u8 = switch (apikey) {
            .string => |s| s,
            else => "",
        };
        // A raw credential (empty prefix, e.g. an apiKey scheme) must go in
        // as-is; only a non-empty prefix (Bearer/Basic/OAuth) is space-joined.
        if (auth_prefix.len == 0) {
            h.setp(headers, CRED_NAME, h.vstr(apikey_val));
        } else {
            h.setp(headers, CRED_NAME, h.vstr(fmt("{s} {s}", .{ auth_prefix, apikey_val })));
        }
    }

    return spec;
}
`
}


// QUERY — the credential is a query parameter, so it goes in spec.query and
// the header bag is never touched. No `fmt`, because nothing is joined:
// zig would accept an unused file-scope helper, but emitting one invites the
// reader to look for the concatenation that is deliberately absent.
function renderQuery(spec: AuthSpec): string {
  return HEAD + imports({ vs: true, fmt: false }) +
    facts(spec.where, false, true) + `
const CRED_NAME = ${zigstr(credLiteral(spec.where, spec.name))};
const OPTION_APIKEY = "apikey";
const NOT_FOUND = "__NOTFOUND__";

pub fn prepare_auth_util(ctx: *Context) E!*Spec {
    const spec = ctx.spec orelse return ctx.fail("auth_no_spec", "Expected context spec property to be defined.");

    const query = spec.query;
    const options: Value = if (ctx.client) |client| client.options_map() else ctx.options;

    // Public APIs that need no auth omit the options.auth block entirely.
    const auth = h.getp(options, "auth");
    if (h.is_noval(auth)) {
        h.del_prop(query, h.vstr(CRED_NAME));
        return spec;
    }

    const apikey = vs.getprop(h.A(), options, h.vstr(OPTION_APIKEY), h.vstr(NOT_FOUND)) catch h.vstr(NOT_FOUND);

    const skip = switch (apikey) {
        .null => true,
        .string => |s| std.mem.eql(u8, s, NOT_FOUND) or s.len == 0,
        else => false,
    };

    if (skip) {
        h.del_prop(query, h.vstr(CRED_NAME));
    } else {
        const apikey_val: []const u8 = switch (apikey) {
            .string => |s| s,
            else => "",
        };
        // NO PREFIX IN A QUERY STRING. \`?${spec.name}=Bearer%20abc\` is not a
        // thing any API reads: the prefix is a header convention, so it is
        // dropped here deliberately rather than silently concatenated. Nor is
        // there an HTTP Basic branch - \`Authorization: Basic base64(u:p)\`
        // cannot be a query parameter.
        h.setp(query, CRED_NAME, h.vstr(apikey_val));
    }

    return spec;
}
`
}


// COOKIE — a cookie IS a header, so the credential rides the header bag; but
// the `cookie` header is SHARED with whatever cookies the caller set, so the
// pair is spliced in and out rather than assigned over. Splicing is also what
// makes this idempotent: a retried request cannot carry the credential twice.
function renderCookie(spec: AuthSpec): string {
  return HEAD + imports({ vs: true, fmt: true }) +
    facts(spec.where, false, true) + `
const COOKIE_HEADER = "cookie";
const CRED_NAME = ${zigstr(credLiteral(spec.where, spec.name))};
const OPTION_APIKEY = "apikey";
const NOT_FOUND = "__NOTFOUND__";

// The cookie header minus our own pair, every other cookie left alone.
fn cookies_without_cred(headers: Value) []const u8 {
    const existing: []const u8 = switch (h.getp(headers, COOKIE_HEADER)) {
        .string => |s| s,
        else => "",
    };
    if (existing.len == 0) return "";

    var kept: []const u8 = "";
    var it = std.mem.splitScalar(u8, existing, ';');
    while (it.next()) |part| {
        const piece = std.mem.trim(u8, part, " \\t");
        if (piece.len == 0) continue;
        if (std.mem.eql(u8, piece, CRED_NAME)) continue;
        if (std.mem.startsWith(u8, piece, CRED_NAME ++ "=")) continue;
        kept = if (kept.len == 0) piece else fmt("{s}; {s}", .{ kept, piece });
    }

    return kept;
}

// Set (a value) or remove (null) our pair, leaving every other cookie in place.
fn apply_cookie(headers: Value, value: ?[]const u8) void {
    const rest = cookies_without_cred(headers);

    if (value) |v| {
        // NO PREFIX IN A COOKIE either - a cookie carries a bare \`name=value\`
        // pair, not a header's scheme-prefixed credential.
        const pair = fmt("{s}={s}", .{ CRED_NAME, v });
        h.setp(headers, COOKIE_HEADER, h.vstr(if (rest.len == 0) pair else fmt("{s}; {s}", .{ rest, pair })));
        return;
    }

    if (rest.len == 0) {
        h.del_prop(headers, h.vstr(COOKIE_HEADER));
    } else {
        h.setp(headers, COOKIE_HEADER, h.vstr(rest));
    }
}

pub fn prepare_auth_util(ctx: *Context) E!*Spec {
    const spec = ctx.spec orelse return ctx.fail("auth_no_spec", "Expected context spec property to be defined.");

    const headers = spec.headers;
    const options: Value = if (ctx.client) |client| client.options_map() else ctx.options;

    // Public APIs that need no auth omit the options.auth block entirely.
    const auth = h.getp(options, "auth");
    if (h.is_noval(auth)) {
        apply_cookie(headers, null);
        return spec;
    }

    const apikey = vs.getprop(h.A(), options, h.vstr(OPTION_APIKEY), h.vstr(NOT_FOUND)) catch h.vstr(NOT_FOUND);

    const skip = switch (apikey) {
        .null => true,
        .string => |s| std.mem.eql(u8, s, NOT_FOUND) or s.len == 0,
        else => false,
    };

    if (skip) {
        apply_cookie(headers, null);
    } else {
        const apikey_val: []const u8 = switch (apikey) {
            .string => |s| s,
            else => "",
        };
        apply_cookie(headers, apikey_val);
    }

    return spec;
}
`
}


// The imports and type aliases, in core/utility.zig's own order and
// spelling. `E` comes from helpers rather than error.zig on purpose:
// error.zig's type is `ProjectNameError`, and the placeholder rewrite is
// applied by Copy, which this GENERATED file never travels through.
function imports(need: { vs: boolean, fmt: boolean }): string {
  return `
const std = @import("std");
` + (need.vs ? `const vs = @import("voxgig-struct");
` : '') + `const h = @import("helpers.zig");
const ctxmod = @import("context.zig");
const spec_mod = @import("spec.zig");

const Value = h.Value;
const Context = ctxmod.Context;
const Spec = spec_mod.Spec;
const E = h.E;
` + (need.fmt ? `
fn fmt(comptime f: []const u8, args: anytype) []const u8 {
    return std.fmt.allocPrint(h.A(), f, args) catch "";
}
` : '')
}


// Emitted only for a basic scheme in a HEADER placement, so an ordinary
// bearer SDK carries neither the base64 encoder nor the boolean coercion.
function basicHelpers(): string {
  return `
// Boolean-or-absent: an option that is unset, null or a non-boolean is false
// (core/utility.zig's is_true, which this file can no longer see).
fn is_true(v: Value) bool {
    return switch (v) {
        .bool => |b| b,
        else => false,
    };
}

// Standard base64, arena-allocated - the encoding peer of sekreto's unbase64.
fn base64_std(text: []const u8) []const u8 {
    const enc = std.base64.standard.Encoder;
    const buf = h.A().alloc(u8, enc.calcSize(text.len)) catch return "";
    return enc.encode(buf, text);
}
`
}


// HTTP Basic is header-only BY DEFINITION: the scheme is
// `Authorization: Basic base64(user:pass)`. It cannot be expressed as a query
// parameter or a cookie, so this branch is emitted only where it can mean
// something — and only when the model says the scheme IS basic.
function basicBlock(): string {
  return `
    // True HTTP Basic Auth needs TWO credentials, base64-joined - a single
    // token in the header (the branch below) can never authenticate against
    // an API that actually checks \`Authorization: Basic base64(user:pass)\`.
    if (is_true(h.getpath(&.{ "auth", "basic" }, options))) {
        const secret = vs.getprop(h.A(), options, h.vstr(OPTION_SECRET), h.vstr(NOT_FOUND)) catch h.vstr(NOT_FOUND);

        const no_secret = switch (secret) {
            .null => true,
            .string => |s| std.mem.eql(u8, s, NOT_FOUND) or s.len == 0,
            else => false,
        };

        if (skip or no_secret) {
            h.del_prop(headers, h.vstr(CRED_NAME));
        } else {
            const basic_prefix: []const u8 = switch (h.getpath(&.{ "auth", "prefix" }, options)) {
                .string => |s| s,
                else => "",
            };
            const apikey_val: []const u8 = switch (apikey) {
                .string => |s| s,
                else => "",
            };
            const secret_val: []const u8 = switch (secret) {
                .string => |s| s,
                else => "",
            };
            const b64 = base64_std(fmt("{s}:{s}", .{ apikey_val, secret_val }));
            if (basic_prefix.len == 0) {
                h.setp(headers, CRED_NAME, h.vstr(b64));
            } else {
                h.setp(headers, CRED_NAME, h.vstr(fmt("{s} {s}", .{ basic_prefix, b64 })));
            }
        }

        return spec;
    }
`
}


// The credential's key, as it goes into the bag.
//
// A HEADER name is LOWERCASED. HTTP header names are case-insensitive on the
// wire (RFC 9110 5.1), but this SDK's header bag is a plain Value map and
// object keys are case-SENSITIVE: the extracted template said
// `const HEADER_AUTH = "authorization";`, the shared corpus asserts
// `ctx:spec:headers:authorization`, tm/zig/test/pipeline_test.zig reads
// `h.getp(ctx.spec.?.headers, "authorization")`, and feature/secrets.zig
// rewrites the same lowercase key. apidef writes `name: "Authorization"`, so
// emitting it verbatim would put the credential where none of those look.
//
// A QUERY parameter and a COOKIE name are case-SENSITIVE to the API itself,
// so those go in exactly as the spec spells them: `?token=` is not `?Token=`.
function credLiteral(where: string, name: string): string {
  return 'header' === where ? String(name).toLowerCase() : String(name)
}


// NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING. That helper is also
// false whenever the SPEC declares no security scheme
// (`main.kit.info.auth: false`) — a statement about the DEFINITION, not a ban
// on ever sending a credential. Such an SDK still carries one: `optspec`
// always declares `apikey`, and make_options_util fills `options.auth` from
// the optspec defaults (tm/zig/core/utility.zig), so the runtime
// `h.is_noval(auth)` guard never fired and every such SDK has always sent
// `options.apikey`. Gating the body on `isAuthActive` does not trim dead
// code, it silently removes working authentication — and takes the secrets
// feature with it, since that resolves a secret into `options.apikey` and
// prepare_auth then places nothing. zig's own gated suite
// (`zig build test-secrets`) pins exactly that.
//
// `main.kit.config.auth.active: false` is the project saying "this SDK sends
// no credential, ever". It is the only signal that can honestly be honoured
// before runtime, so it is the only one used here.
function isAuthActive_zig(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}


// THE PLACEMENT AS A COMPTIME FACT, exported beside the function.
//
// The generated body has exactly ONE branch, chosen here at generation time,
// and nothing downstream can tell which by looking at the options: a query
// SDK's `options.auth.in` says "query", but an auth-OFF SDK is
// indistinguishable from a header one there (Config omits `options.auth`
// entirely when auth is inactive, and make_options' optspec then supplies the
// same empty defaults either way).
//
// tm/zig/test/pipeline_test.zig needs to tell them apart. Its prepare_auth
// cases assert the HEADER shape - `spec.headers["authorization"]` - which is
// the right assertion for the default and the wrong one for the other three,
// where the SDK correctly places nothing there. Rather than let a query SDK
// ship four red tests (or delete the coverage that every header SDK does
// want), the suite reads these two constants and skips what does not apply.
//
// core/utility.zig re-exports both, so the path is `sdk.utilmod.<name>`.
function facts(where: string, basic: boolean, active: boolean): string {
  const placement = active ? where : 'none'

  return `
/// WHERE this SDK places its credential: "header", "query", "cookie", or
/// "none" when the project set \`main.kit.config.auth.active: false\`.
pub const PLACEMENT = ${zigstr(placement)};

/// True when the scheme is genuine HTTP Basic - two credentials, base64-joined
/// - rather than a single token. Header-only by definition, so false for every
/// other placement.
pub const BASIC = ${(basic && 'header' === where && active) ? 'true' : 'false'};
`
}


function zigstr(s: string): string {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}


export {
  PrepareAuth
}
