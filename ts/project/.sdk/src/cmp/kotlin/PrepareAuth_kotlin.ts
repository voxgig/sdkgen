
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


import { kotlinPackage } from './utility_kotlin'


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated.
//
// apidef has always resolved the scheme's `in` and `name` into
// `main.kit.info.security` — joplin's says `in: "query", name: "token"` —
// and generation dropped both, hardcoding an `authorization` header. The
// result was an SDK that sent a header the API does not read and never
// sent the query parameter it does, so it could not authenticate at all.
// Four repos in the cedar fleet shipped that way: joplin (`token`),
// pipedrive (`api_token`), trello (`key`), lm-umbrella (`apiKey`).
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in a
// bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time. The ts port (PrepareAuth_ts) is the donor.
//
// KOTLIN IS AN EXTRACTION, NOT A REPLACEMENT. The other twelve targets had
// a `prepare_auth` template of their own to delete; kotlin did not — the
// function lived among eight unrelated `prepare*` helpers in
// `tm/kotlin/utility/Prepare.kt`. So `prepareAuth` (and only it, with the
// three constants nothing else in that file used) MOVES here, into its own
// compilation unit in the SAME package.
//
// That is a pure move as far as every caller is concerned, because a
// Kotlin top-level function is visible to the whole package without an
// import: `utility/Register.kt` keeps binding `u.prepareAuth = ::prepareAuth`
// unchanged, `core/Utility.kt` keeps its `lateinit var prepareAuth:
// (Context) -> Spec` and its `u.prepareAuth = this.prepareAuth` copy, and
// `core/SdkClient.kt` and `utility/MakeSpecUrl.kt` keep calling
// `utility.prepareAuth(ctx)` through that binding. Nothing is renamed and
// nothing is re-wired. The three constants were `private` (file-scoped), so
// carrying them here cannot collide with what stays behind.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const kotlinpackage = kotlinPackage(model)

  const where = resolveAuthIn(model)

  // LOWERCASED FOR A HEADER, VERBATIM OTHERWISE. `spec.headers` is a
  // LinkedHashMap<String, Any?> — case-SENSITIVE — and every other writer
  // and reader of an auth header in this target spells it lower case: the
  // deleted template's own `HEADER_AUTH = "authorization"`, SecretsFeature's
  // `headers["authorization"]` rewrite and removal, DebugFeature's redact
  // list, PipelineTest's assertions, and the shared corpus's
  // `ctx:spec:headers:authorization`. apidef writes `name: "Authorization"`,
  // so emitting it verbatim would put the credential under a key none of
  // those touch — a second header beside the one they manage rather than
  // the one they manage. Header names are case-insensitive on the wire
  // (RFC 7230) and lower case on HTTP/2, so nothing is lost. Query
  // parameters and cookies ARE case-sensitive and keep the spec's spelling.
  const resolved = resolveAuthName(model)
  const name = 'header' === where ? resolved.toLowerCase() : resolved

  const basic = isHttpBasicAuth(model)

  // Read so the resolution is visible at generation time even though the
  // emitted code takes the prefix from options at runtime (the secrets
  // feature rewrites it there).
  const prefix = resolveAuthPrefix(model)

  // FOLDER NESTING, worked out from the template's own path and from
  // Main_kotlin's call site.
  //
  // Main_kotlin's `Copy({ from: 'tm/kotlin', exclude: [/src\//] })` runs at
  // Main's TOP LEVEL, so `tm/kotlin/utility/Prepare.kt` lands at
  // `<out>/utility/Prepare.kt` — and `build.gradle.kts` declares
  // `sourceSets["main"].kotlin.setSrcDirs(listOf("core", "utility",
  // "feature", "entity"))`, four SIBLING roots at the target root. So this
  // component opens exactly ONE segment, `utility`, and Main must call it
  // from its top level — NOT from inside `Folder({ name: 'core' })`, where
  // Config and SdkError are written.
  //
  // Nested there it would write `core/utility/PrepareAuth.kt`, and that
  // mistake is INVISIBLE to a compile: `core` is itself a source root and
  // gradle scans it recursively, so the misplaced file would still be
  // compiled and its `package <pkg>.utility` declaration would still make
  // `::prepareAuth` resolve. The tree would simply be wrong — a utility
  // file filed under core — with nothing to report it.
  Folder({ name: 'utility' }, () => {
    File({ name: 'PrepareAuth.' + target.ext }, () => {
      Content(render({
        kotlinpackage,
        suppressed: isAuthSuppressed(model),
        where,
        name,
        basic,
        prefix,
      }))
    })
  })
})


