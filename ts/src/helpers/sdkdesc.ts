// The resolved description of one target's SDK: every fact the documentation
// states, computed once from the model. Plain data, JSON-serialisable, so a
// syntax provider can print from it without reading the model.

import { KIT, getModelPath, nom } from '@voxgig/apidef'

import { canonScalarKey } from './canonType'
import {
  CANON_OP_ORDER, entityActions, entityClassName, entityCollection, entityDataIdField, entityIdField, entityOps,
  opNeedsAction, opRequestShape,
} from './opShape'
import { bodyFacts } from './media'
import type { BodyFacts } from './media'
import { modelText } from './text'
import { targetFeatures } from './applicability'
import { featureDocs } from '../cmp/FeatureDocs'
import { matchExampleItems, requestExampleItems, requiredItems, sendsId } from './opExample'
import { envName, packageName } from './packageMeta'
import { serverVariables } from './serverVars'
import {
  isAuthActive, isAuthSuppressed, isHttpBasicAuth, resolveAuthIn, resolveAuthName,
} from '../utility'


// The canonical scalar a literal is written as: STRING, NUMBER, INTEGER,
// BOOLEAN, ARRAY, OBJECT, NULL, or another canon key printed as a string.
type Scalar = string

type DescServerVar = {
  name: string
  required: boolean // the URL references it and it has no default
  dflt: string
}

type DescOption =
  | { name: 'apikey', env: string }
  | { name: 'secret', env: string }
  | { name: 'server', vars: { name: string, placeholder: string }[] }

// One member of an example request: a typed placeholder, or the id read off
// the record the example created.
type DescArg =
  | { name: string, type: Scalar, placeholder: string }
  | { name: string, fromCreated: string }

// The names the generated code gives the SDK as a whole, decided by the
// target's own naming functions (its Naming hook).
type DescLayout = {
  module: string // what an example imports the SDK by: a package, module path, header or namespace
  client: string // the client type
  ctor: string // the function or constructor an example creates a client with
}

// The names the generated code gives one entity, from the same hook.
type DescSymbols = {
  accessor: string // the client member, or function, that yields the entity
  var: string // a variable holding one entity
  vars: string // a variable holding a list of them
  module?: string // what an example must import to call its operations
  alias?: string // the name that import is bound to
  fields?: Record<string, string> // field -> the identifier a variable named after it takes
}

// A target's naming hook: the code generator's own naming functions, which may
// read the model. Exported as `Naming` by cmp/<target>/Naming_<target>.
type Naming = (model: any, target: any) => {
  layout: DescLayout
  symbols: (entity: any) => DescSymbols
}

// One field of an entity's record. `type` is the canonical sentinel, which a
// provider names in its own language; `text` is the spec's description, raw.
type DescField = {
  name: string
  type: any
  required: boolean
  text: string
  ops: string[] // the generated operations whose request or response carries it
}

// One generated operation, as the reference page shows it.
type DescOp = {
  name: string // canonical: list, load, create, update, patch, remove
  action: boolean // reachable only through `$action`, so no example call
  args: DescArg[] // what its example passes, id first; [] for none
  needs: string[] // list: the match members it requires (a nested entity's parent)
  idInData: string | null // update, patch: the id key the data must carry
  body: BodyFacts | null // a request body that is not JSON
}

type DescEntity = {
  name: string // model key, e.g. graph_ql
  Name: string // class-name stem, e.g. GraphQl
  className: string // the entity class, collision-free (entityClassName)
  sym: DescSymbols
  text: string // the description: the project's entity_desc, else the spec's
  ops: string[] // generated, callable, canonical order
  id: string | null // the load-match id key
  dataId: string | null // the id on the returned record
  parents: string[] // required non-id load parameters of a nested entity
  fields: DescField[]
  fieldOps: boolean // the model says which operations each field takes part in
  refOps: DescOp[] // every active operation's method, canonical order, as the reference shows it
  actions: { action: string, op: string, path: string }[] // custom `$action` routes
}

// A client option the constructor accepts, in table order.
type DescOptionRow = {
  path: string[] // the key, and for a server variable the key under `server`
  type: 'STRING' | 'OBJECT' | 'ANY'
  text: string
}

type DescFeature = {
  name: string
  title: string
  version: string
}

type DescRef = {
  title: string // the language's title, as the target names it
  test: boolean // the test feature ships, so the test constructor exists
  optionRows: DescOptionRow[]
  features: DescFeature[] // the features this target has, sorted
}

