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
// rather than templated. This is the cpp peer of PrepareAuth_ts,
// PrepareAuth_c and PrepareAuth_go; read PrepareAuth_ts first, it carries
// the full account of the defect.
//
// apidef has always resolved the scheme's `in` and `name` into
// `main.kit.info.security` — joplin's says `in: "query", name: "token"` —
// and generation dropped both, hardcoding
//
//   static const std::string HEADER_AUTH = "authorization";
//
// so the SDK sent a header the API does not read and never sent the query
// parameter it does.
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in a
// bearer-token SDK, and no runtime `if` on a value fixed at generation
// time. In cpp it also keeps the includes honest: the base64 encoder the
// Basic branch needs (the cpp core ships none) is emitted only by the one
// placement that can use it.
//
// CPP IS THE ONE TARGET WITH NO prepare_auth TEMPLATE TO DELETE. The logic
// was EMBEDDED in `tm/cpp/utility/pipeline.hpp`, between preparePath and
// transformRequest, and the extraction shape is the PREFERRED one rather
// than the whole-module fallback:
//
//   - the SDK runtime is HEADER-ONLY, so "its own compilation unit" is its
//     own HEADER — `utility/prepare_auth.hpp`. Nothing has to move to a
//     .cpp, nothing new has to be compiled or linked, and the Makefile's
//     `SDK_HDRS := $(wildcard ... utility/*.hpp ...)` already lists it as a
//     rebuild dependency of every test binary.
//
//   - the BINDING is untouched. `prepareAuth` stays `inline SpecPtr
//     prepareAuth(CtxPtr)` in `namespace sdk::util`; pipeline.hpp includes
//     this header at the top (beside `../core/types.hpp`, outside any
//     namespace) and its `register_all` still binds
//     `u.prepareAuth = util::prepareAuth;`. Every call site therefore
//     resolves exactly as before: `utility->prepareAuth(ctx)` in
//     pipeline.hpp's own makeSpec, `u->prepareAuth(ctx)` in
//     core/types.hpp, and `utility->prepareAuth(ctx)` in the shipped
//     test/pipeline_test.cpp and test/primary_utility_test.cpp.
//
// Generating the whole of pipeline.hpp instead would have turned 1300 lines
// of hand-maintained runtime — every other pipeline step, makeOptions, the
// feature hooks — into a generator string literal to buy one function.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const active = authSwitchedOn(model)
  const where = resolveAuthIn(model)
  const name = resolveAuthName(model)
  const prefix = resolveAuthPrefix(model)
  const basic = isHttpBasicAuth(model)

  // FOLDER NESTING. Main_cpp calls this at ROOT level — after the
  // `Folder({name:'core'})` that wraps Config and client.hpp has closed —
  // so `utility` is opened HERE and the file lands at
  // `<root>/utility/prepare_auth.hpp`, the sibling of the
  // `utility/pipeline.hpp` that `Copy({from:'tm/cpp'})` brings in and that
  // `#include "prepare_auth.hpp"`s it by that relative name.
  //
  // The call site matters as much as the folder. Putting this beside Config
  // would write `core/utility/prepare_auth.hpp`: pipeline.hpp's include
  // would not resolve and the build would fail — loudly, which is the good
  // case. The bad case is the ts port's: opening a redundant second folder
  // (`src` there, `utility` here — `utility/utility/prepare_auth.hpp`)
  // emits a file nothing includes while a stale copy keeps being compiled,
  // and no test can see it.
  Folder({ name: 'utility' }, () => {
    File({ name: 'prepare_auth.' + target.ext }, () => {
      Content(render({ active, where, name, prefix, basic }))
    })
  })
})


// NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING (the py port found
// this first; six of the twelve ports found it independently).
//
// `isAuthActive` is false whenever the SPEC declares no security scheme
// (`main.kit.info.auth: false`). That is a statement about the DEFINITION,
// not a ban on ever sending a credential: apidef writes it for every spec
// with no securitySchemes block, and those SDKs are still expected to
// honour an `apikey` the caller passes. `optspec` always declares `apikey`,
// makeOptions fills `options.auth` from the optspec defaults, so the
// template's `is_nullish(getp(options, "auth"))` guard never actually fired
// and every such SDK has always sent `options.apikey`.
//
// Gating the body on `isAuthActive` therefore does not trim dead code, it
// deletes working authentication — and takes the secrets feature with it,
// since that resolves a secret into `options.apikey` and prepareAuth then
// places nothing. This target has a lane that catches it: generatedcompile's
// `cpp: auth null beats an explicit apikey` builds test/authnull_probe.cpp
// against a fixture whose model says `main: kit: info: { ... auth: false }`
// and requires the baseline `{apikey: 'OPTKEY01'}` to reach
// `spec->headers["authorization"]`.
//
// So the no-op is emitted only when the PROJECT says so:
// `main.kit.config.auth.active: false`, an explicit per-SDK switch nobody
// sets by accident. A spec that is merely silent keeps the credential path
// it has always had.
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
  const bag = bagName(spec.where)

  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch — and the base64 encoder it
  // needs, which the cpp core does not otherwise ship — is emitted only
  // where it can mean something.
  const withBasic = spec.basic && 'header' === spec.where

  const head = `// prepare_auth utility — WHERE THE CREDENTIAL GOES.
//
// GENERATED, not templated: header, query or cookie, and under what name,
// is a fact about THIS API, and tm/ can only hold one answer. Extracted
// from utility/pipeline.hpp, which includes this header and still binds
// \`u.prepareAuth = util::prepareAuth\` in register_all — the symbol, the
// namespace and every call site are unchanged. See PrepareAuth_cpp.
//
// Do not hand-edit: change the model's security scheme (or
// main.kit.config.auth) and regenerate.

#ifndef SDK_UTILITY_PREPARE_AUTH_HPP
#define SDK_UTILITY_PREPARE_AUTH_HPP

${withBasic ? `#include <cstddef>
` : ''}#include <string>

#include "../core/types.hpp"

namespace sdk {
namespace util {

`

  const tail = `
} // namespace util
} // namespace sdk

#endif // SDK_UTILITY_PREPARE_AUTH_HPP
`

  // AUTH SWITCHED OFF BY THE PROJECT (see authSwitchedOn for why only an
  // EXPLICIT switch counts). The SDK gets a prepareAuth that is honest
  // about it rather than one that erases a header nobody set. The spec
  // guard stays, because makeSpec calls this unconditionally and the rest
  // of the pipeline relies on the SpecPtr coming back.
  if (!spec.active) {
    return head + `// This SDK is configured with authentication off
// (main.kit.config.auth.active: false), so there is no credential to place.
// The function stays in the pipeline because makeSpec calls it
// unconditionally and uses the Spec it returns.
inline SpecPtr prepareAuth(CtxPtr ctx) {
  SpecPtr spec = ctx->spec;
  if (!spec) throw ctx->makeError("auth_no_spec", "Expected context spec property to be defined.");

  return spec;
}
` + tail
  }

  const helpers = 'cookie' === spec.where ? cookieHelpers() : ''

  const basicHelper = !withBasic ? '' : `
// The cpp core ships no base64 (the vendored encoder under
// feature/secrets/ is compiled only behind that feature's plugin groups and
// is not linked into a plain SDK), so the one placement that needs it
// carries its own.
inline std::string authBase64(const std::string& in) {
  static const char* ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  std::string out;
  out.reserve(((in.size() + 2) / 3) * 4);
  for (size_t i = 0; i < in.size(); i += 3) {
    unsigned int v = static_cast<unsigned char>(in[i]) << 16;
    if (i + 1 < in.size()) v |= static_cast<unsigned int>(static_cast<unsigned char>(in[i + 1])) << 8;
    if (i + 2 < in.size()) v |= static_cast<unsigned int>(static_cast<unsigned char>(in[i + 2]));
    out += ALPHABET[(v >> 18) & 0x3f];
    out += ALPHABET[(v >> 12) & 0x3f];
    out += (i + 1 < in.size()) ? ALPHABET[(v >> 6) & 0x3f] : '=';
    out += (i + 2 < in.size()) ? ALPHABET[v & 0x3f] : '=';
  }
  return out;
}

`

  // The template's body, unchanged except for WHICH bag the credential
  // lands in and under what name. Same option keys (`auth`, `apikey`,
  // `auth.prefix`), same NOT_FOUND sentinel, same `skip` test, same
  // `throw ctx->makeError("auth_no_spec", ...)`, same Group A reads.
  const preamble = `inline SpecPtr prepareAuth(CtxPtr ctx) {
  SpecPtr spec = ctx->spec;
  if (!spec) throw ctx->makeError("auth_no_spec", "Expected context spec property to be defined.");

  static const std::string CRED_NAME = ${cppstr(credLiteral(spec.where, spec.name))};
  static const std::string NOT_FOUND = "__NOTFOUND__";

  Value ${bag} = spec->${bag};
  Value options = ctx->client->optionsMap();

  // Public APIs that need no auth omit the options.auth block entirely, and
  // \`auth: null\` is the documented way to suppress a credential outright.
  if (is_nullish(getp(options, "auth"))) {
${clear(spec.where, 4)}
    return spec;
  }

  Value apikey = getp(options, "apikey", Value(NOT_FOUND));

  bool skip = false;
  if (is_nullish(apikey)) {
    skip = true;
  } else if (apikey.is_string() && (apikey.as_string() == NOT_FOUND || apikey.as_string().empty())) {
    skip = true;
  }
`

  const basicBlock = !withBasic ? '' : `
  // True HTTP Basic Auth needs TWO credentials, base64-joined - a single
  // token in the header (the branch below) can never authenticate against
  // an API that actually checks \`Authorization: Basic base64(user:pass)\`.
  if (is_true(Struct::getpath(options, {"auth", "basic"}))) {
    Value secret = getp(options, "secret", Value(NOT_FOUND));

    bool noSecret = false;
    if (is_nullish(secret)) {
      noSecret = true;
    } else if (secret.is_string() && (secret.as_string() == NOT_FOUND || secret.as_string().empty())) {
      noSecret = true;
    }

    if (skip || noSecret) {
${clear(spec.where, 6)}
    } else {
      std::string authPrefix = as_str(Struct::getpath(options, {"auth", "prefix"}));
      std::string b64 = authBase64(
        (apikey.is_string() ? apikey.as_string() : "") + ":" +
        (secret.is_string() ? secret.as_string() : ""));
      if (authPrefix.empty()) {
        map_put(headers, CRED_NAME, Value(b64));
      } else {
        map_put(headers, CRED_NAME, Value(authPrefix + " " + b64));
      }
    }

    return spec;
  }
`

  return head + helpers + basicHelper + preamble + basicBlock + `
  if (skip) {
${clear(spec.where, 4)}
  } else {
${place(spec.where)}
  }

  return spec;
}
` + tail
}


