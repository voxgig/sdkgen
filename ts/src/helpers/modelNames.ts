/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */


import { each, names } from 'jostraca'
import { KIT } from '@voxgig/apidef'

import { entityRelationName } from './buildIdNames'

import { prefixLeadingDigit } from './naming'


type Rename = { from: string, to: string, key: string }

// The internal form, which also remembers where the entity sat BEFORE the
// rename — the one thing the public record cannot carry and the apply pass
// needs, since the key only moves when it was the name.
type Plan = { from: string, to: string, origkey: string }

type Member = { key: string, name: string, active: boolean }


function guardModelNames(model: any, log?: any): Rename[] {
  const entity = model?.main?.[KIT]?.entity
  if (null == entity || 'object' !== typeof entity || Array.isArray(entity)) {
    return []
  }

  const digits = guardLeadingDigits(model, entity, log)
  return digits.concat(guardFoldedNames(model, entity, digits, log))
}


function guardLeadingDigits(model: any, entity: any, log?: any): Rename[] {
  const flow = flowMap(model)

  const keys = Object.keys(entity).sort()
  const taken = new Set(keys)
  keys.forEach((k) => {
    const n = entity[k]?.name
    if ('string' === typeof n) taken.add(n)
  })

  const plans: Plan[] = []
  const blocked: string[] = []

  for (const key of keys) {
    const ent = entity[key]
    if (null == ent || 'object' !== typeof ent) {
      continue
    }

    const from = 'string' === typeof ent.name ? ent.name : key

    const to = prefixLeadingDigit(from)
    if (to === from) {
      continue
    }

    if (taken.has(to)) {
      blocked.push(from)
      continue
    }

    if (null != flow && flowCollides(flow, from, to)) {
      blocked.push(from)
      continue
    }

    taken.add(to)
    plans.push({ from, to, origkey: key })
  }

  if (0 < blocked.length && log?.warn) {
    log.warn({
      point: 'entity-name-guard-blocked', names: blocked.sort(),
      note: `entity name(s) ${blocked.sort().join(', ')} start with a digit ` +
        `and cannot be guarded: the guarded name, or the basic flow key it ` +
        `implies, is already taken. Rename the entity (or that flow) in the ` +
        `model — the generated SDK will not compile in any target while an ` +
        `entity name is not an identifier`,
    })
  }

  if (0 === plans.length) {
    return []
  }

  const renames = applyPlans(model, entity, plans)

  if (log?.warn) {
    log.warn({
      point: 'entity-name-guard', renames,
      note: 'entity name(s) renamed so generated identifiers are legal: ' +
        renames.map((r) => `${r.from} -> ${r.to}`).join(', ') +
        '. If this project has a test fixture for one of them, move it: ' +
        renames.map(fixtureMove).join('; '),
    })
  }

  return renames
}


// Names whose generated identifiers or files meet once case is ignored, as
// they do on macOS and Windows file systems and among PHP class and method
// names. One entity of each such group keeps its name and the rest gain a
// numeric suffix, chosen against every name the model holds.
function guardFoldedNames(
  model: any, entity: any, guarded: Rename[], log?: any,
): Rename[] {
  const keys = Object.keys(entity).sort()
  const members: Member[] = keys
    .filter((key) => null != entity[key] && 'object' === typeof entity[key])
    .map((key) => ({
      key,
      name: 'string' === typeof entity[key].name ? entity[key].name : key,
      active: false !== entity[key].active,
    }))

  const groups = foldGroups(members)
  if (0 === groups.length) {
    return []
  }

  const taken = new Set<string>()
  keys.concat(members.map((m) => m.name))
    .forEach((n) => foldKeys(n).forEach((f) => taken.add(f)))
  const held = new Set<string>(keys)
  const flow = flowMap(model)
  const order = precedence(new Set(guarded.map((r) => r.to)))

  const planned = groups.map((group) => {
    const ranked = group.slice().sort(order)
    const plans = ranked.slice(1).map((m) => {
      const to = freeName(m.name, taken, held, flow)
      foldKeys(to).forEach((f) => taken.add(f))
      held.add(to)
      return { from: m.name, to, origkey: m.key }
    })
    const routes = plans.map((p) => entityRoutes(entity[p.origkey]))
    return { ranked, plans, routes }
  })

  const renames = applyPlans(model, entity, planned.flatMap((p) => p.plans))

  if (log?.warn) {
    for (const { ranked, plans, routes } of planned) {
      log.warn({
        point: 'entity-name-case-guard',
        names: ranked.map((m) => m.name),
        renames: plans.map(renameOf),
        note: foldNote(ranked, plans.map(renameOf), routes),
      })
    }
  }

  return renames
}


