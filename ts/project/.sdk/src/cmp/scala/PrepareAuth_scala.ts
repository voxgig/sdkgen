
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


import { scalaPackage } from './utility_scala'


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated. The scala port of cmp/ts/PrepareAuth_ts.ts; see
// that file for the full account.
//
// scala had no prepare_auth template to delete. The logic was an `object
// PrepareAuth` EMBEDDED in `tm/scala/utility/Prepare.scala` alongside the
// six other prepare steps, hardcoding `val HEADER_AUTH = "authorization"`.
// apidef has always resolved the scheme's `in` and `name` into
// `main.kit.info.security` — joplin's says `in: "query", name: "token"` —
// and generation dropped both, so the SDK sent a header the API does not
// read and never sent the query parameter it does.
//
// EXTRACTED INTO ITS OWN FILE rather than generating the whole of
// Prepare.scala. A Scala `object` is not tied to a file name: the compiler
// resolves `PrepareAuth.prepareAuth` by PACKAGE, and every caller —
// utility/Register.scala's `u.prepareAuth = (ctx) => PrepareAuth
// .prepareAuth(ctx)`, which is the only binding — already names it
// unqualified from inside `package SCALAPACKAGE.utility`. So moving the
// object into `utility/PrepareAuth.scala` in the same package leaves
// Register, core/Utility.scala's `var prepareAuth` field, utility/MakeSpec
// .scala's `utility.prepareAuth(ctx)` and core/SdkClient.scala's call
// site all resolving exactly as before, with no edit to any of them. The
// other six objects in Prepare.scala (PreparePath, PrepareMethod,
// PrepareParams, PrepareQuery, PrepareHeaders, PrepareBody) are placement-
// independent and stay templated, so the generated surface is exactly the
// part that varies with the API.
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in a
// bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const where = resolveAuthIn(model)

  // LOWERCASED FOR A HEADER, VERBATIM OTHERWISE. apidef writes
  // `name: "Authorization"`, the deleted `object PrepareAuth` hardcoded
  // `"authorization"`, and the whole scala runtime reads the lower-case
  // key: the shared primary corpus asserts
  // `ctx:spec:headers:authorization`, SecretsFeature.reauth rewrites
  // `headers.put("authorization", ...)` in place on a token refresh, and
  // spec.headers is a plain case-sensitive LinkedHashMap. Emitting
  // `Authorization` verbatim would put the credential under a key nothing
  // reads. A query parameter and a cookie ARE case-sensitive, so they keep
  // the spec's spelling exactly.
  const resolved = resolveAuthName(model)
  const name = 'header' === where ? resolved.toLowerCase() : resolved

  const basic = isHttpBasicAuth(model)

  // Read so the resolution is visible at generation time even though the
  // emitted code takes the prefix from options at runtime (the secrets
  // feature rewrites it there).
  const prefix = resolveAuthPrefix(model)

  // NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING. See
  // isAuthSuppressed in sdkgen's utility.ts: `isAuthActive` is ALSO false
  // whenever `main.kit.info.auth` is false, which says only that the SPEC
  // declared no security scheme — such an SDK still carries a credential,
  // because Make.scala's optspec always declares `apikey` and fills
  // `options.auth` from its `{ "prefix": "" }` default, so the runtime
  // `options.get("auth") == null` guard never fires and every such SDK has
  // always sent `options.apikey`. Emitting a no-op for those would
  // silently remove working authentication and take the secrets feature
  // with it (SecretsFeature resolves a secret into options.apikey and
  // prepareAuth then places nothing).
  //
  // `main.kit.config.auth.active: false` is the project saying "this SDK
  // sends no credential, ever" — the only signal that can honestly be
  // honoured before runtime, so it is the only one used.
  const active = !isAuthSuppressed(model)

  const scalapackage = scalaPackage(model)

  // FOLDER NESTING: exactly one segment, `utility`.
  //
  // Worked out from the deleted code's own path and from Main_scala's call
  // site. Main_scala's blanket `Copy({ from: 'tm/scala' })` runs at the
  // TARGET ROOT (its excludes and the scala tree are root-relative, and
  // project.scala/Makefile sit beside core/, utility/, entity/), so
  // `tm/scala/utility/Prepare.scala` lands at `<root>/utility/Prepare
  // .scala`. Reproducing that path from Main's TOP LEVEL therefore needs
  // `utility` and nothing above it — the same one-segment shape
  // EntityBase_scala uses for `entity`.
  //
  // So this component must be invoked from Main_scala's top level and NOT
  // from inside its `Folder({ name: 'core' })`, where Config and
  // EntityTypes are written: nested there it would emit
  // `core/utility/PrepareAuth.scala`, whose `package <pkg>.utility`
  // declaration contradicts its directory, while Register.scala kept
  // binding the stale object. There is no `src` folder in a scala SDK at
  // all, so the ts port's `src/src/utility/` failure has no scala twin —
  // the scala twin would be `core/`.
  Folder({ name: 'utility' }, () => {
    File({ name: 'PrepareAuth.' + target.ext }, () => {
      Content(render({ scalapackage, active, where, name, prefix, basic }))
    })
  })
})


