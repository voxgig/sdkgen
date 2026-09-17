import {
  Content,
  File,
  Folder,
  cmp,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


import { swiftString, swiftTargetDir } from './utility_swift'


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated. The swift peer of cmp/ts/PrepareAuth_ts.ts; read
// that one first, it carries the full account of the defect.
//
// apidef has always resolved the scheme's `in` and `name` into
// `main.kit.info.security` — joplin's says `in: "query", name: "token"` —
// and generation dropped both, so the SDK sent a header the API does not
// read and never sent the query parameter it does. Four repos in the cedar
// fleet ship SDKs that cannot authenticate for this reason: joplin
// (`token`), pipedrive (`api_token`), trello (`key`), lm-umbrella
// (`apiKey`).
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in a
// bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time.
//
// SWIFT WAS THE ODD ONE OUT: it had no prepare_auth template to delete.
// `prepareAuthUtil` was one function among eight in
// `tm/swift/Sources/ProjectNameSDK/utility/Prepare.swift`, beside
// prepareMethod/Path/Params/Query/Headers/Body and paramUtil — none of
// which is model-dependent. So the EXTRACTION is the move, not a rewrite of
// the module: `prepareAuthUtil` and its three private constants move out of
// Prepare.swift into this generated `utility/PrepareAuth.swift`, and the
// other seven functions stay templated where they are.
//
// SWIFT LETS THAT WORK WITH NO REWIRING AT ALL. Every .swift file in the
// SwiftPM target is one MODULE, and a top-level `func` is `internal` by
// default — visible to the whole module, importable by nothing, declared
// once. So moving the function to another file in the same target changes
// no name and no import:
//
//   core/Utility.swift      `public var prepareAuth: ((Context) throws -> Spec)!`
//   utility/Register.swift  `u.prepareAuth = prepareAuthUtil`   <- resolves here
//   utility/Make.swift      `let spec = try utility.prepareAuth(ctx)`
//   cmp/swift/fragment/Main.fragment.swift  `_ = try utility.prepareAuth(ctx)`
//
// all stand unchanged. The one thing swift does NOT tolerate is the
// function existing in BOTH files — same module, same name, "invalid
// redeclaration of 'prepareAuthUtil'", which fails the whole target — so
// the template copy is deleted in the same change. That is the check that
// makes a stale copy impossible here, and it is a compile error rather than
// the silent double-life the ts port hit (see the folder note below).
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  // AUTH SWITCHED OFF BY THE PROJECT — and ONLY by that.
  //
  // NOT `isAuthActive`, and the difference is load-bearing. That helper is
  // false whenever `main.kit.info.auth` is false, which only says the SPEC
  // declared no security scheme; such an SDK still carries a credential,
  // because `optspec` always declares `apikey` and makeOptions fills
  // `options.auth` from the optspec defaults — so the runtime
  // `isNil(auth)` guard below never fires and these SDKs have ALWAYS sent
  // `options.apikey`. Emitting a no-op for them silently breaks working
  // authentication and takes the secrets feature with it (it resolves a
  // secret into `options.apikey`, and prepareAuth then places nothing).
  //
  // `main.kit.config.auth.active: false` is the project saying "this SDK
  // sends no credential, ever" — the only signal that can honestly be
  // honoured before runtime. `isAuthSuppressed` in @voxgig/sdkgen IS that
  // predicate (utility.ts), so it is used here rather than re-derived: the
  // py port wrote its own `isAuthActive_py` before the shared helper
  // existed, and two copies of one rule is how they drift.
  const suppressed = isAuthSuppressed(model)

  const where = resolveAuthIn(model)

  // LOWERCASED FOR A HEADER, VERBATIM OTHERWISE. HTTP header names are
  // case-insensitive on the wire (RFC 9110 5.1), but this SDK's header bag
  // is a plain `VMap` keyed in lower case throughout: the code being
  // extracted said `private let headerAuth = "authorization"`, the shared
  // corpus asserts `ctx:spec:headers:authorization`, the shipped
  // PipelineTest reads `headers.entries["authorization"]`, and
  // SecretsFeature.swift writes `headers.entries["authorization"]` as the
  // other credential writer. apidef writes `name: "Authorization"`, so
  // emitting it verbatim would put the credential under a key nothing in
  // this SDK reads. A query parameter and a cookie ARE case-sensitive
  // (`?token=` is not `?Token=`), so those keep the spec's spelling.
  const resolvedName = resolveAuthName(model)
  const name = 'header' === where ? resolvedName.toLowerCase() : resolvedName

  // Resolved, and deliberately NOT baked into the emitted source: the
  // prefix is a RUNTIME option (`options.auth.prefix`) and the code being
  // extracted read it from the options map, so a caller — and the secrets
  // feature, which rewrites it there — can still override it per client.
  // Only the PLACEMENT is fixed at generation time.
  const prefix = resolveAuthPrefix(model)

  const basic = isHttpBasicAuth(model)

  // FOLDER NESTING, worked out from the template's own path and from
  // Main_swift, not guessed.
  //
  // The file being replaced lives at
  // `tm/swift/Sources/ProjectNameSDK/utility/Prepare.swift`, and Main_swift
  // copies that tree with `Folder({name:'Sources'})` +
  // `Copy({from:'tm/swift/Sources/ProjectNameSDK', to: swiftTargetDir(model)})`
  // — note the `to`, which is why the runtime lands under the API's own
  // name (`Sources/<Name>Sdk/utility/`) rather than under the placeholder
  // directory. So the full destination is
  // `Sources/<Name>Sdk/utility/PrepareAuth.swift`.
  //
  // ALL THREE SEGMENTS ARE OPENED HERE, and Main calls this at its TOP
  // level, beside `EntityTypes({ target })` — which is the swift precedent
  // for exactly this (EntityTypes_swift opens
  // `Sources`/`swiftTargetDir`/`entity` itself). Two other call sites were
  // available and both are wrong:
  //
  //   * inside Main's generated-sources block, beside `Config({target})`.
  //     That block sits inside `Folder({name:'core'})`, so this would write
  //     `Sources/<Name>Sdk/core/utility/PrepareAuth.swift`.
  //   * inside that block but one level out, opening only `utility`. That
  //     is correct TODAY and breaks the moment the surrounding folders
  //     move; self-contained is what EntityTypes_swift chose.
  //
  // Getting it wrong is not merely a misplaced file: SwiftPM compiles
  // EVERY .swift under `Sources/<target>/`, so a stray copy at the wrong
  // path is still in the module and still collides with the real one. Here
  // that is a hard build failure — which is the good case, and the reason
  // the ts port's `src/src/utility/` accident (a second `Folder('src')`,
  // the stale file still imported, invisible to the suite) cannot repeat on
  // swift.
  Folder({ name: 'Sources' }, () => {
    Folder({ name: swiftTargetDir(model) }, () => {
      Folder({ name: 'utility' }, () => {
        File({ name: 'PrepareAuth.' + target.ext }, () => {
          Content(render({
            Name: model.const.Name,
            suppressed, where, name, prefix, basic,
          }))
        })
      })
    })
  })
})


