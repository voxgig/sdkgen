
import { each, names } from 'jostraca'
import { KIT, getModelPath } from '@voxgig/apidef'

import { pointSegments, pointTerminalParam, pointPathKey } from './pointPath'


const _entityCollCache = new WeakMap<object, any>()

function entityCollection(model: any): any {
  if (null == model || 'object' !== typeof model) {
    return {}
  }
  const cached = _entityCollCache.get(model)
  if (null != cached) {
    return cached
  }
  const coll = getModelPath(model, `main.${KIT}.entity`,
    { only_active: false, required: false }) || {}
  deriveEntityNames(coll)
  _entityCollCache.set(model, coll)
  return coll
}


function deriveEntityNames(entityColl: any): any[] {
  const ents = each(entityColl).filter((e: any) => e && null != e.name)
  ents.forEach((e: any) => { if (null == e.Name) names(e, e.name) })
  return ents
}


// The five ops, and whether their request payload is a `Match` (query/id) or
// `Data` (body) — this fixes the generated type-name suffix per op.
const OP_SUFFIX: Record<string, 'Match' | 'Data'> = {
  load: 'Match',
  list: 'Match',
  remove: 'Match',
  create: 'Data',
  update: 'Data',
}


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


function opTypeName(Name: string, opname: string): string {
  return Name + cap(opname) + (OP_SUFFIX[opname] || 'Match')
}


type OpShapeItem = {
  name: string
  type: any     // canonical type sentinel (e.g. `$STRING`); render via canonToType
  optional: boolean
}


function opActions(op: any): { action: string, path: string }[] {
  const points: any[] = op && op.points ? each(op.points) : []

  return points
    .filter((pt: any) => null != (pt && pt.select && pt.select['$action']))
    .map((pt: any) => ({
      action: String(pt.select['$action']),
      path: String(pt.orig || ''),
    }))
    .sort((a, b) => a.action < b.action ? -1 : a.action > b.action ? 1 : 0)
}


function entityActions(entity: any): { op: string, action: string, path: string }[] {
  const out: { op: string, action: string, path: string }[] = []

  each(entity && entity.op).forEach((op: any) => {
    opActions(op).forEach((a) => out.push({ op: op.name, ...a }))
  })

  return out
}


function entityPath(entity: any): string {
  const ops: any = (entity && entity.op) || {}

  for (const opname of ['list', 'load', 'create', 'update', 'remove']) {
    const op = ops[opname]
    if (null == op) {
      continue
    }

    const points: any[] = op.points ? each(op.points) : []
    const canonical = points.filter((pt: any) =>
      null == (pt && pt.select && pt.select['$action']))

    const pick = (0 < canonical.length ? canonical : points)[0]
    if (null != pick && null != pick.orig && '' !== pick.orig) {
      return String(pick.orig)
    }
  }

  return ''
}


function ownPoint(points: any[]): any {
  let best = points[0]

  for (const pt of points) {
    if (null == pt || null == pt.segments || null == best || null == best.segments) {
      continue
    }

    const ptterm = pointTerminalParam(pt)
    const bestterm = pointTerminalParam(best)

    if (ptterm !== bestterm ?
      ptterm : pointSegments(pt).length < pointSegments(best).length) {
      best = pt
    }
  }

  return best
}


// Do all these points describe the same route? Then they are alternative
// selectors on one endpoint (the same path, chosen by different query
// params), not cross-references to different resources.
function samePath(points: any[]): boolean {
  const first = pointPathKey(points[0])

  return points.every((pt: any) => first === pointPathKey(pt))
}


function opParams(op: any): any[] {
  let points: any[] = op && op.points ? each(op.points) : []

  const canonical = points.filter((pt: any) =>
    null == (pt && pt.select && pt.select['$action']))
  if (0 < canonical.length) {
    points = canonical
  }

  const seen: Record<string, any> = {}
  const requiredOnAll: Record<string, boolean> = {}
  const out: any[] = []

  points.forEach((pt: any, pointIndex: number) => {
    // Path AND query: a path-param-only read misses e.g. GET /result?trace_id=,
    // which has no path param at all but still addresses one record.
    const pathParams = pt && pt.args && pt.args.params ? each(pt.args.params) : []
    const queryParams = pt && pt.args && pt.args.query ? each(pt.args.query) : []
    const params = [...pathParams, ...queryParams]
    const requiredHere: Record<string, boolean> = {}
    params.forEach((p: any) => {
      if (p && null != p.name) {
        requiredHere[p.name] = false !== p.reqd
        if (!seen[p.name]) {
          seen[p.name] = { ...p }
          requiredOnAll[p.name] = 0 === pointIndex
          out.push(seen[p.name])
        }
      }
    })
    Object.keys(requiredOnAll).forEach((name) => {
      if (true !== requiredHere[name]) {
        requiredOnAll[name] = false
      }
    })
  })

  out.forEach((p: any) => {
    p.reqd = true === requiredOnAll[p.name]
  })

  if (1 < points.length && !out.some((p: any) => p.reqd) && !samePath(points)) {
    return opParams({ points: [ownPoint(points)] })
  }

  return out
}