type AuthSpec = {
  scalapackage: string
  active: boolean
  where: string
  name: string
  prefix: string
  basic: boolean
}


function render(spec: AuthSpec): string {
  // The package line alone. Each placement emits its OWN import block,
  // because they need different ones and the scala templates put the
  // java.* imports first - Prepare.scala, Make.scala and Spec.scala all
  // read `import java.util...` then the SDK's own packages.
  const head = `package ${spec.scalapackage}.utility

`

  // NO AUTH AT ALL - the project switched it off explicitly (see `active`
  // above for why only an EXPLICIT switch counts). The SDK gets a
  // prepareAuth that is honest about it rather than one that removes a
  // header nobody set; Struct is not imported, because nothing here reads
  // an option.
  if (!spec.active) {
    return head + `import ${spec.scalapackage}.core.{Context, Spec}

// This SDK is configured with authentication off
// (main.kit.config.auth.active: false), so there is no credential to
// place. The object stays in the pipeline because Register binds
// prepareAuth unconditionally and MakeSpec calls it on every request.
object PrepareAuth {

  def prepareAuth(ctx: Context): Spec = {
    val spec = ctx.spec
    if (spec == null) throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")

    spec
  }
}
`
  }

  if ('query' === spec.where) return renderQuery(spec, head)
  if ('cookie' === spec.where) return renderCookie(spec, head)

  return renderHeader(spec, head)
}


