// Per-op request-payload shape + partiality policy for the typed-model
// generators (EntityTypes_<lang>.ts).
//
// SINGLE SOURCE OF TRUTH for two things every language generator needs:
//   1. The type-name scheme: <Name>{Load,List,Remove}Match /
//      <Name>{Create,Update}Data (OP_SUFFIX + opTypeName).
//   2. Which fields make up an op's request payload, and whether each is
//      required or optional (opRequestShape) — i.e. the partiality policy.
//
// PARTIALITY POLICY
//   Op-declared params win: if the op declares params
//   (op.<name>.points[].args.params[]), the payload is built from them and a
//   param is optional iff `reqd === false` (this is how path/query params such
//   as {id} become required). `fromParams` is true in that case.
//
//   Otherwise the payload mirrors the entity's fields, filtered to those active
//   for the op (field.op[opname].active !== false; absent -> participates), and
//   optionality is decided per-op:
//     create -> required iff `field.req` (server-shaped required fields);
//     update -> all optional (patch);
//     load / remove -> a field named `id` is required, the rest optional
//       (best-effort key convention; degrades to all-optional if no `id`);
//     list -> all optional (filter).
//
// The generators consume `items` (each already carrying its final `optional`
// flag) and render them in the target language's struct/interface/TypedDict
// syntax; the policy itself is language-neutral and tested in isolation.

import { each } from 'jostraca'


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


// The generated type name for an op's request payload, e.g. AdviceLoadMatch.
function opTypeName(Name: string, opname: string): string {
  return Name + cap(opname) + (OP_SUFFIX[opname] || 'Match')
}


// One request-payload member: a model field or op param, with the final
// required/optional decision already applied per the partiality policy.
type OpShapeItem = {
  name: string
  type: any     // canonical type sentinel (e.g. `$STRING`); render via canonToType
  optional: boolean
}


// Collect an op's params, deduped by name across its points.
//
// Points tagged with `select.$action` are sub-resource/action routes folded
// into the op (e.g. POST .../components/{component_id}/page_access_groups on
// the create op); they do not describe the op's canonical request payload,
// so they are excluded — unless the op consists only of action points.
//
// Requiredness merges by INTERSECTION: with several alternative canonical
// points, a param the caller must always supply is one required by every
// point; a param only some routes use is optional in the merged shape.
// (Union-required makes the common route untypeable — e.g. a plain
// list-by-parent-id call failing because sibling routes' ids are demanded —
// and steers callers into passing keys that flip runtime point dispatch to
// the wrong route.)
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
    const params = pt && pt.args && pt.args.params ? each(pt.args.params) : []
    const requiredHere: Record<string, boolean> = {}
    params.forEach((p: any) => {
      if (p && null != p.name) {
        requiredHere[p.name] = false !== p.reqd
        if (!seen[p.name]) {
          seen[p.name] = { ...p }
          // A param first seen on a later point was absent earlier: optional.
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

  return out
}


// Does a field participate in an op? Absent op-entry -> participates; only an
// explicit `active: false` excludes it.
function fieldInOp(field: any, opname: string): boolean {
  const fop = field && field.op && field.op[opname]
  return null == fop || fop.active !== false
}


// Decide optionality for a field in a no-params request payload, per op.
function fieldOptional(field: any, opname: string): boolean {
  switch (opname) {
    case 'create':
      // Respect the model's required flag: required unless req === false.
      return false === field.req
    case 'update':
      // Patch semantics — every field optional.
      return true
    case 'load':
    case 'remove':
      // Best-effort key convention: the `id` field is required, rest optional.
      return 'id' !== field.name
    case 'list':
    default:
      // Filter — every field optional.
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

  const params = opParams(op)
  if (0 < params.length) {
    const items = params.map((p: any) => ({
      name: p.name,
      type: p.type,
      optional: false === p.reqd,
    }))
    return { items, fromParams: true }
  }

  const fields = (ent.fields ? each(ent.fields) : [])
    .filter((f: any) => f.active !== false)
    .filter((f: any) => fieldInOp(f, opname))

  const items = fields.map((f: any) => ({
    name: f.name,
    type: f.type,
    optional: fieldOptional(f, opname),
  }))

  return { items, fromParams: false }
}


// The entity's id-like key field, or null when it has none. Used by the doc
// generators to decide whether an example may key a load/remove on `{ id: ... }`
// and access `.id` on a returned entity, OR must degrade to `load()` with no
// argument (some APIs model an entity whose load match carries no id — e.g. a
// response-wrapped spec, where AqiLoadMatch is { code, data, msg }). Prefers the
// model's declared id field name, then a literal `id`, checking the load-match
// shape first and the entity's own fields as a fallback.
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


// Collision-free target-language CLASS name for an entity. The natural
// class name is `<Name>Entity`, but that can equal another entity's
// canonical DATA-type name `<Name'>` when Name' === Name + 'Entity' (e.g.
// GitLab's `project` -> class `ProjectEntity` collides with `project_entity`
// -> data type `ProjectEntity`), which redeclares a type in Go and merges/
// shadows it in ts/py/rb. This assigns each entity a class name that is
// unique across ALL emitted top-level type names (every entity's data type
// and per-op Match/Data types, plus already-assigned class names): the
// natural `<Name>Entity` when free, else `<Name>EntityClient`, `...Client2`,
// … The DATA type keeps its canonical `<Name>` — only the suffixed class
// yields. Deterministic (sorted-key iteration) and stable across runs.
//
// Memoised per entity-collection object so the O(n) assignment runs once.
const _classNameCache = new WeakMap<object, Record<string, string>>()

function entityClassNames(entityColl: any): Record<string, string> {
  const cached = _classNameCache.get(entityColl)
  if (null != cached) {
    return cached
  }

  const ents = each(entityColl).filter((e: any) => e && e.active !== false)

  // 1. Every top-level DATA-type name the target emits.
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


// Cross-entity TYPE-name collision detection. entityClassNames keeps CLASS
// names collision-free, but the DATA/op type names are the raw `<Name>` /
// opTypeName(...) — two entities whose PascalCase Name coincides (e.g.
// `foo-bar` vs `foo_bar`), or a data-type name equal to another entity's
// op-type name, emit DUPLICATE top-level type declarations: a redeclaration
// compile error in go/rust/c/cpp/csharp and the JVM containers, silent
// merging in ts. The names cannot be auto-renamed here — the generated
// entity classes and op fragments reference them by token — so the guard
// surfaces the collision loudly instead. Returns the sorted duplicate names
// (empty when clean). Callers must have derived `Name` on each entity
// (every EntityTypes emitter does).
//
// Memoised per entity-collection object, like entityClassNames.
const _typeCollisionCache = new WeakMap<object, string[]>()

function entityTypeCollisions(entityColl: any): string[] {
  const cached = _typeCollisionCache.get(entityColl)
  if (null != cached) {
    return cached
  }

  const counts: Record<string, number> = {}
  const bump = (n: string) => { counts[n] = (counts[n] || 0) + 1 }

  each(entityColl)
    .filter((e: any) => e && null != e.name && null != e.Name)
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


// Pick a representative entity for a single illustrative snippet (e.g. the
// README's test-mode example): the first ACTIVE entity that exposes a read
// op (list/load) so the snippet is meaningful, else the first with ANY
// active op, else the first active entity. Returns { entity, primaryOp }
// where primaryOp is null only when NO entity has an op — so callers never
// fabricate an op the entity lacks (the cause of `.load()` on an op-less
// entity like Cloudsmith's `Abort`). Entities iterate in sorted-key order
// for deterministic output.
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
  opTypeName,
  opParams,
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