function fieldInOp(field: any, opname: string): boolean {
  const fop = field && field.op && field.op[opname]
  return null == fop || fop.active !== false
}


function fieldOptional(field: any, opname: string): boolean {
  switch (opname) {
    case 'create':
      return false === field.req
    case 'update':
      return true
    case 'load':
    case 'remove':
      return 'id' !== field.name
    case 'list':
    default:
      return true
  }
}


// The ordered request-payload members for an entity op, with each member's
// required/optional decision baked in. `fromParams` records whether the op's
// declared params were used (true) or the entity-field fallback (false).
function opRequestShape(ent: any, opname: string):
  { items: OpShapeItem[], fromParams: boolean } {

  const op = ent && ent.op ? ent.op[opname] : null
  if (null == op) {
    return { items: [], fromParams: false }
  }

  const isbodyop = 'create' === opname || 'update' === opname || 'patch' === opname

  const params = opParams(op)
  if (0 < params.length && !isbodyop) {
    const items = params.map((p: any) => ({
      name: p.name,
      type: p.type,
      optional: false === p.reqd,
    }))
    return { items, fromParams: true }
  }

  const paramItems = isbodyop ? params.map((p: any) => ({
    name: p.name,
    type: p.type,
    optional: false === p.reqd,
  })) : []
  const paramNames = new Set(paramItems.map((p: any) => p.name))

  const fields = (ent.fields ? each(ent.fields) : [])
    .filter((f: any) => f.active !== false)
    .filter((f: any) => fieldInOp(f, opname))

  const items = paramItems.concat(
    fields
      .filter((f: any) => !paramNames.has(f.name))
      .map((f: any) => ({
        name: f.name,
        type: f.type,
        optional: fieldOptional(f, opname),
      })))

  return { items, fromParams: false }
}


function entityIdField(ent: any): string | null {
  if (null == ent) {
    return null
  }
  const idName = (ent.id && ent.id.field) || 'id'
  const loadItems = opRequestShape(ent, 'load').items
  if (loadItems.some((it: OpShapeItem) => it.name === idName)) {
    return idName
  }
  if (loadItems.some((it: OpShapeItem) => it.name === 'id')) {
    return 'id'
  }
  // NO fallback to entity.fields: this is the load-MATCH key. An entity whose
  // DATA type has an `id` field but whose load match does NOT (a query-param
  // load, e.g. playstation-store's StoreLoadMatch { age, country, ... }) must
  // degrade to a no-arg load(); `.id` access is decided by entityDataIdField.
  return null
}


// The entity's ACTIVE op names, in canonical CRUD order (list, load, create,
// update, remove), with any non-canonical ops appended in sorted order. Doc
// generators must gate an op example on this (an op present in the model but
// `active: false` generates no method, so an example calling it would not
// compile) — NOT on the raw `Object.keys(ent.op)`, which includes inactive ops.
const CANON_OP_ORDER = ['list', 'load', 'create', 'update', 'remove']

function entityOps(ent: any): string[] {
  const ops = (ent && ent.op) || {}
  const active = Object.keys(ops).filter((o: string) => ops[o] && ops[o].active !== false)
  return CANON_OP_ORDER.filter((o) => active.includes(o))
    .concat(active.filter((o) => !CANON_OP_ORDER.includes(o)).sort())
}


// The entity's primary/representative op for a single illustrative call —
// prefer a read op (list, then load) so the snippet needs no fabricated match,
// then fall back to create/update/remove. null when the entity exposes no op.
// Doc generators MUST pick their "primary" op through this rather than
// hardcoding `load`: a create-only entity has no `load` method.
function entityPrimaryOp(ent: any): string | null {
  const ops = entityOps(ent)
  for (const o of CANON_OP_ORDER) {
    if (ops.includes(o)) {
      return o
    }
  }
  return ops[0] || null
}


const _classNameCache = new WeakMap<object, Record<string, string>>()

function entityClassNames(entityColl: any): Record<string, string> {
  const cached = _classNameCache.get(entityColl)
  if (null != cached) {
    return cached
  }

  const ents = deriveEntityNames(entityColl)

  const taken: Record<string, boolean> = {}
  ents.forEach((e: any) => {
    taken[e.Name] = true
    for (const op of ['load', 'list', 'create', 'update', 'remove']) {
      if (e.op && e.op[op]) {
        taken[opTypeName(e.Name, op)] = true
      }
    }
  })

  // 2. Assign each class name, avoiding all data types and prior classes.
  const out: Record<string, string> = {}
  ents.forEach((e: any) => {
    let name = e.Name + 'Entity'
    if (taken[name]) {
      const base = name + 'Client'
      name = base
      let n = 1
      while (taken[name]) {
        n++
        name = base + n
      }
    }
    taken[name] = true
    out[e.name] = name
  })

  _classNameCache.set(entityColl, out)
  return out
}


