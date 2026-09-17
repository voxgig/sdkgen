
import {
  Content,
  File,
  Folder,
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
// rather than templated. This is the c peer of PrepareAuth_ts and
// PrepareAuth_go; read PrepareAuth_ts first, it carries the full account of
// the defect.
//
// This was a static file at `tm/c/utility/prepare_auth.c` that hardcoded
//
//   #define HEADER_AUTH "authorization"
//
// apidef has always resolved the scheme's `in` and `name` into
// `main.kit.info.security` — joplin's says `in: "query", name: "token"` —
// and generation dropped both, so the SDK sent a header the API does not
// read and never sent the query parameter it does.
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in a
// bearer-token SDK, and no runtime `if` on a value fixed at generation
// time. In c that also keeps the includes honest: `<stdio.h>` is pulled in
// only by the placements that actually call snprintf, and the base64
// encoder only by the one placement that can use it.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const active = authSwitchedOn(model)
  const where = resolveAuthIn(model)
  const name = resolveAuthName(model)
  const prefix = resolveAuthPrefix(model)
  const basic = isHttpBasicAuth(model)

  // FOLDER NESTING. Main_c opens NO folder around this call, so `utility` is
  // opened HERE and the file lands at `<root>/utility/prepare_auth.c` —
  // exactly where `Copy({from:'tm/c'})` used to land the template, which is
  // what the Makefile's `$(wildcard core/*.c utility/*.c ...)` compiles and
  // what `core/sdk.h` declares `prepare_auth_util` for.
  //
  // The call site matters as much as the folder. Config_c is inside
  // `Folder({name:'core'})`, and putting PrepareAuth beside it would write
  // `core/utility/prepare_auth.c` — a path no glob in the Makefile matches,
  // so nothing would compile it, `prepare_auth_util` would be an unresolved
  // symbol at link time, and any stale `utility/prepare_auth.c` left in the
  // tree would keep being the one that runs. Main_c calls this at ROOT
  // level, after the `core` Folder closes.
  Folder({ name: 'utility' }, () => {
    File({ name: 'prepare_auth.c' }, () => {
      Content(render({ active, where, name, prefix, basic }))
    })
  })
})


// NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING (the py port found
// this first, php's lane proved it, and c's lane proves it again here).
//
// `isAuthActive` is false whenever the SPEC declares no security scheme
// (`main.kit.info.auth: false`). That is a statement about the DEFINITION,
// not a ban on ever sending a credential: apidef writes it for every spec
// with no securitySchemes block, and those SDKs are still expected to honour
// an `apikey` the caller passes. The template placed the credential
// unconditionally, so they did.
//
// Gating the body on `isAuthActive` therefore does not trim dead code, it
// deletes working authentication. MEASURED, not assumed: with the wider gate
// this component emitted the no-op for generatedcompile's own fixture
// (`main: kit: info: { ... auth: false }`) and the c lane went red -
//
//   c: auth null beats an explicit apikey
//     FAIL: baseline broken: an ordinary apikey was not sent
//
// So the no-op is emitted only when the PROJECT says so:
// `config.auth.active: false`, an explicit per-SDK switch nobody sets by
// accident. A spec that is merely silent keeps the credential path it has
// always had.
function authSwitchedOn(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}


type AuthSpec = {
  active: boolean
  where: string
  name: string
  prefix: string
  basic: boolean
}