type AuthSpec = {
  kotlinpackage: string
  suppressed: boolean
  where: string
  name: string
  basic: boolean
  prefix: string
}


function render(spec: AuthSpec): string {
  // NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING.
  //
  // `isAuthActive` answers two different questions with one boolean:
  //
  //   1. `main.kit.config.auth.active: false` — this SDK is deliberately
  //      built WITHOUT auth. A per-SDK decision by the project.
  //   2. `main.kit.info.auth: false`          — the SPEC declares no
  //      security scheme. A fact about the API definition.
  //
  // Only (1) may silence prepareAuth. (2) says nothing about whether the
  // CALLER holds a credential, and kotlin has always let one through: the
  // optspec in `tm/kotlin/utility/MakeOptions.kt` supplies an
  // `"auth": { "prefix": "" }` default whether or not the generated Config
  // carries one, so `options["auth"]` is non-null at runtime, the
  // template's `options["auth"] == null` guard never fired, and the
  // credential was placed regardless of what the spec declared. The
  // generated secrets feature depends on exactly that — it resolves a
  // secret into `options.apikey` and expects prepareAuth to place it — and
  // so does generatedcompile's `kotlin: auth null beats an explicit apikey`
  // lane, whose baseline ("an ordinary apikey IS sent") is unsatisfiable
  // the moment the wider gate is used.
  //
  // `isAuthSuppressed` is the narrow one: `main.kit.config.auth.active ===
  // false` and nothing else. A spec that is merely silent keeps the
  // credential path it has always had.
  if (spec.suppressed) {
    return head(spec) + `import ${spec.kotlinpackage}.core.Context
import ${spec.kotlinpackage}.core.Spec

// This SDK is built with \`config.auth.active: false\`, so there is no
// credential to place. The function stays in the pipeline because Register
// binds it unconditionally and MakeSpecUrl calls it on every request, and a
// missing spec is still the same error it always was.
fun prepareAuth(ctx: Context): Spec {
  return ctx.spec
    ?: throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")
}
`
  }

  if ('query' === spec.where) return renderQuery(spec)
  if ('cookie' === spec.where) return renderCookie(spec)

  return renderHeader(spec)
}


function head(spec: AuthSpec): string {
  return `package ${spec.kotlinpackage}.utility

`
}


// The credential-absent test, identical in all three placements and
// identical to the template's. Kept as one string so a placement cannot
// drift from the others on what "no credential" means.
const SKIP = `  var skip = false
  if (apikey == null) {
    skip = true
  } else if (apikey is String && (NOT_FOUND == apikey || "" == apikey)) {
    skip = true
  }
`