// The forms a target derives from an entity name, as a case-insensitive
// comparison sees them: the PascalCase class form, and the snake form the
// C-family targets build by turning every other character into `_`.
function foldKeys(name: string): string[] {
  return [
    'Name:' + pascalName(name).toLowerCase(),
    'snake:' + name.replace(/[^A-Za-z0-9_]/g, '_').toLowerCase(),
  ]
}


// Either form alone joins a pair of names, so a group is a connected component.
function foldGroups(members: Member[]): Member[][] {
  const root = members.map((_m, i) => i)
  const find = (i: number): number => root[i] === i ? i : (root[i] = find(root[i]))
  const first = new Map<string, number>()

  members.forEach((m, i) => foldKeys(m.name).forEach((f) => {
    const j = first.get(f)
    if (null == j) {
      first.set(f, i)
    }
    else {
      root[find(i)] = find(j)
    }
  }))

  const groups = new Map<number, Member[]>()
  members.forEach((m, i) => {
    const r = find(i)
    groups.set(r, (groups.get(r) || []).concat(m))
  })

  return Array.from(groups.values()).filter((g) => 1 < g.length)
}


// The member that keeps its name sorts first: a name the model chose before
// one a guard produced, an active entity before an inactive one, then
// code-unit order.
function precedence(byGuard: Set<string>): (a: Member, b: Member) => number {
  const rank = (m: Member) => (byGuard.has(m.name) ? 2 : 0) + (m.active ? 0 : 1)
  const cmp = (x: string, y: string) => x < y ? -1 : x > y ? 1 : 0
  return (a, b) => rank(a) - rank(b) || cmp(a.name, b.name) || cmp(a.key, b.key)
}


function freeName(
  name: string, taken: Set<string>, held: Set<string>,
  flow: Record<string, any> | null,
): string {
  for (let n = 2; ; n++) {
    const to = name + n
    if (!held.has(to) &&
      !foldKeys(to).some((f) => taken.has(f)) &&
      (null == flow || !flowCollides(flow, name, to))) {
      return to
    }
  }
}


function applyPlans(model: any, entity: any, plans: Plan[]): Rename[] {
  for (const { from, to, origkey } of plans) {
    const ent = entity[origkey]
    ent.name = to
    delete ent.Name
    delete ent.NAME
    delete ent.name_
    delete ent['name-']
    delete ent.name__orig

    if (origkey === from) {
      entity[to] = ent
      delete entity[origkey]
    }
  }

  const renames = plans.map(renameOf)
  renameReferences(model, renames)
  return renames
}


function renameOf({ from, to, origkey }: Plan): Rename {
  return { from, to, key: origkey === from ? to : origkey }
}


function entityRoutes(ent: any): string[] {
  const routes = new Set<string>()
  for (const op of Object.values(ent?.op || {})) {
    for (const pt of (op as any)?.points || []) {
      if ('string' === typeof pt?.o && '' !== pt.o) {
        routes.add(pt.o)
      }
    }
  }
  return Array.from(routes).sort()
}