// COOKIE SPLICING. A cookie IS a header, so the credential rides the header
// bag — but the `cookie` header is SHARED with whatever cookies the caller
// set, so our pair is spliced in and out rather than the header assigned
// over. Splicing also makes this idempotent: a retried request cannot end
// up carrying the credential twice.
//
// `cred` is a parameter rather than a file-scope constant so the one
// constant in this file stays where the template put it — a function-local
// static inside prepareAuth.
function cookieHelpers(): string {
  return `// The cookie header minus our own pair, every other cookie untouched.
inline std::string authCookieRest(const Value& headers, const std::string& cred) {
  std::string existing = as_str(getp(headers, "cookie"));
  if (existing.empty()) return "";

  std::string kept;
  size_t start = 0;
  while (start <= existing.size()) {
    size_t sep = existing.find(';', start);
    std::string piece = (std::string::npos == sep)
      ? existing.substr(start) : existing.substr(start, sep - start);

    size_t a = piece.find_first_not_of(" \\t");
    size_t b = piece.find_last_not_of(" \\t");
    piece = (std::string::npos == a) ? "" : piece.substr(a, b - a + 1);

    bool ours = piece == cred || 0 == piece.compare(0, cred.size() + 1, cred + "=");
    if (!piece.empty() && !ours) {
      if (!kept.empty()) kept += "; ";
      kept += piece;
    }

    if (std::string::npos == sep) break;
    start = sep + 1;
  }

  return kept;
}


// Set (remove=false) or drop (remove=true) our pair, leaving the rest in place.
inline void authCookieApply(const Value& headers, const std::string& cred,
                            const std::string& value, bool remove) {
  std::string rest = authCookieRest(headers, cred);

  if (remove) {
    if (rest.empty()) {
      map_remove(headers, "cookie");
    } else {
      map_put(headers, "cookie", Value(rest));
    }
    return;
  }

  std::string pair = cred + "=" + value;
  map_put(headers, "cookie", Value(rest.empty() ? pair : rest + "; " + pair));
}


`
}