// HEADER. Behaviourally the deleted `object PrepareAuth` when the scheme
// resolves to the defaults (header / Authorization): the same option names,
// the same `skip` idiom for a missing credential, the same auth_no_spec
// error, the same empty-prefix rule. Only the constant's VALUE moves with
// the model, plus the HTTP Basic block, which is emitted only for a basic
// scheme.
function renderHeader(spec: AuthSpec, head: string): string {
  return head + `${spec.basic ? `import java.nio.charset.StandardCharsets
import java.util.Base64

` : ''}import ${spec.scalapackage}.core.{Context, Spec}
import ${spec.scalapackage}.utility.struct.Struct

// Places the credential as the \`${spec.name}\` request header.
// GENERATED from the API's security scheme (main.kit.info.security:
// in: header, name: ${spec.name}${spec.basic ? ', http basic' : ''}).
object PrepareAuth {
  val CRED_NAME = "${scalastr(spec.name)}"
  val OPTION_APIKEY = "apikey"
${spec.basic ? `  val OPTION_SECRET = "secret"\n` : ''}  val NOT_FOUND = "__NOTFOUND__"

  def prepareAuth(ctx: Context): Spec = {
    val spec = ctx.spec
    if (spec == null) throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")

    val headers = spec.headers
    val options = ctx.client.optionsMap()

    // Public APIs that need no auth omit the options.auth block entirely.
    if (options.get("auth") == null) {
      headers.remove(CRED_NAME)
      return spec
    }

    val apikey = Struct.getprop(options, OPTION_APIKEY, NOT_FOUND)
${basicBlock(spec)}
    var skip = false
    if (apikey == null) skip = true
    else apikey match {
      case s: String if NOT_FOUND == s || "" == s => skip = true
      case _ =>
    }

    if (skip) {
      headers.remove(CRED_NAME)
    } else {
      var authPrefix = ""
      Struct.getpath(options, java.util.List.of("auth", "prefix")) match { case s: String => authPrefix = s; case _ => }
      val apikeyVal = apikey match { case s: String => s; case _ => "" }
      // A raw credential (empty prefix, e.g. an apiKey scheme) must go in
      // as-is; only a non-empty prefix (Bearer/Basic/OAuth) is space-joined.
      if ("" == authPrefix) headers.put(CRED_NAME, apikeyVal)
      else headers.put(CRED_NAME, authPrefix + " " + apikeyVal)
    }

    spec
  }
}
`
}


// HTTP Basic is header-only by definition: the scheme is `Authorization:
// Basic base64(user:pass)`. It cannot be expressed as a query parameter or
// a cookie, so renderQuery and renderCookie never call this - and it is
// emitted only when the model says the scheme IS basic, so an ordinary
// bearer SDK carries no dead code and regenerates unchanged.
function basicBlock(spec: AuthSpec): string {
  if (!spec.basic) return ''

  return `
    // True HTTP Basic Auth needs TWO credentials, base64-joined - a single
    // token in the header (the branch below) can never authenticate against
    // an API that actually checks \`Authorization: Basic base64(user:pass)\`.
    if (java.lang.Boolean.TRUE == Struct.getpath(options, java.util.List.of("auth", "basic"))) {
      val secret = Struct.getprop(options, OPTION_SECRET, NOT_FOUND)
      val noApikey = apikey == null || (apikey match { case s: String => NOT_FOUND == s || "" == s; case _ => false })
      val noSecret = secret == null || (secret match { case s: String => NOT_FOUND == s || "" == s; case _ => false })

      if (noApikey || noSecret) {
        headers.remove(CRED_NAME)
      } else {
        var basicPrefix = ""
        Struct.getpath(options, java.util.List.of("auth", "prefix")) match { case s: String => basicPrefix = s; case _ => }
        val b64 = Base64.getEncoder.encodeToString(
          ((apikey match { case s: String => s; case _ => "" }) + ":" +
            (secret match { case s: String => s; case _ => "" })).getBytes(StandardCharsets.UTF_8))
        if ("" == basicPrefix) headers.put(CRED_NAME, b64)
        else headers.put(CRED_NAME, basicPrefix + " " + b64)
      }

      return spec
    }
`
}


