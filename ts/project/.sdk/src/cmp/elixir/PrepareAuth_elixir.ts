
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


import {
  elixirString,
} from './utility_elixir'


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated. The elixir port of cmp/ts/PrepareAuth_ts.ts; see
// that file for the full account, and cmp/rb/PrepareAuth_rb.ts for the
// cookie-splice and basic-auth shapes this one follows.
//
// apidef has always resolved the scheme's `in` and `name` into
// `main.kit.info.security` — joplin's says `in: "query", name: "token"` —
// and generation dropped both. The result was an SDK that sent a header the
// API does not read and never sent the query parameter it does, so it could
// not authenticate at all. Four repos in the cedar fleet shipped that way:
// joplin (`token`), pipedrive (`api_token`), trello (`key`),
// lm-umbrella (`apiKey`).
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in a
// bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time.
//
// ELIXIR IS THE ODD ONE OUT: it had NO prepare_auth template. The logic was
// embedded in `tm/elixir/lib/projectname/utility.ex` as `prepare_auth_impl/1`,
// one clause among thirty in the 1670-line runtime module. So this is an
// EXTRACTION as well as a port, and the extraction is into the function's
// OWN compilation unit — the PREFERRED shape — because Elixir has no reason
// to need the fallback:
//
//   * mix compiles every `.ex` under `lib/`, with no manifest, include list
//     or import to keep in step. A new file in lib/<app>/ is compiled by
//     virtue of existing.
//   * Elixir resolves modules by their `defmodule`, never by path, so a
//     module in its own file is indistinguishable at every call site from
//     the same code inlined elsewhere.
//   * THE BINDING IS A VALUE, NOT A LEXICAL REFERENCE. utility.ex builds the
//     utility node by setprop-ing a function into each slot
//     (`{"prepare_auth", &prepare_auth_impl/1}`), and every caller reaches it
//     through `u(ctx, "prepare_auth").(ctx)`. A remote capture
//     `&PrepareAuth.prepare_auth_impl/1` is the same kind of value, so the
//     registrar, the feature-override contract (a feature setprops over the
//     slot on the reference-stable node) and the `Utility.prepare_auth/1`
//     dispatch wrapper are all untouched. `Utility.prepare_auth(ctx)` —
//     which is what Main.fragment.ex, make_spec_impl, pipeline_test.exs and
//     primary_utility_test.exs all call — still resolves, still dispatches
//     through the node, and still honours an override.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  // FOLDER NESTING, worked out from the template's own path rather than
  // guessed. utility.ex lives at `tm/elixir/lib/projectname/utility.ex`, and
  // Main_elixir copies that directory with
  //
  //   Folder({name:'lib'}, () => Copy({from:'tm/elixir/lib/projectname',
  //                                    to: model.const.name}))
  //
  // so the runtime lands at `lib/<name>/`. This component is CALLED from
  // inside Main's second `Folder({ name: 'lib' })` block — the one that
  // writes the generated (as opposed to copied) lib files — so `lib` is
  // ALREADY OPEN at the call site and only `<name>` is opened here. The
  // result is `lib/<name>/prepare_auth.ex`, beside the utility.ex that
  // registers it.
  //
  // Opening `lib` again here would write `lib/lib/<name>/prepare_auth.ex`.
  // That is the ts port's `src/src/utility/` trap, and it is WORSE in elixir
  // than anywhere else: mix compiles everything under lib/ regardless of
  // depth, so the module would still compile, still be found by name, and
  // the mistake would be invisible to every test — only the published tree
  // would look wrong. (Main_elixir carries the same warning about
  // lib/projectname/ for the same reason.)
  //
  // Main's two `Folder({ name: 'lib' })` blocks are SIBLINGS, not nested:
  // jostraca folders are scoped to their callback, so both resolve to
  // `lib/` and this component sees exactly one of them open.
  Folder({ name: model.const.name }, () => {
    File({ name: 'prepare_auth.' + target.ext }, () => {
      Content(render({
        Name: model.const.Name,
        active: authSwitchedOn(model),
        where: resolveAuthIn(model),
        name: resolveAuthName(model),
        basic: isHttpBasicAuth(model),
        // Read so the resolution is visible at generation time even though
        // the emitted code takes the prefix from options at runtime (the
        // secrets feature rewrites it there).
        prefix: resolveAuthPrefix(model),
      }))
    })
  })
})


type AuthSpec = {
  Name: string
  active: boolean
  where: string
  name: string
  basic: boolean
  prefix: string
}


