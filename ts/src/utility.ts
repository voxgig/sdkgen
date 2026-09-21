
import Path from 'node:path'

import { JostracaResult, each } from 'jostraca'

import { KIT, getModelPath } from '@voxgig/apidef'

import { targetFeatures } from './helpers/applicability'

import { serverVariables } from './helpers/serverVars'
import { pointParts } from './helpers/pointPath'
import { packageVersion } from './helpers/packageMeta'


function resolvePath(ctx$: any, path: string): any {
  const base = null == ctx$.cmpfolder ? ctx$.folder : ctx$.cmpfolder
  const fullpath = Path.join(base, '.sdk', 'dist', path)
  return fullpath
}


function isAuthActive(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  if (null != auth && 'boolean' === typeof auth.active) return auth.active

  const info = getModelPath(model, `main.${KIT}.info`,
    { only_active: false, required: false })
  return !(info && false === info.auth)
}


function resolveAuthPrefix(model: any): string {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  if (null != auth && null != auth.prefix) return String(auth.prefix)

  const security = getModelPath(model, `main.${KIT}.info.security`,
    { only_active: false, required: false })
  if (null != security && null != security.prefix) return String(security.prefix)

  return 'Bearer'
}


function isAuthSuppressed(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return null != auth && false === auth.active
}


function resolveAuthIn(model: any): string {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  if (null != auth && null != auth.in && '' !== auth.in) {
    return String(auth.in).toLowerCase()
  }

  const security = getModelPath(model, `main.${KIT}.info.security`,
    { only_active: false, required: false })
  if (null != security && null != security.in && '' !== security.in) {
    return String(security.in).toLowerCase()
  }

  return 'header'
}


function resolveAuthName(model: any): string {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  if (null != auth && null != auth.name && '' !== auth.name) {
    return String(auth.name)
  }

  const security = getModelPath(model, `main.${KIT}.info.security`,
    { only_active: false, required: false })
  if (null != security && null != security.name && '' !== security.name) {
    return String(security.name)
  }

  return 'Authorization'
}


function isHttpBasicAuth(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  if (null != auth && null != auth.basic) return Boolean(auth.basic)

  const security = getModelPath(model, `main.${KIT}.info.security`,
    { only_active: false, required: false })
  return null != security && 'http' === security.type &&
    'basic' === String(security.prefix || '').toLowerCase()
}


function resolveAuthExchange(model: any): Record<string, any> | null {
  const security = getModelPath(model, `main.${KIT}.info.security`,
    { only_active: false, required: false })

  const exchange = security?.exchange
  if (null == exchange || 'object' !== typeof exchange) {
    return null
  }

  return exchange
}


function requirePath(ctx$: any, path: string, flags?: { ignore?: boolean }): any {
  const fullpath = resolvePath(ctx$, path)
  const ignore = null == flags?.ignore ? false : flags.ignore

  // When `ignore` is set, only swallow a genuine "module not found"
  // resolution failure. A module that resolves but throws while loading
  // (syntax error, runtime bug, or a missing *nested* dependency) must
  // propagate — otherwise the optional component silently renders nothing
  // and the real failure is invisible.
  if (ignore) {
    try {
      require.resolve(fullpath)
    }
    catch (err: any) {
      ctx$.log.warn({ point: 'require-missing', path, note: path })
      return undefined
    }
  }

  return require(fullpath)
}


class SdkGenError extends Error {
  constructor(...args: any[]) {
    super(...args)
    this.name = 'SdkGenError'
  }
}


export {
  resolvePath,
  requirePath,
  isAuthActive,
  resolveAuthPrefix,
  resolveAuthIn,
  resolveAuthName,
  isAuthSuppressed,
  resolveAuthExchange,
  isHttpBasicAuth,
  SdkGenError,
  CONFIG_DATA_THRESHOLD,
  CONFIG_REPR_VALUES,
  isConfigData,
  configRepr,
  configReprSetting,
  configDefinition,
  clean,
  rawStringLiteral,
}


const CONFIG_DATA_THRESHOLD = 256 * 1024


const CONFIG_REPR_VALUES = ['auto', 'data', 'literal']

function isConfigData(configJson: string, repr?: string): boolean {
  // An unknown value is REJECTED, not ignored. The aontu declaration
  // documents the closed set but does not enforce it here, and silently
  // treating `repr: 'date'` as `auto` would quietly restore the compile cost
  // this exists to remove - the failure mode being a slow build nobody
  // connects to a typo.
  if (null != repr && '' !== repr && !CONFIG_REPR_VALUES.includes(repr)) {
    throw new SdkGenError(
      'sdkgen: main.kit.config.repr must be one of ' +
      CONFIG_REPR_VALUES.join(', ') + ' (got: ' + repr + ')', {})
  }
  if ('data' === repr) {
    return true
  }
  if ('literal' === repr) {
    return false
  }
  return CONFIG_DATA_THRESHOLD < Buffer.byteLength(configJson, 'utf8')
}


// The chosen representation, as a word - for generation logs and for the
// per-SDK reporting the fleet regen needs, so a model crossing the threshold
// is visible rather than showing up as an unexplained whole-file diff.
function configRepr(configJson: string, repr?: string): string {
  return isConfigData(configJson, repr) ? 'data' : 'literal'
}