function render(spec: AuthSpec): string {

  // AUTH SWITCHED OFF BY THE PROJECT (see authSwitchedOn for why only an
  // EXPLICIT switch counts). The SDK gets a prepare_auth that is honest
  // about it rather than one that deletes a header nobody set. Nothing
  // beyond sdk.h is included: this body calls neither snprintf nor strcmp.
  if (!spec.active) {
    return `// prepare_auth utility (mirrors utility/prepare_auth.rs).
//
// GENERATED, not templated - see PrepareAuth_c.
//
// This API declares no authentication, so there is no credential to place.
// The function stays in the pipeline because make_spec calls it
// unconditionally.

#include "sdk.h"

Spec* prepare_auth_util(Context* ctx, PNError** err) {
  *err = NULL;
  Spec* spec = ctx->spec;
  if (!spec) {
    *err = context_make_error(ctx, "auth_no_spec", "Expected context spec property to be defined.");
    return NULL;
  }

  return spec;
}
`
  }

  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch - and the base64 encoder it
  // needs, which the c core does not otherwise ship - is emitted only where
  // it can mean something.
  const withBasic = spec.basic && 'header' === spec.where

  // snprintf is used by every placement except query, which writes the raw
  // credential straight in.
  const withStdio = 'query' !== spec.where

  const bag = bagName(spec.where)

  const head = `// prepare_auth utility (mirrors utility/prepare_auth.rs).
//
// GENERATED, not templated: where the credential goes - header, query or
// cookie, and under what name - is a fact about THIS API, and tm/ can only
// hold one answer. See PrepareAuth_c.

#include "sdk.h"

${withStdio ? `#include <stdio.h>
` : ''}#include <string.h>

#define CRED_NAME "${cstr(credLiteral(spec.where, spec.name))}"
${'cookie' === spec.where ? `#define COOKIE_HEADER "cookie"
` : ''}#define OPTION_APIKEY "apikey"
${withBasic ? `#define OPTION_SECRET "secret"
` : ''}#define NOT_FOUND "__NOTFOUND__"
${withBasic ? `
// The c core ships no base64 (the vendored encoder under
// feature/secrets/plugins/ is gated behind that feature and is not linked
// into a plain SDK), so the one placement that needs it carries its own.
static const char B64_ALPHABET[] =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static void b64_encode(const char* in, char* out, size_t outcap) {
  size_t n = strlen(in);
  size_t o = 0;
  for (size_t i = 0; i < n; i += 3) {
    unsigned int v = (unsigned char)in[i] << 16;
    if (i + 1 < n) v |= (unsigned int)(unsigned char)in[i + 1] << 8;
    if (i + 2 < n) v |= (unsigned int)(unsigned char)in[i + 2];
    if (o + 5 > outcap) break;
    out[o++] = B64_ALPHABET[(v >> 18) & 0x3f];
    out[o++] = B64_ALPHABET[(v >> 12) & 0x3f];
    out[o++] = (i + 1 < n) ? B64_ALPHABET[(v >> 6) & 0x3f] : '=';
    out[o++] = (i + 2 < n) ? B64_ALPHABET[v & 0x3f] : '=';
  }
  out[o] = '\\0';
}
` : ''}
Spec* prepare_auth_util(Context* ctx, PNError** err) {
  *err = NULL;
  Spec* spec = ctx->spec;
  if (!spec) {
    *err = context_make_error(ctx, "auth_no_spec", "Expected context spec property to be defined.");
    return NULL;
  }

  voxgig_value* ${bag} = spec->${bag};
  voxgig_value* options = ctx->client ? sdk_options_map(ctx->client) : ctx->options;

  voxgig_value* auth = getp(options, "auth");
  if (v_is_noval(auth) || v_is_null(auth)) {
${clear(spec.where, 4)}
    return spec;
  }

  voxgig_value* akey_key = voxgig_new_string(OPTION_APIKEY);
  voxgig_value* nf = voxgig_new_string(NOT_FOUND);
  voxgig_value* apikey = voxgig_getprop(options, akey_key, nf);
  voxgig_release(akey_key);
  voxgig_release(nf);

  bool skip;
  if (v_is_noval(apikey) || v_is_null(apikey)) {
    skip = true;
  } else if (voxgig_is_string(apikey)) {
    const char* s = voxgig_as_string(apikey);
    skip = (strcmp(s, NOT_FOUND) == 0 || s[0] == '\\0');
  } else {
    skip = false;
  }
`

  const basicBlock = !withBasic ? '' : `
  // True HTTP Basic Auth needs TWO credentials, base64-joined - a single
  // token in the header (the branch below) can never authenticate against
  // an API that actually checks \`Authorization: Basic base64(user:pass)\`.
  bool want_basic = false;
  get_bool(auth, "basic", &want_basic);
  if (want_basic) {
    voxgig_value* sec_key = voxgig_new_string(OPTION_SECRET);
    voxgig_value* snf = voxgig_new_string(NOT_FOUND);
    voxgig_value* secret = voxgig_getprop(options, sec_key, snf);
    voxgig_release(sec_key);
    voxgig_release(snf);

    bool no_secret;
    if (v_is_noval(secret) || v_is_null(secret)) {
      no_secret = true;
    } else if (voxgig_is_string(secret)) {
      const char* s = voxgig_as_string(secret);
      no_secret = (strcmp(s, NOT_FOUND) == 0 || s[0] == '\\0');
    } else {
      no_secret = false;
    }

    if (skip || no_secret) {
${clear(spec.where, 6)}
    } else {
      voxgig_value* prefix_v = getpath2(options, "auth", "prefix");
      const char* auth_prefix = voxgig_is_string(prefix_v) ? voxgig_as_string(prefix_v) : "";
      char pair[1024];
      char b64[1400];
      snprintf(pair, sizeof(pair), "%s:%s",
               voxgig_is_string(apikey) ? voxgig_as_string(apikey) : "",
               voxgig_is_string(secret) ? voxgig_as_string(secret) : "");
      b64_encode(pair, b64, sizeof(b64));
      if (auth_prefix[0] == '\\0') {
        setp(headers, CRED_NAME, v_str(b64));
      } else {
        char buf[1536];
        snprintf(buf, sizeof(buf), "%s %s", auth_prefix, b64);
        setp(headers, CRED_NAME, v_str(buf));
      }
    }

    return spec;
  }
`

  return head + basicBlock + `
  if (skip) {
${clear(spec.where, 4)}
  } else {
${place(spec.where)}
  }

  return spec;
}
`
}