type DescQuick = {
  entity: string // the example entity (first active)
  list: DescArg[] | null // null: no list step
  load: { entity: string, args: DescArg[], nested: null | { parent: string, param: string } } | null
  create: DescArg[] | null
  update: DescArg[] | null
  patch: DescArg[] | null
  remove: DescArg[] | null
  chainsId: boolean // update/patch/remove take the id off the created record
  show: string[] // the fields a runtime that prints chosen fields prints: the record id, then one display field
}

type SdkDescription = {
  target: string
  name: string // model slug
  Name: string // class-name stem
  package: string // published package or module path of this target
  layout: DescLayout
  env: { prefix: string }
  auth: { active: boolean, in: string, name: string, basic: boolean, secret: boolean }
  options: DescOption[] // what the quick start's constructor passes, in order
  server: DescServerVar[] // variables the server URL references
  entities: DescEntity[]
  quick: DescQuick | null // null when no entity is active
  ref: DescRef
}


const memo: WeakMap<object, Record<string, SdkDescription>> = new WeakMap()


// `naming` is the target's Naming hook, which the calling component finds.
function sdkDescription(model: any, target: any, naming?: Naming): SdkDescription {
  const targetName = target.name
  let byTarget = memo.get(model)
  if (null == byTarget) {
    byTarget = {}
    memo.set(model, byTarget)
  }
  if (null == byTarget[targetName]) {
    byTarget[targetName] = JSON.parse(JSON.stringify(describe(model, target, naming || genericNaming)))
  }
  return byTarget[targetName]
}


// For a target with no naming hook: the class-name stem, unchanged.
const genericNaming: Naming = (model: any) => ({
  layout: { module: model.name, client: model.const.Name + 'SDK', ctor: model.const.Name + 'SDK' },
  symbols: (e: any) => ({ accessor: nom(e, 'Name'), var: e.name, vars: e.name + 's' }),
})


function describe(model: any, target: any, naming: Naming): SdkDescription {
  const targetName = target.name
  const names = naming(model, target)
  const prefix = envName(model)
  const active = isAuthActive(model)
  const where = resolveAuthIn(model)
  const basic = isHttpBasicAuth(model)
  // The runtimes read `secret` only for Basic sent in the header (PrepareAuth).
  const secret = active && basic && 'header' === where && !isAuthSuppressed(model)

  const server: DescServerVar[] = serverVariables(model)
    .filter((v: any) => referenced(model, v.name))
    .map((v: any) => ({ name: v.name, required: v.required, dflt: v.dflt }))

  const options: DescOption[] = []
  if (active) options.push({ name: 'apikey', env: prefix + '_APIKEY' })
  if (secret) options.push({ name: 'secret', env: prefix + '_SECRET' })
  const required = server.filter((v) => v.required)
  if (0 < required.length) {
    options.push({ name: 'server', vars: required.map((v) => ({ name: v.name, placeholder: '<' + v.name + '>' })) })
  }

  const entityMap = getModelPath(model, `main.${KIT}.entity`) || {}
  const activeEntities = (Object.values(entityMap) as any[]).filter((e: any) => e.active !== false)
  const coll = entityCollection(model)
  const descs = modelText(model).entity_desc || {}

  return {
    target: targetName,
    name: model.name,
    Name: model.const.Name,
    package: packageName(model, targetName),
    layout: names.layout,
    env: { prefix },
    auth: { active, in: where, name: resolveAuthName(model), basic, secret },
    options,
    server,
    entities: activeEntities.map((e: any) => describeEntity(e, names.symbols(e), {
      className: entityClassName(e, coll),
      text: [descs[e.name], e.short, e.desc].find((t: any) => 'string' === typeof t && '' !== t.trim()) || '',
    })),
    quick: quickChoices(activeEntities),
    ref: describeRef(model, target, active, secret, server),
  }
}


// The constructor's option rows. Each must be a key of main.kit.optspec, the
// schema make_options validates against; `feature` is assembled per target.
const OPTION_TEXT: [string, string][] = [
  ['apikey', 'API key for authentication.'],
  ['secret', 'API secret for authentication.'],
  ['base', 'Base URL for API requests.'],
  ['prefix', 'URL prefix appended after base.'],
  ['suffix', 'URL suffix appended after path.'],
  ['headers', 'Custom headers for all requests.'],
  ['feature', 'Feature configuration.'],
  ['system', 'System overrides (e.g. custom fetch).'],
]