// HEADER. The body is the deleted \`fun prepareAuth\` from
// tm/kotlin/utility/Prepare.kt, character for character, for a scheme that
// resolves to the defaults (header / Authorization -> "authorization") and
// is not HTTP Basic. Only the constant's VALUE moves with the model, plus
// the Basic block, which is emitted only for a Basic scheme.
function renderHeader(spec: AuthSpec): string {
  const basicBranch = spec.basic

  return head(spec) + (basicBranch ? `import java.util.Base64

` : '') + `import ${spec.kotlinpackage}.core.Context
import ${spec.kotlinpackage}.core.Spec
import ${spec.kotlinpackage}.utility.struct.Struct

private const val HEADER_AUTH = "${ktstr(spec.name)}"
private const val OPTION_APIKEY = "apikey"
` + (basicBranch ? `private const val OPTION_SECRET = "secret"
` : '') + `private const val NOT_FOUND = "__NOTFOUND__"

fun prepareAuth(ctx: Context): Spec {
  val spec = ctx.spec
    ?: throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")

  val headers = spec.headers
  val options = ctx.client!!.optionsMap()

  // Public APIs that need no auth omit the options.auth block entirely.
  if (options["auth"] == null) {
    headers.remove(HEADER_AUTH)
    return spec
  }

  val apikey = Struct.getprop(options, OPTION_APIKEY, NOT_FOUND)
` + basicBlock(spec) + `
` + SKIP + `
  if (skip) {
    headers.remove(HEADER_AUTH)
  } else {
    var authPrefix = ""
    val ap = Struct.getpath(options, listOf("auth", "prefix"))
    if (ap is String) {
      authPrefix = ap
    }
    val apikeyVal = if (apikey is String) apikey else ""
    // Empty prefix (raw apiKey credential) must not add a leading space.
    if ("" == authPrefix) {
      headers[HEADER_AUTH] = apikeyVal
    } else {
      headers[HEADER_AUTH] = "\$authPrefix \$apikeyVal"
    }
  }

  return spec
}
`
}


// HTTP BASIC IS HEADER-ONLY BY DEFINITION: the scheme is
// `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
// query parameter or a cookie, so the branch is emitted only from
// renderHeader, and only when the model says this API actually uses it — a
// bearer SDK carries none of it.
//
// `Struct.getpath` returns the UNDEF sentinel, not null, for a path the map
// does not have, so the switch is read with `is Boolean` rather than
// compared against `true`: the sentinel is neither.
function basicBlock(spec: AuthSpec): string {
  if (!spec.basic) return ''

  return `
  // True HTTP Basic Auth needs TWO credentials, base64-joined - a single
  // token in the header (the branch below) can never authenticate against
  // an API that actually checks \`Authorization: Basic base64(user:pass)\`.
  val basicOpt = Struct.getpath(options, listOf("auth", "basic"))
  if (basicOpt is Boolean && basicOpt) {
    val secret = Struct.getprop(options, OPTION_SECRET, NOT_FOUND)
    val noApikey = apikey == null ||
      (apikey is String && (NOT_FOUND == apikey || "" == apikey))
    val noSecret = secret == null ||
      (secret is String && (NOT_FOUND == secret || "" == secret))

    if (noApikey || noSecret) {
      headers.remove(HEADER_AUTH)
    } else {
      var basicPrefix = ""
      val bp = Struct.getpath(options, listOf("auth", "prefix"))
      if (bp is String) {
        basicPrefix = bp
      }
      val b64 = Base64.getEncoder().encodeToString(
        (apikey.toString() + ":" + secret.toString()).toByteArray(Charsets.UTF_8))
      if ("" == basicPrefix) {
        headers[HEADER_AUTH] = b64
      } else {
        headers[HEADER_AUTH] = "\$basicPrefix \$b64"
      }
    }

    return spec
  }
`
}