// The credential's key, as it goes into the bag.
//
// A HEADER name is lowercased. HTTP header names are case-insensitive
// (RFC 9110 5.1), and this SDK's own header map is keyed in lowercase
// throughout - `content-type` in make_spec.c, and the `authorization` that
// the shipped tests/pipeline_test.c asserts on - while the template this
// replaces said `"authorization"`. Emitting the resolver's title-cased
// default here would have left every header SDK's own suite failing on a
// purely cosmetic difference. (PrepareAuth_go reaches the same conclusion
// for the same reason.)
//
// A QUERY parameter and a COOKIE name are case-SENSITIVE, so those go in
// verbatim: `?token=` is not `?Token=`.
function credLiteral(where: string, name: string): string {
  return 'header' === where ? String(name).toLowerCase() : String(name)
}


// The bag the credential lands in, per placement. It is both the local
// variable name and the Spec field, which in c are spelled the same
// (spec->headers / spec->query). Cookies ride the header bag because a
// cookie IS a header.
function bagName(where: string): string {
  return 'query' === where ? 'query' : 'headers'
}


// Drop any stale credential. voxgig_delprop takes a voxgig_value* key, so
// the key is built and released around the call - the template's idiom,
// kept verbatim.
function clear(where: string, indent: number): string {
  const pad = ' '.repeat(indent)
  return `${pad}voxgig_value* k = voxgig_new_string(CRED_NAME);
${pad}voxgig_delprop(${bagName(where)}, k);
${pad}voxgig_release(k);`
}


function place(where: string): string {
  if ('query' === where) {
    // NO PREFIX IN A QUERY STRING. `?token=Bearer%20abc` is not a thing any
    // API reads; the prefix is a header convention and is dropped here
    // deliberately rather than silently concatenated.
    return `    const char* apikey_val = voxgig_is_string(apikey) ? voxgig_as_string(apikey) : "";
    setp(query, CRED_NAME, v_str(apikey_val));`
  }

  if ('cookie' === where) {
    // Append, never replace: the cookie header may already carry pairs this
    // SDK did not set, and clobbering it would drop them. No prefix either -
    // a cookie is `name=value`, not `name=Bearer value`.
    return `    const char* apikey_val = voxgig_is_string(apikey) ? voxgig_as_string(apikey) : "";
    const char* existing = get_str(headers, COOKIE_HEADER);
    char buf[2048];
    if (existing && existing[0] != '\\0') {
      snprintf(buf, sizeof(buf), "%s; %s=%s", existing, CRED_NAME, apikey_val);
    } else {
      snprintf(buf, sizeof(buf), "%s=%s", CRED_NAME, apikey_val);
    }
    setp(headers, COOKIE_HEADER, v_str(buf));`
  }

  // The template's header body, unchanged.
  return `    voxgig_value* prefix_v = getpath2(options, "auth", "prefix");
    const char* auth_prefix = voxgig_is_string(prefix_v) ? voxgig_as_string(prefix_v) : "";
    const char* apikey_val = voxgig_is_string(apikey) ? voxgig_as_string(apikey) : "";
    // A raw credential (empty prefix, e.g. an apiKey scheme) must go in
    // as-is; only a non-empty prefix (Bearer/Basic/OAuth) is space-joined.
    if (auth_prefix[0] == '\\0') {
      setp(headers, CRED_NAME, v_str(apikey_val));
    } else {
      char buf[1024];
      snprintf(buf, sizeof(buf), "%s %s", auth_prefix, apikey_val);
      setp(headers, CRED_NAME, v_str(buf));
    }`
}


function cstr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}


export {
  PrepareAuth
}