type AuthSpec = {
  Name: string
  suppressed: boolean
  where: string
  name: string
  prefix: string
  basic: boolean
}


function render(spec: AuthSpec): string {
  // Foundation on every file is the tm/swift convention (Prepare.swift,
  // Make.swift, MakeOptions.swift, Spec.swift all open with it), and the
  // basic and cookie branches genuinely need it — `base64EncodedString()`
  // and `trimmingCharacters(in:)` are Foundation. Swift does not warn on an
  // unused import, so the header branch carrying it costs nothing and keeps
  // the file shaped like its neighbours.
  const head = `// ${spec.Name} SDK utility: prepareAuth - place the API credential.
//
// GENERATED, not templated: WHERE the credential goes - header, query or
// cookie, and under what name - is a fact about THIS API, and tm/ can only
// hold one answer. Extracted from utility/Prepare.swift, which keeps the
// seven prepare* functions that do not depend on the model. Bound by
// utility/Register.swift (\`u.prepareAuth = prepareAuthUtil\`) exactly as
// before: same module, same internal symbol, no import needed.
//
// See cmp/swift/PrepareAuth_swift.ts.

import Foundation
`

  if (spec.suppressed) {
    // The project set `main.kit.config.auth.active: false`. No credential,
    // ever — so the SDK gets a prepareAuth that is honest about it rather
    // than one that pops a header nobody set.
    return head + `
// This SDK is configured with authentication OFF
// (main.kit.config.auth.active is false), so there is no credential to
// place. The function stays in the pipeline because Register binds it
// unconditionally and makeSpec calls it on every request.
func prepareAuthUtil(_ ctx: Context) throws -> Spec {
  guard let spec = ctx.spec else {
    throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")
  }

  return spec
}
`
  }

  if ('query' === spec.where) return head + renderQuery(spec)
  if ('cookie' === spec.where) return head + renderCookie(spec)

  return head + renderHeader(spec)
}