function describeRef(model: any, target: any, active: boolean, secret: boolean, server: DescServerVar[]): DescRef {
  const spec = getModelPath(model, `main.${KIT}.optspec`, { required: false, only_active: false }) || {}
  const kind = (v: any): DescOptionRow['type'] =>
    null != v && 'object' === typeof v ? 'OBJECT' : ('string' === typeof v && !v.includes('$ANY') ? 'STRING' : 'ANY')
  const rows: DescOptionRow[] = []
  for (const [key, text] of OPTION_TEXT) {
    if ('apikey' === key && !active) continue
    if ('secret' === key && !secret) continue
    if ('feature' !== key && !(key in spec)) continue
    rows.push({ path: [key], type: 'feature' === key ? 'OBJECT' : kind(spec[key]), text })
  }
  if (0 < server.length && 'server' in spec) {
    rows.push({ path: ['server'], type: 'OBJECT', text: 'Values for the variables the server URL is templated on.' })
    for (const v of server) {
      rows.push({
        path: ['server', v.name], type: 'STRING',
        text: v.required ? 'Required.' : 'Defaults to `' + v.dflt + '`.',
      })
    }
  }
  const feats = targetFeatures(model, target)
  return {
    title: target.title || target.name,
    test: null != feats.test && false !== feats.test.active,
    optionRows: rows,
    features: featureDocs(model, target).map((f: any) => ({
      name: f.name, title: f.title, version: String((feats[f.name] || {}).version || ''),
    })),
  }
}


function referenced(model: any, name: string): boolean {
  const url: string = model?.main?.[KIT]?.info?.servers?.[0]?.url || ''
  return url.includes('{' + name + '}')
}


function describeEntity(e: any, sym: DescSymbols, named: { className: string, text: string }): DescEntity {
  const id = entityIdField(e)
  const ops = entityOps(e).filter((o) => CANON_OP_ORDER.includes(o))
  // An op reached only through `$action` still has its method: the reference
  // shows its signature, and its routes under Actions.
  const methods = CANON_OP_ORDER.filter((o) => null != e.op?.[o] && false !== e.op[o].active)
  const fields: any[] = Object.values(e.fields || {}).filter((f: any) => null != f && null != f.n)
  return {
    name: e.name,
    Name: nom(e, 'Name'),
    className: named.className,
    sym,
    text: named.text,
    ops,
    id,
    dataId: entityDataIdField(e),
    parents: isNested(e) ? requiredItems(e, 'load').filter((it: any) => it.name !== id).map((it: any) => it.name) : [],
    fields: fields.map((f: any) => ({
      name: f.n,
      type: f.t,
      required: !!f.r,
      text: 'string' === typeof f.sh ? f.sh : '',
      ops: methods.filter((o) => null != f.op?.[o] && false !== f.op[o].active),
    })),
    fieldOps: fields.some((f: any) => null != f.op && 0 < Object.keys(f.op).length),
    refOps: methods.map((o) => describeOp(e, o, id)),
    actions: entityActions(e).filter((a) => methods.includes(a.op)),
  }
}


// The reference's example members for one operation: what a call must give,
// each a typed placeholder (the id as `<entity>_id`, a create's data as
// `example_<field>`).
function describeOp(e: any, op: string, idF: string | null): DescOp {
  const idFirst = (a: any, b: any) => (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1)
  const ph = (it: any, other: string) => typed(it, it.name === idF ? e.name + '_id' : other)
  let args: DescArg[] = []
  if ('load' === op || 'remove' === op) {
    args = matchExampleItems(e, op, idF).sort(idFirst).map((it: any) => ph(it, it.name))
  }
  else if ('list' === op) {
    args = requiredItems(e, 'list').map((it: any) => typed(it, 'example'))
  }
  else if ('create' === op) {
    args = requestExampleItems(e, 'create').filter((it: any) => !it.optional)
      .map((it: any) => typed(it, 'example_' + it.name))
  }
  else {
    args = requestExampleItems(e, op).filter((it: any) => !it.optional || it.name === idF)
      .sort(idFirst).map((it: any) => ph(it, it.name))
  }
  return {
    name: op,
    action: opNeedsAction(e.op[op]),
    args,
    needs: 'list' === op ? requiredItems(e, 'list').map((it: any) => it.name) : [],
    idInData: ('update' === op || 'patch' === op) && sendsId(e, op, idF) ? idF : null,
    body: 'create' === op || 'update' === op || 'patch' === op ? bodyFacts(e.op[op]) : null,
  }
}


function isNested(e: any): boolean {
  return null != e.relations && null != e.relations.ancestors && 0 < e.relations.ancestors.length &&
    entityOps(e).includes('load') &&
    opRequestShape(e, 'load').items.some((it: any) => !it.optional && it.name !== entityIdField(e))
}


