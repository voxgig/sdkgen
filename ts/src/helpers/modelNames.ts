/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

// Normalise entity names in the model so every generated identifier is legal.
//
// An entity name is a MODEL KEY, and every target builds identifiers from it:
// the PascalCase `Name` (class names, the SDK accessor, every generated type
// name), the snake stem (python module names, test function names), the
// object-literal key in the emitted config map. No target language permits an
// identifier that starts with a digit, and ordinary resources produce one:
// `/3ds-sessions` -> entity `3ds_session` -> `class 3dsSessionEntity`,
// `import { 3dsSession }`, `3dsSession()`. That is not a degraded SDK, it is
// no SDK — nothing compiles (issue #124).
//
// THE RENAME IS ON THE MODEL, NOT ON A DERIVED FORM, and that is the whole
// design. Guarding `Name` where it is derived does not survive: a consumer's
// scaffolded `Root.ts` — which lives in the consumer's repo, not here — runs
// its own `names(entity, entity.name)` per entity per target, immediately
// before emitting, and re-derives `Name` from the unguarded name. Only a
// guarded `entity.name` makes that re-derivation come out right, and it fixes
// the snake-stem and config-key positions at the same time.
//
// Applied before Root runs, so nothing has read a name yet.
//
// IT IS A NO-OP ON EVERY MODEL THAT EXISTS TODAY. apidef guards entity names
// at the source, so a name reaching here with a leading digit means a
// hand-authored `.sdk/model` or a pre-guard apidef. The rename is the same
// rule, producing the same name, as apidef's own `prefixLeadingDigit` — so
// the two layers agree rather than compete, and a model that went through
// apidef is untouched.
//
// The WIRE is untouched. A request path comes from the point's `orig`, never
// from the entity name, so renaming the entity cannot change what is called.

import { each, names } from 'jostraca'
import { KIT } from '@voxgig/apidef'

import { prefixLeadingDigit } from './naming'


// `from`/`to` are the entity NAME. `key` is where the entity sits in the
// collection after the rename — the new name when the map was keyed by it (the
// normal shape), the untouched original key when it was not.
type Rename = { from: string, to: string, key: string }

// The internal form, which also remembers where the entity sat BEFORE the
// rename — the one thing the public record cannot carry and the apply pass
// needs, since the key only moves when it was the name.
type Plan = { from: string, to: string, origkey: string }


// Rename every entity whose name would produce an illegal identifier, and
// rewrite the model's own references to it. Returns the renames applied, so
// the caller can report them; empty when the model is already clean.
function guardModelNames(model: any, log?: any): Rename[] {
  const entity = model?.main?.[KIT]?.entity
  // An ARRAY is not a name-keyed collection: its keys are indices, and
  // "renaming" one would rewrite the model into nonsense. Models are maps, but
  // the check is cheap and the failure would be silent.
  if (null == entity || 'object' !== typeof entity || Array.isArray(entity)) {
    return []
  }

  // Sorted keys: the rename set, and any collision report, is byte-stable.
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

    // `name` is authoritative, not the key: it is the value every derived
    // form comes from. The key moves with it only when the two agree, which
    // is the normal shape.
    const from = 'string' === typeof ent.name ? ent.name : key

    const to = prefixLeadingDigit(from)
    if (to === from) {
      continue
    }

    // The guarded name is already another entity's. Renaming onto it would
    // merge two unrelated entities — silently, since the model is a plain
    // map — so leave this one alone and say so. The generated SDK still will
    // not compile, but the reason is now in the log rather than in a syntax
    // error 20 files later.
    if (taken.has(to)) {
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
        `and cannot be guarded: the guarded name is already taken by another ` +
        `entity. Rename one of them in the model — the generated SDK will ` +
        `not compile in any target while an entity name is not an identifier`,
    })
  }

  if (0 === plans.length) {
    return []
  }

  const renames: Rename[] = []

  for (const { from, to, origkey } of plans) {
    const ent = entity[origkey]
    ent.name = to
    // jostraca's names() is memo-free but idempotent-by-absence: every derived
    // form has to go, or a stale `Name` from an earlier pass survives the
    // rename and the SDK is inconsistent with itself.
    delete ent.Name
    delete ent.NAME
    delete ent.name_
    delete ent['name-']
    delete ent.name__orig

    // The key moves only when it WAS the name. A key the model chose for some
    // other reason is left where it is; every derived identifier comes from
    // `name`, which is now guarded either way.
    if (origkey === from) {
      entity[to] = ent
      delete entity[origkey]
    }

    renames.push({ from, to, key: origkey === from ? to : origkey })
  }

  renameReferences(model, renames)

  if (log?.info) {
    log.info({
      point: 'entity-name-guard', renames,
      note: 'entity name(s) renamed so generated identifiers are legal: ' +
        renames.map((r) => `${r.from} -> ${r.to}`).join(', '),
    })
  }

  return renames
}


// The model refers to an entity by name in two more places, and both have to
// move with it or the reference dangles.
function renameReferences(model: any, renames: Rename[]): void {
  const map = new Map(renames.map((r) => [r.from, r.to]))

  // 1. FLOWS. A flow names its entity, and the Test components look the flow
  //    up by a key REBUILT from the entity's PascalCase Name
  //    (`Basic${nom(entity, 'Name')}Flow`), so the key has to move too or the
  //    entity silently generates no tests. Only a key that matches the
  //    reconstructed old one is renamed; anything else the author chose is
  //    left as it is, with just its `entity` field corrected.
  const flow = model?.main?.[KIT]?.flow
  if (null != flow && 'object' === typeof flow) {
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

      const oldkey = flowKey(from)
      const newkey = flowKey(to)
      if (key === oldkey && null == flow[newkey]) {
        f.name = newkey
        flow[newkey] = f
        delete flow[oldkey]
      }
    }
  }

  // 2. ANCESTORS. A nested entity records its parents by name.
  const entity = model?.main?.[KIT]?.entity
  each(entity).forEach((ent: any) => {
    const ancestors = ent?.relations?.ancestors
    if (!Array.isArray(ancestors)) {
      return
    }
    ent.relations.ancestors = ancestors.map((a: any) =>
      Array.isArray(a)
        ? a.map((n: any) => map.get(n) ?? n)
        : (map.get(a) ?? a))
  })
}


// The basic flow's key for an entity name, as the Test components rebuild it
// (`Basic${nom(entity, 'Name')}Flow`). Derived through jostraca's own names()
// on a scratch object rather than by re-implementing PascalCase here — a
// second spelling of that rule is exactly how the key and the lookup drift
// apart, and the failure is silent (an entity that generates no tests).
function flowKey(name: string): string {
  const scratch: any = {}
  names(scratch, name)
  return 'Basic' + scratch.Name + 'Flow'
}


export {
  guardModelNames,
}