function render(spec: AuthSpec): string {
  const head = `# ${spec.Name} SDK utility: prepare_auth
#
# WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so this module is
# GENERATED from the model rather than copied from tm/. Do not edit by hand.
#
# Extracted from ${spec.Name}.Utility, which still owns the registration
# (\`{"prepare_auth", &PrepareAuth.prepare_auth_impl/1}\`) and the
# \`prepare_auth/1\` dispatch wrapper every caller goes through. A feature that
# overrides the utility slot overrides this, exactly as before.

defmodule ${spec.Name}.PrepareAuth do
  alias Voxgig.Struct, as: S
  alias ${spec.Name}.Context

`

  // NO AUTH AT ALL — the project switched it off. See authSwitchedOn for why
  // ONLY an explicit switch counts.
  if (!spec.active) {
    return head + `  # This SDK is configured with authentication off, so there is no
  # credential to place. The function stays in the pipeline because
  # make_spec calls it unconditionally and Utility registers it
  # unconditionally.
  def prepare_auth_impl(ctx) do
    spec = S.getprop(ctx, "spec")

    if spec == nil do
      {nil, Context.make_error(ctx, "auth_no_spec", "Expected context spec property to be defined.")}
    else
      {spec, nil}
    end
  end
end
`
  }

  const query = 'query' === spec.where
  const cookie = 'cookie' === spec.where

  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch is emitted only where it can
  // mean something — and only when the model says the scheme IS basic, so an
  // ordinary bearer SDK carries no dead code and regenerates byte-identical
  // to what utility.ex produced.
  const basicHere = spec.basic && 'header' === spec.where

  // HEADER NAMES ARE LOWER-CASED; QUERY AND COOKIE NAMES ARE NOT.
  //
  // `resolveAuthName` answers 'Authorization' by default, but the whole
  // elixir runtime spells header names in lower case: the extracted code
  // said `S.delprop(headers, "authorization")`, feature/secrets.ex rewrites
  // `headers["authorization"]`, feature/debug.ex masks the same key, the
  // shared corpus asserts `ctx:spec:headers:authorization`, and
  // pipeline_test.exs reads it. A struct map key is case-sensitive, so
  // emitting "Authorization" verbatim would put the credential under a key
  // nothing reads and leave the secrets feature writing a SECOND header.
  // HTTP header names are case-insensitive on the wire, so lower-casing
  // costs nothing. A query parameter and a cookie ARE case-sensitive
  // (`?Token=` is not `?token=`), so those keep the spec's spelling.
  const credName = query || cookie ? spec.name : spec.name.toLowerCase()

  const attrs = `  @cred_name ${elixirString(credName)}
` +
    (cookie ? `  @cookie_header "cookie"
` : '') +
    `  @option_apikey "apikey"
` +
    (basicHere ? `  @option_secret "secret"
` : '') +
    `  @not_found "__NOTFOUND__"

`

  // The bag the credential lands in. A cookie rides the HEADER bag, because
  // a cookie IS a header.
  const bag = query
    ? `      query = S.getprop(spec, "query")`
    : `      headers = S.getprop(spec, "headers")`

  // Clearing: a query parameter and a header are a plain delprop, but a
  // cookie header is SHARED with whatever cookies the caller set, so only
  // our own pair comes out.
  const clear = query
    ? 'S.delprop(query, @cred_name)'
    : cookie
      ? 'apply_cookie(headers, nil)'
      : 'S.delprop(headers, @cred_name)'

  const preamble = `  def prepare_auth_impl(ctx) do
    spec = S.getprop(ctx, "spec")

    if spec == nil do
      {nil, Context.make_error(ctx, "auth_no_spec", "Expected context spec property to be defined.")}
    else
${bag}
      options = opts_map(S.getprop(ctx, "client"))

      # Public APIs that need no auth omit the options.auth block entirely.
      if S.getprop(options, "auth") == nil do
        ${clear}
        {spec, nil}
      else
        apikey = S.getprop(options, @option_apikey, @not_found)

`

  const body = basicHere
    ? `        # True HTTP Basic Auth needs TWO credentials, base64-joined - a single
        # token in the header (the branch below) can never authenticate
        # against an API that actually checks
        # \`Authorization: Basic base64(user:pass)\`.
        if S.getpath(options, "auth.basic") == true do
          secret = S.getprop(options, @option_secret, @not_found)
          no_apikey = not is_binary(apikey) or apikey == @not_found or apikey == ""
          no_secret = not is_binary(secret) or secret == @not_found or secret == ""

          if no_apikey or no_secret do
            S.delprop(headers, @cred_name)
          else
            ap = S.getpath(options, "auth.prefix")
            auth_prefix = if is_binary(ap), do: ap, else: ""
            b64 = Base.encode64(apikey <> ":" <> secret)
            hv = if auth_prefix != "", do: auth_prefix <> " " <> b64, else: b64
            S.setprop(headers, @cred_name, hv)
          end
        else
${indent(place(spec, clear), 1)}
        end
`
    : place(spec, clear)

  return head + attrs + preamble + body + `
        {spec, nil}
      end
    end
  end

` + helpers(spec).replace(/\n+$/, '\n') + `end
`
}


