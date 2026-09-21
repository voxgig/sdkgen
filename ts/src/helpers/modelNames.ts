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


function guardModelNames(model: any, log?: any): Rename[] {
  const entity = model?.main?.[KIT]?.entity
  if (null == entity || 'object' !== typeof entity || Array.isArray(entity)) {
    return []
  }

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

  const renames: Rename[] = []

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

    renames.push({ from, to, key: origkey === from ? to : origkey })
  }

  renameReferences(model, renames)

  if (log?.warn) {
    log.warn({
      point: 'entity-name-guard', renames,
      note: 'entity name(s) renamed so generated identifiers are legal: ' +
        renames.map((r) => `${r.from} -> ${r.to}`).join(', ') +
        '. If this project has a test fixture for one of them, move it: ' +
        renames.map((r) =>
          `.sdk/test/entity/${r.from}/${pascalName(r.from)}TestData.json -> ` +
          `.sdk/test/entity/${r.to}/${pascalName(r.to)}TestData.json ` +
          `(renaming its \`existing.${r.from}\` key to \`${r.to}\`)`)
          .join('; '),
    })
  }

  return renames
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
