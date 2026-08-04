// OpenAPI server-variable support (templated server URLs).
//
// A spec may declare its server URL as a template over named variables:
//
//   servers:
//     - url: https://{tenant_id}.hanko.io
//       variables:
//         tenant_id: { default: '', description: '...' }
//
// The generated SDKs carry the template verbatim in `options.base` and
// resolve it AT CONSTRUCTION via the `server` options block:
//
//   new SDK({ server: { tenant_id: 'my-tenant' } })
//
// Resolution rules (identical in every target runtime):
//   - each `{name}` in base is replaced with options.server[name],
//     falling back to the spec default emitted into the SDK's Config;
//   - a variable that resolves to '' is an ERROR at construction — the
//     URL cannot work without it — EXCEPT in test mode, where the
//     deterministic value `test-<name>` is substituted so offline tests
//     never require configuration.
//
// This module is the emission-side half: it parses the spec's variables
// out of the model so Config emitters can write the `server` defaults
// block, and docs can name the required variables.

// One declared server variable. `required` is true when the spec gives no
// usable default — the caller MUST supply it for live use.
type ServerVar = {
  name: string
  dflt: string
  required: boolean
  description: string
}


// Match {name} placeholders in a server URL template. OpenAPI variable
// names are restricted to word characters in practice; a brace group that
// is not a well-formed name is left untouched rather than guessed at.
const SERVER_VAR_RE = /\{([A-Za-z0-9_]+)\}/g


// Parse the server variables declared on servers[0] of the model
// (main.<KIT>.info.servers.0). Variables are returned in URL order —
// the order their placeholders appear in the template — with declared
// variables that never appear in the URL appended after (harmless, but
// kept so docs can still describe them). Returns [] when the URL has no
// placeholders.
function serverVariables(model: any): ServerVar[] {
  const info = model?.main?.kit?.info || model?.main?.KIT?.info
  const server = info?.servers?.[0]
  const url: string = server?.url || ''
  const declared = server?.variables || {}

  const out: ServerVar[] = []
  const seen = new Set<string>()

  SERVER_VAR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while (null != (m = SERVER_VAR_RE.exec(url))) {
    const name = m[1]
    if (seen.has(name)) { continue }
    seen.add(name)
    const decl = declared[name] || {}
    const dflt = 'string' === typeof decl.default ? decl.default : ''
    out.push({
      name,
      dflt,
      required: '' === dflt,
      description: 'string' === typeof decl.description ? decl.description : '',
    })
  }

  // Declared-but-unreferenced variables: not substitutable, never required.
  for (const name of Object.keys(declared)) {
    if (seen.has(name)) { continue }
    seen.add(name)
    const decl = declared[name] || {}
    out.push({
      name,
      dflt: 'string' === typeof decl.default ? decl.default : '',
      required: false,
      description: 'string' === typeof decl.description ? decl.description : '',
    })
  }

  return out
}


// Does the model's server URL contain any {name} placeholders at all?
function hasServerVariables(model: any): boolean {
  const info = model?.main?.kit?.info || model?.main?.KIT?.info
  const url: string = info?.servers?.[0]?.url || ''
  SERVER_VAR_RE.lastIndex = 0
  return SERVER_VAR_RE.test(url)
}


export {
  serverVariables,
  hasServerVariables,
}

export type { ServerVar }
