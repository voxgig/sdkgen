
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


function serverVarEnv(projenvname: string, name: string): string {
  return projenvname + '_SERVER_' + String(name).toUpperCase()
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
  serverVarEnv,
}

export type { ServerVar }