// QUERY. MakeSpecUrl fills `spec.query` (prepareQuery) BEFORE it calls
// prepareAuth, and makeUrl reads `spec.query` afterwards, url-escaping every
// key and value onto the URL — so the credential placed here reaches the
// wire as `?name=value`. The headers are never touched.
function renderQuery(spec: AuthSpec): string {
  return head(spec) + `import ${spec.kotlinpackage}.core.Context
import ${spec.kotlinpackage}.core.Spec
import ${spec.kotlinpackage}.utility.struct.Struct

private const val QUERY_AUTH = "${ktstr(spec.name)}"
private const val OPTION_APIKEY = "apikey"
private const val NOT_FOUND = "__NOTFOUND__"

fun prepareAuth(ctx: Context): Spec {
  val spec = ctx.spec
    ?: throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")

  val query = spec.query
  val options = ctx.client!!.optionsMap()

  // Public APIs that need no auth omit the options.auth block entirely.
  if (options["auth"] == null) {
    query.remove(QUERY_AUTH)
    return spec
  }

  val apikey = Struct.getprop(options, OPTION_APIKEY, NOT_FOUND)

` + SKIP + `
  if (skip) {
    query.remove(QUERY_AUTH)
  } else {
    val apikeyVal = if (apikey is String) apikey else ""
    // NO PREFIX IN A QUERY STRING. \`?${spec.name}=Bearer%20abc\` is not a
    // thing any API reads; the prefix is a header convention, so
    // options.auth.prefix is dropped here deliberately rather than silently
    // concatenated.
    query[QUERY_AUTH] = apikeyVal
  }

  return spec
}
`
}


// COOKIE. A cookie IS a header, so the credential rides the header bag —
// but the `cookie` header is SHARED with whatever cookies options.headers
// (or an earlier feature) put there, so our pair is SPLICED in and out
// rather than the header assigned over. Splicing also makes this
// idempotent: a retried request cannot end up carrying the credential
// twice.
function renderCookie(spec: AuthSpec): string {
  return head(spec) + `import ${spec.kotlinpackage}.core.Context
import ${spec.kotlinpackage}.core.Spec
import ${spec.kotlinpackage}.utility.struct.Struct

private const val COOKIE_HEADER = "cookie"
private const val COOKIE_AUTH = "${ktstr(spec.name)}"
private const val OPTION_APIKEY = "apikey"
private const val NOT_FOUND = "__NOTFOUND__"

// The cookie header minus our own pair, every other cookie untouched.
private fun cookiesWithoutCred(headers: MutableMap<String, Any?>): String {
  val existing = headers[COOKIE_HEADER]
  if (existing !is String || "" == existing) {
    return ""
  }

  val kept = mutableListOf<String>()
  for (part in existing.split(";")) {
    val piece = part.trim()
    if ("" == piece || COOKIE_AUTH == piece || piece.startsWith("\$COOKIE_AUTH=")) {
      continue
    }
    kept.add(piece)
  }

  return kept.joinToString("; ")
}

// Set (a value) or remove (null) our pair, leaving every other cookie in
// place.
private fun applyCookie(headers: MutableMap<String, Any?>, value: String?) {
  val rest = cookiesWithoutCred(headers)

  if (value == null) {
    if ("" == rest) {
      headers.remove(COOKIE_HEADER)
    } else {
      headers[COOKIE_HEADER] = rest
    }
    return
  }

  val pair = "\$COOKIE_AUTH=\$value"
  headers[COOKIE_HEADER] = if ("" == rest) pair else "\$rest; \$pair"
}

fun prepareAuth(ctx: Context): Spec {
  val spec = ctx.spec
    ?: throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")

  val headers = spec.headers
  val options = ctx.client!!.optionsMap()

  // Public APIs that need no auth omit the options.auth block entirely.
  if (options["auth"] == null) {
    applyCookie(headers, null)
    return spec
  }

  val apikey = Struct.getprop(options, OPTION_APIKEY, NOT_FOUND)

` + SKIP + `
  if (skip) {
    applyCookie(headers, null)
  } else {
    val apikeyVal = if (apikey is String) apikey else ""
    // NO PREFIX IN A COOKIE either - a cookie carries a bare \`name=value\`
    // pair, not a header's scheme-prefixed credential.
    applyCookie(headers, apikeyVal)
  }

  return spec
}
`
}


// A Kotlin double-quoted string literal body. These names come from the
// API's own securityScheme, so they are not guaranteed to be bare
// identifiers — and `$` has to go too, because Kotlin reads it as a string
// template introducer rather than as a dollar sign.
function ktstr(s: string): string {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
}


export {
  PrepareAuth
}