const typed = (it: any, placeholder: string): DescArg =>
  ({ name: it.name, type: canonScalarKey(it.type), placeholder })

const idFirst = (idF: string | null) => (a: any, b: any) =>
  (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1)


// The choices every quick start made, each made here once.
function quickChoices(activeEntities: any[]): DescQuick | null {
  const ex = activeEntities[0]
  if (null == ex) return null

  const ops = entityOps(ex)
  const idF = entityIdField(ex)
  const dataIdF = entityDataIdField(ex)
  const nested = activeEntities.find(isNested)

  let load: DescQuick['load'] = null
  if (nested) {
    const neIdF = entityIdField(nested)
    const items = requiredItems(nested, 'load')
      .sort((a: any, b: any) => (a.name === neIdF ? 1 : 0) - (b.name === neIdF ? 1 : 0))
    const param = items.find((it: any) => it.name !== neIdF).name
    load = {
      entity: nested.name,
      args: items.map((it: any) => typed(it, it.name === neIdF ? 'example_id' : 'example_' + it.name)),
      nested: { param, parent: param.replace(/_id$/, '') },
    }
  }
  else if (ops.includes('load')) {
    load = {
      entity: ex.name,
      args: matchExampleItems(ex, 'load', idF).sort(idFirst(idF))
        .map((it: any) => typed(it, it.name === idF ? 'example_id' : 'example_' + it.name)),
      nested: null,
    }
  }

  // Chain on the created id only where its type is KNOWN to match the match
  // key's, so the literal example type-checks by construction.
  const fields: any[] = Object.values(ex.fields || {})
  const dataIdField = dataIdF ? fields.find((f: any) => f && f.n === dataIdF) : null
  const dataIdType = dataIdField ? (dataIdField.t ?? dataIdField.type) : null
  const chains = (opname: string): boolean => {
    if (null == dataIdF || !ops.includes('create')) return false
    const item = opRequestShape(ex, opname).items.find((it: any) => it.name === idF)
    const matchType = item ? item.type : null
    return null != matchType && null != dataIdType && matchType === dataIdType
  }
  const idArg = (opname: string): DescArg => chains(opname)
    ? { name: idF as string, fromCreated: dataIdF as string }
    : typed(opRequestShape(ex, opname).items.find((it: any) => it.name === idF) || { name: idF }, 'example_id')

  const bodyFields = (opname: string): DescArg[] => {
    const items = requestExampleItems(ex, opname)
      .filter((it: any) => (it.name !== idF && it.name !== 'id') || ('create' === opname && !it.optional))
    const req = items.filter((it: any) => !it.optional)
    const opt = items.filter((it: any) => it.optional)
    const chosen = 'create' === opname
      ? (req.length ? req : items.slice(0, 2))
      : req.concat(opt).slice(0, Math.max(2, req.length))
    return chosen.map((it: any) => typed(it, 'example_' + it.name))
  }

  const write = (opname: string): DescArg[] | null => !ops.includes(opname) ? null :
    (sendsId(ex, opname, idF) ? [idArg(opname)] : []).concat(bodyFields(opname))

  return {
    entity: ex.name,
    list: ops.includes('list') ? requiredItems(ex, 'list').map((it: any) => typed(it, 'example')) : null,
    load,
    create: ops.includes('create') ? bodyFields('create') : null,
    update: write('update'),
    patch: write('patch'),
    remove: !ops.includes('remove') ? null : matchExampleItems(ex, 'remove', idF).sort(idFirst(idF))
      .map((it: any) => it.name === idF ? idArg('remove') : typed(it, 'example_' + it.name)),
    chainsId: ['update', 'patch', 'remove'].some((o) => ops.includes(o) && sendsId(ex, o, idF) && chains(o)),
    show: showFields(fields, dataIdF),
  }
}


// The record id, then the first other string field: what php, rb, lua and perl
// chose for themselves, chosen here once.
function showFields(fields: any[], dataIdF: string | null): string[] {
  const display = fields.find((f: any) => f && f.n !== 'id' && f.n !== dataIdF && '$STRING' === f.t)
  return [dataIdF, display ? display.n : null].filter((f): f is string => null != f)
}


export type {
  DescField,
  DescFeature,
  DescOp,
  DescOptionRow,
  DescRef,
  Naming,
  SdkDescription,
  DescLayout,
  DescSymbols,
  DescArg,
  DescEntity,
  DescOption,
  DescQuick,
  DescServerVar,
  Scalar,
}

export {
  sdkDescription,
}