// The collision-free class name for one entity (see entityClassNames).
// `entityColl` is main.<KIT>.entity (the collection the entity belongs to).
function entityClassName(ent: any, entityColl: any): string {
  if (null == ent) {
    return ''
  }
  const map = entityClassNames(entityColl)
  return map[ent.name] || (ent.Name + 'Entity')
}


const _typeCollisionCache = new WeakMap<object, string[]>()

function entityTypeCollisions(entityColl: any): string[] {
  const cached = _typeCollisionCache.get(entityColl)
  if (null != cached) {
    return cached
  }

  const counts: Record<string, number> = {}
  const bump = (n: string) => { counts[n] = (counts[n] || 0) + 1 }

  deriveEntityNames(entityColl)
    .forEach((e: any) => {
      bump(e.Name)
      for (const op of ['load', 'list', 'create', 'update', 'remove']) {
        if (e.op && e.op[op]) {
          bump(opTypeName(e.Name, op))
        }
      }
    })

  const out = Object.keys(counts).filter((n) => 1 < counts[n]).sort()
  _typeCollisionCache.set(entityColl, out)
  return out
}


// Emitter convenience: warn (once per collection per target run) when the
// generated typed model would contain duplicate top-level type names.
function warnEntityTypeCollisions(entityColl: any, log: any, lang: string): string[] {
  const dups = entityTypeCollisions(entityColl)
  if (0 < dups.length && log && log.warn) {
    log.warn({
      point: 'entity-types-name-collision', lang, names: dups,
      note: `${lang}: duplicate generated type name(s) ${dups.join(', ')} — ` +
        `two entities produce the same PascalCase type name; rename one ` +
        `entity (or alias it) in the model or the generated typed model ` +
        `will not compile in statically-typed targets`,
    })
  }
  return dups
}


function pickExampleEntity(entity: any): { entity: any, primaryOp: string | null } {
  const actives = each(entity).filter((e: any) => e && e.active !== false)
  const readable = actives.filter((e: any) => {
    const op = entityPrimaryOp(e)
    return 'list' === op || 'load' === op
  })
  const withOp = actives.filter((e: any) => null != entityPrimaryOp(e))
  // Prefer a readable entity, then any entity with an op, then anything at all.
  // WITHIN the chosen tier pick an entity of MEDIAN "size" — median name length
  // and median field count — so the generated README/examples showcase a
  // representative entity, not the alphabetically-first one (often a degenerate
  // stub with a terse name and no fields) nor an atypically sprawling one.
  const pool = readable.length ? readable : (withOp.length ? withOp : actives)
  const chosen = pickMedianEntity(pool)
  return { entity: chosen, primaryOp: null == chosen ? null : entityPrimaryOp(chosen) }
}


// The pool entity closest to the median on both axes (name length, field
// count). Distance on each axis is normalised by that axis's own median so the
// two are comparable, then summed. Ties keep the pool's existing key-sorted
// order (each() is byte-stable), so the pick is deterministic.
function pickMedianEntity(pool: any[]): any {
  if (0 === pool.length) return null
  if (1 === pool.length) return pool[0]
  const fieldCount = (e: any): number => (e && e.fields ? each(e.fields).length : 0)
  const nameLen = (e: any): number => (e && e.name ? String(e.name).length : 0)
  const medName = medianOf(pool.map(nameLen))
  const medField = medianOf(pool.map(fieldCount))
  let best = pool[0]
  let bestScore = Infinity
  for (const e of pool) {
    const score =
      Math.abs(nameLen(e) - medName) / (medName || 1) +
      Math.abs(fieldCount(e) - medField) / (medField || 1)
    if (score < bestScore) {
      bestScore = score
      best = e
    }
  }
  return best
}


function medianOf(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return 0 === s.length ? 0 : (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2)
}


// The id field on the entity's DATA type (its fields[]), or null. DISTINCT from
// entityIdField (the load-MATCH key): an API can model a load match that carries
// an `id` param while the response entity itself has no `id` field, so `.id`
// access on a RETURNED record must be guarded on this, not on the match key.
function entityDataIdField(ent: any): string | null {
  if (null == ent) {
    return null
  }
  const idName = (ent.id && ent.id.field) || 'id'
  const fields = ent.fields ? each(ent.fields) : []
  if (fields.some((f: any) => f && f.name === idName)) {
    return idName
  }
  if (fields.some((f: any) => f && f.name === 'id')) {
    return 'id'
  }
  return null
}


export {
  OP_SUFFIX,
  deriveEntityNames,
  entityCollection,
  opTypeName,
  opParams,
  ownPoint,
  opActions,
  entityActions,
  entityPath,
  opRequestShape,
  entityIdField,
  entityDataIdField,
  entityOps,
  entityPrimaryOp,
  pickExampleEntity,
  entityClassName,
  entityTypeCollisions,
  warnEntityTypeCollisions,
}

export type {
  OpShapeItem,
}
