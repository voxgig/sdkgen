
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
// rather than templated.
//
// This was a static file at `tm/js/src/utility/PrepareAuthUtility.js` that
// hardcoded `authorization` and a header. apidef has always resolved the
// scheme's `in` and `name` into `main.kit.info.security` — joplin's says
// `in: "query", name: "token"` — and generation dropped both. The result
// was an SDK that sent a header the API does not read and never sent the
// query parameter it does, so it could not authenticate at all. Four
// repos in the cedar fleet shipped that way: joplin (`token`), pipedrive
// (`api_token`), trello (`key`), lm-umbrella (`apiKey`).
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in
// a bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time.
//
// Ported from PrepareAuth_ts, which is the proven shape. The differences
// are the language's, not the design's: no type import, `module.exports`
// instead of `export {}`, and the prefix read inline off `options.auth`
// exactly as the js template read it, rather than hoisted into a local
// that the query and cookie bodies would leave unused.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const active = isAuthActive_js(model)
  const where = resolveAuthIn(model)
  // LOWERCASED FOR A HEADER, VERBATIM OTHERWISE. The js runtime keys its
  // header map in lower case — the old template hardcoded 'authorization',
  // the shared corpus asserts ctx:spec:headers:authorization, and every
  // generatedcompile probe reads the lower-case key. apidef writes
  // name: "Authorization", so emitting it verbatim hides the credential
  // under a key nothing reads. Query parameters and cookies ARE
  // case-sensitive and keep the spec's spelling.
  const resolvedName = resolveAuthName(model)
  const name = 'header' === where ? resolvedName.toLowerCase() : resolvedName
  const prefix = resolveAuthPrefix(model)
  const basic = isHttpBasicAuth(model)

  // No `src` folder here: Main_js already opened it, and Config, Schema,
  // SdkError, EntityBase and EntityTypes all write straight into it. The
  // template this replaces lived at `tm/js/src/utility/`, so relative to
  // that open folder the file needs `utility` and nothing more. Opening a
  // second `src` would put it at src/src/utility/ — where nothing imports
  // it, and the stale copy at src/utility/ keeps being used.
  Folder({ name: 'utility' }, () => {
    File({ name: 'PrepareAuthUtility.' + target.ext }, () => {
      Content(render({ active, where, name, prefix, basic }))
    })
  })
})


function render(spec: {
  active: boolean, where: string, name: string, prefix: string, basic: boolean
}): string {

  // NO AUTH AT ALL. A public API's SDK gets a prepareAuth that is honest
  // about it rather than one that deletes a header nobody set.
  if (!spec.active) {
    return `
// This API declares no authentication, so there is no credential to
// place. The function stays in the pipeline because makeSpec calls it
// unconditionally.
function prepareAuth(ctx) {
  const spec = ctx.spec

  if (null == spec) {
    return ctx.error('auth_no_spec', 'Expected context spec property to be defined.')
  }

  return spec
}

module.exports = {
  prepareAuth
}
`
  }

  const preamble = `
const CRED_name = '${jsstr(spec.name)}'

const OPTION_apikey = 'apikey'${spec.basic && 'header' === spec.where ? `
const OPTION_secret = 'secret'` : ''}

const NOTFOUND = '__NOTFOUND__'

function prepareAuth(ctx) {
  const utility = ctx.utility

  const struct = utility.struct
  const getprop = struct.getprop
  const setprop = struct.setprop
  const delprop = struct.delprop

  const client = ctx.client
  const spec = ctx.spec

  if (null == spec) {
    return ctx.error('auth_no_spec', 'Expected context spec property to be defined.')
  }

  const ${bag(spec.where)} = spec.${bag(spec.where)}

  const options = client.options()

  // Public APIs that need no auth omit the options.auth block entirely.
  if (null == options.auth) {
    ${clear(spec.where)}
    return spec
  }

  const apikey = getprop(options, OPTION_apikey, NOTFOUND)
`

  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch is emitted only where it
  // can mean something.
  const basicBlock = (spec.basic && 'header' === spec.where) ? `
  // True HTTP Basic Auth needs TWO credentials, base64-joined - a single
  // token in the header (the branch below) can never authenticate against
  // an API that actually checks \`Authorization: Basic base64(user:pass)\`.
  if (true === options.auth.basic) {
    const secret = getprop(options, OPTION_secret, NOTFOUND)
    const noApikey = NOTFOUND === apikey || null == apikey || '' === apikey
    const noSecret = NOTFOUND === secret || null == secret || '' === secret

    if (noApikey || noSecret) {
      delprop(headers, CRED_name)
    }
    else {
      const b64 = Buffer.from(apikey + ':' + secret).toString('base64')
      setprop(headers, CRED_name,
        options.auth.prefix ? options.auth.prefix + ' ' + b64 : b64)
    }

    return spec
  }
` : ''

  return preamble + basicBlock + `
  if (NOTFOUND === apikey || null == apikey || '' === apikey) {
    ${clear(spec.where)}
  }
  else {
${place(spec.where)}
  }

  return spec
}

module.exports = {
  prepareAuth
}
`
}


// The bag the credential lands in, per placement. Cookies ride the header
// bag because a cookie IS a header.
function bag(where: string): string {
  return 'query' === where ? 'query' : 'headers'
}


function clear(where: string): string {
  return 'query' === where ? 'delprop(query, CRED_name)' : 'delprop(headers, CRED_name)'
}


function place(where: string): string {
  if ('query' === where) {
    // NO PREFIX IN A QUERY STRING. `?token=Bearer%20abc` is not a thing any
    // API reads; the prefix is a header convention and is dropped here
    // deliberately rather than silently concatenated.
    return `    setprop(query, CRED_name, apikey)`
  }

  if ('cookie' === where) {
    // APPEND, never clobber: the request may already carry a session
    // cookie set from options.headers, and a cookie header holds a
    // '; '-joined list of pairs.
    return `    const existing = getprop(headers, 'cookie', '')
    const pair = CRED_name + '=' + apikey
    setprop(headers, 'cookie', existing ? existing + '; ' + pair : pair)`
  }

  return `    // Empty prefix (raw apiKey credential) must not add a leading space.
    setprop(headers, CRED_name,
      options.auth.prefix ? options.auth.prefix + ' ' + apikey : apikey)`
}


function jsstr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}


export {
  PrepareAuth
}


// NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING. That helper is
// also false whenever the SPEC declares no security scheme
// (`main.kit.info.auth: false`) — a statement about the DEFINITION, not a
// ban on ever sending a credential. `optspec` still declares `apikey` and
// makeOptions fills `options.auth` from its defaults, so the runtime
// `options.auth == null` guard never fired and those SDKs have always sent
// the credential. Gating the body on `isAuthActive` does not trim dead
// code, it removes working authentication — which
// `js: auth null suppresses the credential` catches, and which takes the
// secrets feature down with it.
//
// `main.kit.config.auth.active: false` is the project saying "no credential,
// ever", and it is the only signal that can be honoured before runtime.
function isAuthActive_js(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}