// The credential's key, as it goes into the bag.
//
// A HEADER name is LOWERCASED. HTTP header names are case-insensitive
// (RFC 9110 5.1), and this SDK's own header map is keyed in lowercase
// throughout — `content-type` in makeSpec, the `authorization` the shipped
// test/pipeline_test.cpp and test/primary_utility_test.cpp assert on, the
// `authorization` feature/secrets.hpp injects and retracts, and the
// `authorization` generatedcompile's cpp auth-null probe reads — while the
// template this replaces said `"authorization"` outright. apidef writes
// `name: "Authorization"`, so emitting the resolver's value verbatim would
// put the credential under a key nothing in this runtime reads.
//
// A QUERY parameter and a COOKIE name are case-SENSITIVE, so those go in
// verbatim: `?token=` is not `?Token=`.
function credLiteral(where: string, name: string): string {
  return 'header' === where ? String(name).toLowerCase() : String(name)
}


// The bag the credential lands in, per placement. It is both the local
// variable name and the Spec field, which in cpp are spelled the same
// (spec->headers / spec->query). Cookies ride the header bag because a
// cookie IS a header.
function bagName(where: string): string {
  return 'query' === where ? 'query' : 'headers'
}


// Drop any stale credential.
function clear(where: string, indent: number): string {
  const pad = ' '.repeat(indent)

  if ('cookie' === where) {
    return `${pad}authCookieApply(headers, CRED_NAME, "", true);`
  }

  return `${pad}map_remove(${bagName(where)}, CRED_NAME);`
}


function place(where: string): string {
  if ('query' === where) {
    // NO PREFIX IN A QUERY STRING. `?token=Bearer%20abc` is not a thing any
    // API reads; the prefix is a header convention and is dropped here
    // deliberately rather than silently concatenated. makeUrl appends
    // spec->query to the URL after this runs, so the parameter reaches the
    // wire escaped by the same escurl every other query parameter uses.
    return `    map_put(query, CRED_NAME, Value(apikey.is_string() ? apikey.as_string() : ""));`
  }

  if ('cookie' === where) {
    // NO PREFIX IN A COOKIE either — a cookie carries a bare `name=value`
    // pair, not a header's scheme-prefixed credential.
    return `    authCookieApply(headers, CRED_NAME,
      apikey.is_string() ? apikey.as_string() : "", false);`
  }

  // The template's header body, unchanged.
  return `    std::string authPrefix = as_str(Struct::getpath(options, {"auth", "prefix"}));
    std::string apikeyVal = apikey.is_string() ? apikey.as_string() : "";
    // A raw credential (empty prefix, e.g. an apiKey scheme) must go in
    // as-is; only a non-empty prefix (Bearer/Basic/OAuth) is space-joined.
    if (authPrefix.empty()) {
      map_put(headers, CRED_NAME, Value(apikeyVal));
    } else {
      map_put(headers, CRED_NAME, Value(authPrefix + " " + apikeyVal));
    }`
}


function cppstr(s: string): string {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}


export {
  PrepareAuth
}