function foldNote(ranked: Member[], renames: Rename[], routes: string[][]): string {
  const moves = renames.map((r, i) =>
    0 === routes[i].length ? r.from : `${r.from} (${routes[i].join(', ')})`)
  const offs = renames.map((r) => `guide: entity: ${r.from}: active: false`)

  return `entity names ${ranked.map((m) => m.name).join(', ')} derive the ` +
    `same identifier or file name once case is ignored ` +
    `(${ranked.map((m) => pascalName(m.name)).join(', ')}): one file on a ` +
    `case-insensitive filesystem (macOS, Windows), and one class in PHP. ` +
    `Renamed ${renames.map((r) => `${r.from} -> ${r.to}`).join(', ')}; the ` +
    `routes are unchanged. To choose the name yourself, move the operations ` +
    `of ${moves.join(' and ')} to an entity named as you want in the guide ` +
    `(.sdk/model/guide/guide.aontu), and switch the old one off there with ` +
    `${offs.join(' and ')}. If this project has a test fixture for it, ` +
    `move it: ${renames.map(fixtureMove).join('; ')}`
}


// The fixture is the project's own file, so a rename cannot carry it.
function fixtureMove(r: Rename): string {
  return `.sdk/test/entity/${r.from}/${pascalName(r.from)}TestData.json -> ` +
    `.sdk/test/entity/${r.to}/${pascalName(r.to)}TestData.json ` +
    `(renaming its \`existing.${r.from}\` key to \`${r.to}\`)`
}


function flowMap(model: any): Record<string, any> | null {
  const flow = model?.main?.[KIT]?.flow
  return (null != flow && 'object' === typeof flow && !Array.isArray(flow))
    ? flow
    : null
}


// Would renaming `from` to `to` put this entity's basic flow on a key another
// flow already holds? The entity's own flow is the one sitting at the key its
// CURRENT name implies; anything else at the guarded key belongs to something
// else.
function flowCollides(
  flow: Record<string, any>, from: string, to: string,
): boolean {
  const held = flow[flowKey(to)]
  return null != held && held !== flow[flowKey(from)]
}


function renameReferences(model: any, renames: Rename[]): void {
  const map = new Map(renames.map((r) => [r.from, r.to]))

  const flow = flowMap(model)
  if (null != flow) {
    for (const key of Object.keys(flow).sort()) {
      const f = flow[key]
      if (null == f || 'object' !== typeof f) {
        continue
      }
      const to = map.get(f.entity)
      if (null == to) {
        continue
      }

      const from = f.entity
      f.entity = to

      // The destination is free: `flowCollides` refused the rename outright
      // when it was not, so this cannot clobber another flow.
      const oldkey = flowKey(from)
      if (key === oldkey) {
        const newkey = flowKey(to)
        f.name = newkey
        flow[newkey] = f
        delete flow[oldkey]
      }
    }
  }

  const entity = model?.main?.[KIT]?.entity
  each(entity).forEach((ent: any) => {
    const ancestors = ent?.relations?.ancestors
    if (!Array.isArray(ancestors)) {
      return
    }
    ent.relations.ancestors = ancestors.map((a: any) =>
      Array.isArray(a)
        ? a.map((n: string) => {
          const renamed = map.get(entityRelationName(n))
          return renamed == null ? n : n.startsWith('$.') ? '$.main.kit.entity.' + renamed : renamed
        })
        : (map.get(a) ?? a))
  })
}


// The basic flow's key for an entity name, as the Test components rebuild it
// (`Basic${nom(entity, 'Name')}Flow`). Derived through jostraca's own names()
// on a scratch object rather than by re-implementing PascalCase here — a
// second spelling of that rule is exactly how the key and the lookup drift
// apart, and the failure is silent (an entity that generates no tests).
function flowKey(name: string): string {
  return 'Basic' + pascalName(name) + 'Flow'
}


// The PascalCase `Name` for an entity name, through jostraca's own names() on
// a scratch object — the same derivation every component gets, so a caller
// here cannot drift from what is emitted.
function pascalName(name: string): string {
  const scratch: any = {}
  names(scratch, name)
  return scratch.Name
}


export {
  guardModelNames,
}