// The per-SDK override, or 'auto'. `main.kit.config.repr` is optional, and
// getModelPath throws rather than returning undefined for an absent path.
function configReprSetting(model: any): string {
  try {
    return getModelPath(model, `main.${KIT}.config.repr`) || 'auto'
  }
  catch (_e) {
    return 'auto'
  }
}


const MODEL_META = ['index$', 'key$', 'val$']

const CONFIG_DEFAULT: Record<string, any> = {
  active: true,
  req: false,
  reqd: false,
}

const PAYLOAD_KEYS = ['default', 'example', 'examples']

function clean(o: any, dropDefaults?: boolean): any {
  // Rebuild rather than delete in place: the caller's model is shared with
  // every other component, and mutating it here would strip metadata a later
  // target still needs.
  const prune = (node: any, defaults: boolean): any => {
    if (Array.isArray(node)) return node.map((n: any) => prune(n, defaults))
    if (null != node && 'object' === typeof node) {
      const out: any = {}
      for (const k of Object.keys(node)) {
        if (MODEL_META.includes(k)) continue
        if (undefined === node[k]) continue
        if (defaults && k in CONFIG_DEFAULT && CONFIG_DEFAULT[k] === node[k]) continue
        out[k] = prune(node[k], defaults && !PAYLOAD_KEYS.includes(k))
      }
      return out
    }
    return node
  }
  return prune(o, true === dropDefaults)
}


function rawStringLiteral(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}


// The closed vocabulary of spec-derived facts a feature may ask for by
// declaring `spec: { <fact>: <options-key> }`. Closed, and resolved through
// one function each, so a feature cannot reach arbitrarily into the model
// and a fact's shape is defined in exactly one place.
const SPEC_FACTS: Record<string, (model: any) => any> = {
  authexchange: resolveAuthExchange,
}


function withPointParts(op: any): any {
  if (null == op) {
    return op
  }

  const out: any = {}
  each(op, (o: any, opname: string) => {
    out[opname] = null == o || null == o.points ? o : {
      ...o,
      points: each(o.points).filter((pt: any) => false !== pt?.a).map((pt: any) => {
        if (null == pt) return pt
        const args = Object.fromEntries(Object.entries(pt.g || {}).map(([kind, values]) =>
          [kind, each(values as any).filter((arg: any) => false !== arg.a).map((arg: any) => ({
            name: arg.n, orig: arg.or, type: arg.t, kind: arg.k,
            reqd: arg.r, example: arg.ex,
          }))]))
        // Runtime hooks expose descriptive names independently of the model schema.
        return {
          active: pt.a, kind: pt.k, method: pt.m, orig: pt.o,
          segments: pt.s, parts: pointParts(pt), rename: pt.r,
          transform: pt.t, args, select: pt.q, live: pt.li, graphql: pt.gq,
        }
      }),
    }
  })

  return out
}


function configDefinition(model: any, targetname?: string): { def: any, json: string } {
  const entity = getModelPath(model, `main.${KIT}.entity`)

  const feature = targetFeatures(model, targetname)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  const authPrefix = resolveAuthPrefix(model)
  const authBasic = isHttpBasicAuth(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  const svars = serverVariables(model)

  const entityDefs: any = {}
  const entityStubs: any = {}
  each(entity, (e: any) => {
    entityDefs[e.name] = clean({
      fields: each(e.fields || {}).filter((f: any) => false !== f.a).map((f: any) => ({
        name: f.n, title: f.h, type: f.t, req: f.r, op: f.op,
        short: f.sh, readOnly: f.ro, writeOnly: f.wo, deprecated: f.de, format: f.fo,
      })),
      id: e.id,
      name: e.name,
      op: withPointParts(e.op),
      relations: e.relations,
    }, true)
    entityStubs[e.name] = {}
  })

  const featureDefs: any = {}
  each(feature, (f: any) => {
    const fdef: any = { ...(f.config || {}) }
    if (null != f.transport && '' !== f.transport) {
      fdef.transport = String(f.transport)
    }

    for (const factname of Object.keys(f.spec || {}).sort()) {
      const optkey = f.spec[factname]
      const fact = SPEC_FACTS[factname]?.(model)
      if (null == fact || null == optkey || '' === optkey) {
        continue
      }
      fdef.options = { ...(fdef.options || {}) }
      fdef.options[optkey] = { ...(fdef.options[optkey] || {}), ...fact }
    }

    featureDefs[f.name] = fdef
  })

  const options: any = { base: baseUrl }
  if (0 < svars.length) {
    options.server = svars.reduce((a: any, v: any) => (a[v.name] = v.dflt, a), {})
  }
  if (authActive) {
    options.auth = authBasic ? { prefix: authPrefix, basic: true } : { prefix: authPrefix }
  }
  options.headers = headers
  options.entity = entityStubs

  const main: any = { name: model.const.Name }
  if (null != targetname) {
    main.slug = model.name
    main.version = packageVersion(model, targetname)
    main.target = targetname
  }

  const def = {
    main,
    feature: featureDefs,
    options,
    entity: entityDefs,
  }

  return { def, json: JSON.stringify(def) }
}
