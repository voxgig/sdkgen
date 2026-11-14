// The resolved description of one target's SDK: every fact the documentation
// states, computed once from the model. Plain data, JSON-serialisable, so a
// syntax provider can print from it without reading the model.

import { KIT, getModelPath, nom } from '@voxgig/apidef'

import { canonScalarKey } from './canonType'
import { CANON_OP_ORDER, entityDataIdField, entityIdField, entityOps, opRequestShape } from './opShape'
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

type DescEntity = {
  name: string // model key, e.g. graph_ql
  Name: string // class-name stem, e.g. GraphQl
  ops: string[] // generated, callable, canonical order
  id: string | null // the load-match id key
  dataId: string | null // the id on the returned record
  parents: string[] // required non-id load parameters of a nested entity
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
}

type SdkDescription = {
  target: string
  name: string // model slug
  Name: string // class-name stem
  package: string // published package or module path of this target
  env: { prefix: string }
  auth: { active: boolean, in: string, name: string, basic: boolean, secret: boolean }
  options: DescOption[] // what the quick start's constructor passes, in order
  server: DescServerVar[] // variables the server URL references
  entities: DescEntity[]
  quick: DescQuick | null // null when no entity is active
}


const memo: WeakMap<object, Record<string, SdkDescription>> = new WeakMap()


function sdkDescription(model: any, targetName: string): SdkDescription {
  let byTarget = memo.get(model)
  if (null == byTarget) {
    byTarget = {}
    memo.set(model, byTarget)
  }
  if (null == byTarget[targetName]) {
    byTarget[targetName] = JSON.parse(JSON.stringify(describe(model, targetName)))
  }
  return byTarget[targetName]
}


function describe(model: any, targetName: string): SdkDescription {
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

  return {
    target: targetName,
    name: model.name,
    Name: model.const.Name,
    package: packageName(model, targetName),
    env: { prefix },
    auth: { active, in: where, name: resolveAuthName(model), basic, secret },
    options,
    server,
    entities: activeEntities.map(describeEntity),
    quick: quickChoices(activeEntities),
  }
}


function referenced(model: any, name: string): boolean {
  const url: string = model?.main?.[KIT]?.info?.servers?.[0]?.url || ''
  return url.includes('{' + name + '}')
}


function describeEntity(e: any): DescEntity {
  const id = entityIdField(e)
  return {
    name: e.name,
    Name: nom(e, 'Name'),
    ops: entityOps(e).filter((o) => CANON_OP_ORDER.includes(o)),
    id,
    dataId: entityDataIdField(e),
    parents: isNested(e) ? requiredItems(e, 'load').filter((it: any) => it.name !== id).map((it: any) => it.name) : [],
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
  }
}


export type {
  SdkDescription,
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