// HEADER. Byte-for-byte the function that was in Prepare.swift when the
// scheme resolves to the defaults (header / Authorization) and is not
// Basic — same constant names, same `skip` shape, same removeValue /
// entries[...] idioms, same error. Only the constant's VALUE moves with the
// model, plus the Basic block, which is emitted only for a basic scheme.
function renderHeader(spec: AuthSpec): string {
  const basicConst = spec.basic ? `
private let optionSecret = "secret"` : ''

  return `
private let headerAuth = ${swiftString(spec.name)}
private let optionApikey = "apikey"${basicConst}
private let notFound = "__NOTFOUND__"

func prepareAuthUtil(_ ctx: Context) throws -> Spec {
  guard let spec = ctx.spec else {
    throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")
  }

  let headers = spec.headers
  let options = ctx.client!.optionsMap()

  // Public APIs that need no auth omit the options.auth block entirely.
  let auth = getprop(.map(options), .string("auth"))
  if isNil(auth) {
    headers.entries.removeValue(forKey: headerAuth)
    return spec
  }

  let apikey = getprop(.map(options), .string(optionApikey), .string(notFound))

  var skip = isNil(apikey)
  if let apikeyStr = apikey.asString, apikeyStr == notFound || apikeyStr == "" {
    skip = true
  }
${basicBlock(spec)}
  if skip {
    headers.entries.removeValue(forKey: headerAuth)
  } else {
    var authPrefix = ""
    if let ap = gpath(options, "auth", "prefix").asString { authPrefix = ap }
    let apikeyVal = apikey.asString ?? ""
    // Empty prefix (raw apiKey credential) must not add a leading space.
    headers.entries[headerAuth] = .string(authPrefix == "" ? apikeyVal : authPrefix + " " + apikeyVal)
  }

  return spec
}
`
}


// HTTP Basic is header-only BY DEFINITION: the scheme is
// `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
// query parameter or a cookie, so the branch is emitted only where it can
// mean something — and only when the model says the scheme IS basic, so an
// ordinary bearer SDK carries no dead code and regenerates unchanged.
function basicBlock(spec: AuthSpec): string {
  if (!spec.basic) return ''

  return `
  // True HTTP Basic Auth needs TWO credentials, base64-joined - a single
  // token in the header (the branch below) can never authenticate against
  // an API that actually checks \`Authorization: Basic base64(user:pass)\`.
  if true == gpath(options, "auth", "basic").asBool {
    let secret = getprop(.map(options), .string(optionSecret), .string(notFound))

    var noSecret = isNil(secret)
    if let secretStr = secret.asString, secretStr == notFound || secretStr == "" {
      noSecret = true
    }

    if skip || noSecret {
      headers.entries.removeValue(forKey: headerAuth)
    } else {
      var authPrefix = ""
      if let ap = gpath(options, "auth", "prefix").asString { authPrefix = ap }
      let joined = (apikey.asString ?? "") + ":" + (secret.asString ?? "")
      let b64 = Data(joined.utf8).base64EncodedString()
      // Empty prefix (raw credential) must not add a leading space.
      headers.entries[headerAuth] = .string(authPrefix == "" ? b64 : authPrefix + " " + b64)
    }

    return spec
  }
`
}