// The one thing that actually differs between placements: where the
// credential is written, and whether the prefix travels with it.
function place(spec: AuthSpec, clear: string): string {
  const guard = `        if (is_binary(apikey) and apikey == @not_found) or apikey == nil or apikey == "" do
          ${clear}
        else
`

  if ('query' === spec.where) {
    return guard + `          apikey_val = if is_binary(apikey), do: apikey, else: ""
          # NO PREFIX IN A QUERY STRING. \`?${spec.name}=Bearer%20abc\` is not a
          # thing any API reads: the prefix is a header convention, so
          # options.auth.prefix is dropped here deliberately rather than
          # silently concatenated.
          S.setprop(query, @cred_name, apikey_val)
        end
`
  }

  if ('cookie' === spec.where) {
    return guard + `          apikey_val = if is_binary(apikey), do: apikey, else: ""
          # NO PREFIX IN A COOKIE either - a cookie carries a bare
          # \`name=value\` pair, not a header's scheme-prefixed credential.
          apply_cookie(headers, apikey_val)
        end
`
  }

  // HEADER: the extracted body, unchanged.
  return guard + `          ap = S.getpath(options, "auth.prefix")
          auth_prefix = if is_binary(ap), do: ap, else: ""
          apikey_val = if is_binary(apikey), do: apikey, else: ""
          # Empty prefix (raw apiKey credential) must not add a leading space.
          hv = if auth_prefix != "", do: auth_prefix <> " " <> apikey_val, else: apikey_val
          S.setprop(headers, @cred_name, hv)
        end
`
}


// The private helpers the emitted body needs. `opts_map/1` is the one
// utility.ex keeps for itself (it is `defp` there, so it could not be
// called across the module boundary) - eight lines, reproduced rather than
// made public, because widening a private helper to export one caller is a
// bigger change to utility.ex than this extraction is.
function helpers(spec: AuthSpec): string {
  const optsMap = `  # The client's options as a MAP, cloned. The clone is load-bearing: the
  # secrets feature rewrites options.apikey on the live client, and
  # prepare_auth must read a snapshot rather than the node the feature is
  # mutating. Same body as ${spec.Name}.Utility's own private opts_map/1.
  defp opts_map(client) do
    o = S.clone(S.getprop(client, "options"))
    if S.ismap(o), do: o, else: S.jm([])
  end

`

  if ('cookie' !== spec.where) {
    return optsMap
  }

  // A cookie IS a header, and the `cookie` header is SHARED with whatever
  // cookies the caller set - so the pair is spliced in and out rather than
  // the header assigned over. Splicing also makes this idempotent: a
  // retried request cannot end up carrying the credential twice.
  return optsMap + `  # The cookie header minus our own pair, every other cookie untouched.
  defp cookies_without_cred(headers) do
    existing = S.getprop(headers, @cookie_header)

    if is_binary(existing) and existing != "" do
      existing
      |> String.split(";")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(fn piece ->
        piece == "" or piece == @cred_name or
          String.starts_with?(piece, @cred_name <> "=")
      end)
      |> Enum.join("; ")
    else
      ""
    end
  end

  # Remove our pair, leaving the rest of the cookie header in place.
  defp apply_cookie(headers, nil) do
    rest = cookies_without_cred(headers)

    if rest == "" do
      S.delprop(headers, @cookie_header)
    else
      S.setprop(headers, @cookie_header, rest)
    end
  end

  # Set our pair, leaving the rest of the cookie header in place.
  defp apply_cookie(headers, value) do
    rest = cookies_without_cred(headers)
    pair = @cred_name <> "=" <> value
    S.setprop(headers, @cookie_header, if(rest == "", do: pair, else: rest <> "; " <> pair))
  end

`
}


// Indent a rendered block by `n` two-space levels, leaving blank lines blank
// (a trailing-whitespace-only line is what `mix format --check-formatted`
// reports first).
function indent(block: string, n: number): string {
  const pad = '  '.repeat(n)
  return block.split('\n')
    .map((line) => '' === line ? line : pad + line)
    .join('\n')
    .replace(/\n$/, '')
}


// NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING (the py port found
// this first; same reasoning, same fix).
//
// `isAuthActive` is false whenever the SPEC declares no security scheme
// (`main.kit.info.auth: false`). That is a statement about the DEFINITION,
// not a ban on ever sending a credential: apidef writes it for every spec
// with no securitySchemes block, GitHub's official OpenAPI included, and
// those SDKs are still expected to honour an `apikey` the caller passes.
// `optspec` always declares `apikey` and make_options fills `options.auth`
// from its defaults, so the runtime `S.getprop(options, "auth") == nil`
// guard never fired and every such SDK has always sent `options.apikey`.
//
// Gating the body on `isAuthActive` therefore does not trim dead code, it
// deletes working authentication - and takes the secrets feature with it,
// since that resolves a secret into options.apikey and prepare_auth then
// places nothing. elixir is one of the three targets in generatedcompile's
// AUTHNULL_STANDALONE list, whose lane (`elixir: the secrets feature runs
// with the feature active`) runs the shipped secrets suite against a LIVE
// client on a real mix and names its two auth-nil cases.
//
// So the no-op is emitted only when the PROJECT says so: `config.auth.active:
// false`, an explicit per-SDK switch nobody sets by accident. A spec that is
// merely silent keeps the credential path it has always had.
function authSwitchedOn(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}


export {
  PrepareAuth
}