// QUERY. The credential is a query parameter, so it goes in spec.query and
// the headers are never touched. This is the placement joplin, pipedrive,
// trello and lm-umbrella declare and no generated SDK ever emitted.
function renderQuery(spec: AuthSpec, head: string): string {
  return head + `import ${spec.scalapackage}.core.{Context, Spec}
import ${spec.scalapackage}.utility.struct.Struct

// Places the credential as the \`${spec.name}\` query parameter.
// GENERATED from the API's security scheme (main.kit.info.security:
// in: query, name: ${spec.name}).
object PrepareAuth {
  val CRED_NAME = "${scalastr(spec.name)}"
  val OPTION_APIKEY = "apikey"
  val NOT_FOUND = "__NOTFOUND__"

  def prepareAuth(ctx: Context): Spec = {
    val spec = ctx.spec
    if (spec == null) throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")

    val query = spec.query
    val options = ctx.client.optionsMap()

    // Public APIs that need no auth omit the options.auth block entirely.
    if (options.get("auth") == null) {
      query.remove(CRED_NAME)
      return spec
    }

    val apikey = Struct.getprop(options, OPTION_APIKEY, NOT_FOUND)

    var skip = false
    if (apikey == null) skip = true
    else apikey match {
      case s: String if NOT_FOUND == s || "" == s => skip = true
      case _ =>
    }

    if (skip) {
      query.remove(CRED_NAME)
    } else {
      val apikeyVal = apikey match { case s: String => s; case _ => "" }
      // NO PREFIX IN A QUERY STRING. \`?${spec.name}=Bearer%20abc\` is not a
      // thing any API reads: the prefix is a header convention, so the
      // options auth.prefix is dropped here deliberately rather than
      // silently concatenated.
      query.put(CRED_NAME, apikeyVal)
    }

    spec
  }
}
`
}


// COOKIE. A cookie IS a header, so the credential rides the header bag -
// but the `cookie` header is SHARED with whatever cookies the caller set,
// so the pair is spliced in and out rather than the header assigned over.
// Splicing also makes this idempotent: a retried request cannot end up
// carrying the credential twice.
function renderCookie(spec: AuthSpec, head: string): string {
  return head + `import java.util.{Map => JMap}

import ${spec.scalapackage}.core.{Context, Spec}
import ${spec.scalapackage}.utility.struct.Struct

// Places the credential as the \`${spec.name}\` cookie.
// GENERATED from the API's security scheme (main.kit.info.security:
// in: cookie, name: ${spec.name}).
object PrepareAuth {
  val COOKIE_HEADER = "cookie"
  val CRED_NAME = "${scalastr(spec.name)}"
  val OPTION_APIKEY = "apikey"
  val NOT_FOUND = "__NOTFOUND__"

  // The cookie header minus our own pair, every other cookie untouched.
  private def without(headers: JMap[String, Object]): String = {
    val existing = headers.get(COOKIE_HEADER) match { case s: String => s; case _ => "" }
    if ("" == existing) return ""

    val kept = existing.split(";").map(_.trim).filter { piece =>
      "" != piece && CRED_NAME != piece && !piece.startsWith(CRED_NAME + "=")
    }
    kept.mkString("; ")
  }

  // Set (a value) or remove (null) our pair, leaving the rest in place.
  private def place(headers: JMap[String, Object], value: String): Unit = {
    val rest = without(headers)

    if (value == null) {
      if ("" == rest) headers.remove(COOKIE_HEADER)
      else headers.put(COOKIE_HEADER, rest)
      return
    }

    val pair = CRED_NAME + "=" + value
    if ("" == rest) headers.put(COOKIE_HEADER, pair)
    else headers.put(COOKIE_HEADER, rest + "; " + pair)
  }

  def prepareAuth(ctx: Context): Spec = {
    val spec = ctx.spec
    if (spec == null) throw ctx.makeError("auth_no_spec", "Expected context spec property to be defined.")

    val headers = spec.headers
    val options = ctx.client.optionsMap()

    // Public APIs that need no auth omit the options.auth block entirely.
    if (options.get("auth") == null) {
      place(headers, null)
      return spec
    }

    val apikey = Struct.getprop(options, OPTION_APIKEY, NOT_FOUND)

    var skip = false
    if (apikey == null) skip = true
    else apikey match {
      case s: String if NOT_FOUND == s || "" == s => skip = true
      case _ =>
    }

    if (skip) {
      place(headers, null)
    } else {
      val apikeyVal = apikey match { case s: String => s; case _ => "" }
      // NO PREFIX IN A COOKIE either - a cookie carries a bare
      // \`name=value\` pair, not a header's scheme-prefixed credential.
      place(headers, apikeyVal)
    }

    spec
  }
}
`
}


function scalastr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}


export {
  PrepareAuth
}