// QUERY. The credential is a query parameter, so it goes in `spec.query` and
// the headers are never touched. `spec.query` is the bag makeUrl builds the
// query string from (utility/Make.swift), and prepareAuth runs AFTER
// prepareQuery in makeSpec, so the credential joins the op's own arguments
// rather than being overwritten by them.
function renderQuery(spec: AuthSpec): string {
  return `
private let queryAuth = ${swiftString(spec.name)}
private let optionApikey = "apikey"
private let notFound = "__NOTFOUND__"

func prepareAuthUtil(_ ctx: Context) throws -> Spec {
  guard let spec = ctx.spec else {
    throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")
  }

  let query = spec.query
  let options = ctx.client!.optionsMap()

  // Public APIs that need no auth omit the options.auth block entirely.
  let auth = getprop(.map(options), .string("auth"))
  if isNil(auth) {
    query.entries.removeValue(forKey: queryAuth)
    return spec
  }

  let apikey = getprop(.map(options), .string(optionApikey), .string(notFound))

  var skip = isNil(apikey)
  if let apikeyStr = apikey.asString, apikeyStr == notFound || apikeyStr == "" {
    skip = true
  }

  if skip {
    query.entries.removeValue(forKey: queryAuth)
  } else {
    let apikeyVal = apikey.asString ?? ""
    // NO PREFIX IN A QUERY STRING. \`?${spec.name}=Bearer%20abc\` is not a
    // thing any API reads: the prefix is a header convention, so it is
    // dropped here deliberately rather than silently concatenated.
    query.entries[queryAuth] = .string(apikeyVal)
  }

  return spec
}
`
}


// COOKIE. A cookie IS a header, so the credential rides the header bag -
// but the `cookie` header is SHARED with whatever cookies the caller set, so
// the pair is spliced in and out rather than the header assigned over.
// Splicing is also what makes it idempotent: a retried request cannot end up
// carrying the credential twice.
function renderCookie(spec: AuthSpec): string {
  return `
private let cookieHeader = "cookie"
private let cookieAuth = ${swiftString(spec.name)}
private let optionApikey = "apikey"
private let notFound = "__NOTFOUND__"

// The cookie header minus our own pair, every other cookie untouched.
private func cookiesWithoutCred(_ headers: VMap) -> String {
  guard let existing = headers.entries[cookieHeader]?.asString, existing != "" else {
    return ""
  }

  var kept: [String] = []
  for part in existing.split(separator: ";", omittingEmptySubsequences: false) {
    let piece = part.trimmingCharacters(in: .whitespaces)
    if piece == "" || piece == cookieAuth || piece.hasPrefix(cookieAuth + "=") {
      continue
    }
    kept.append(piece)
  }

  return kept.joined(separator: "; ")
}

// Set (non-nil) or remove (nil) our pair, leaving every other cookie in
// place. Deleting the whole header to remove one pair would drop cookies
// this SDK never set.
private func applyCookie(_ headers: VMap, _ value: String?) {
  let rest = cookiesWithoutCred(headers)

  guard let value = value else {
    if rest == "" {
      headers.entries.removeValue(forKey: cookieHeader)
    } else {
      headers.entries[cookieHeader] = .string(rest)
    }
    return
  }

  let pair = cookieAuth + "=" + value
  headers.entries[cookieHeader] = .string(rest == "" ? pair : rest + "; " + pair)
}

func prepareAuthUtil(_ ctx: Context) throws -> Spec {
  guard let spec = ctx.spec else {
    throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")
  }

  let headers = spec.headers
  let options = ctx.client!.optionsMap()

  // Public APIs that need no auth omit the options.auth block entirely.
  let auth = getprop(.map(options), .string("auth"))
  if isNil(auth) {
    applyCookie(headers, nil)
    return spec
  }

  let apikey = getprop(.map(options), .string(optionApikey), .string(notFound))

  var skip = isNil(apikey)
  if let apikeyStr = apikey.asString, apikeyStr == notFound || apikeyStr == "" {
    skip = true
  }

  if skip {
    applyCookie(headers, nil)
  } else {
    // NO PREFIX IN A COOKIE either - a cookie carries a bare \`name=value\`
    // pair, not a header's scheme-prefixed credential.
    applyCookie(headers, apikey.asString ?? "")
  }

  return spec
}
`
}


export {
  PrepareAuth
}
