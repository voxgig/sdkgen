// Regressions for the entity-naming contract shared by every language target.
//
// Three defects this pins down, all of which produced silently-broken
// generated source rather than an error:
//
//   1. `Name` is derived lazily by jostraca's names(). The class-name and
//      collision helpers MEMOISE, so one read before derivation cached
//      `undefinedEntity` / an empty collision list for the whole run.
//   2. entityClassNames() built its "taken" set from ACTIVE entities only,
//      while every EntityTypes_<lang> emits data types for ALL entities
//      (only_active:false) — so an active entity's class could collide with
//      an inactive entity's emitted data type (a redeclaration in Go).
//   3. Every Entity_<lang>.ts read `Object.keys(entity.op)` unguarded, so an
//      op-less entity (the model schema does not require `op`) aborted the
//      whole generation run for every target.

import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, ok } from 'node:assert'

import { readFileSync, readdirSync } from 'node:fs'
import Path from 'node:path'

import {
  entityClassName,
  entityTypeCollisions,
  deriveEntityNames,
} from '../dist/sdkgen.js'


const CMP_DIR = Path.resolve(__dirname, '..', 'project', '.sdk', 'src', 'cmp')


describe('entity Name derivation is order-independent', () => {

  test('entityClassName derives Name instead of caching `undefinedEntity`', () => {
    // No names() call anywhere: the helper must cope on its own.
    const coll: any = {
      sun: { name: 'sun', active: true, op: { load: {} } },
      moon: { name: 'moon', active: true, op: { load: {} } },
    }
    strictEqual(entityClassName(coll.sun, coll), 'SunEntity')
    strictEqual(entityClassName(coll.moon, coll), 'MoonEntity')
  })

  test('entityTypeCollisions detects duplicates without a prior names() pass', () => {
    const coll: any = {
      'foo-bar': { name: 'foo-bar', op: { load: {} } },
      foo_bar: { name: 'foo_bar', op: { load: {} } },
    }
    // Memoised on first call — that first call must already be correct.
    const dups = entityTypeCollisions(coll)
    ok(dups.includes('FooBar'), 'data-type collision detected')
    ok(dups.includes('FooBarLoadMatch'), 'op-type collision detected')
  })

  test('deriveEntityNames is idempotent and skips nameless entries', () => {
    const coll: any = {
      sun: { name: 'sun' },
      broken: {},
      pluto: { name: 'pluto', Name: 'Pluto' },
    }
    const a = deriveEntityNames(coll)
    const b = deriveEntityNames(coll)
    deepStrictEqual(a.map((e: any) => e.Name), ['pluto', 'sun'].sort().map(
      (n: string) => n.charAt(0).toUpperCase() + n.slice(1)))
    deepStrictEqual(b.map((e: any) => e.Name), a.map((e: any) => e.Name))
    strictEqual(coll.broken.Name, undefined, 'nameless entry left alone')
  })
})


describe('class names avoid INACTIVE entities data types too', () => {

  test('active class yields to an inactive entity data-type name', () => {
    // `project-entity` is inactive but EntityTypes_<lang> still emits
    // `type ProjectEntity`, so the active `project` entity may not claim it.
    const coll: any = {
      project: { name: 'project', active: true, op: { load: {} } },
      'project-entity': { name: 'project-entity', active: false, op: { load: {} } },
    }
    strictEqual(entityClassName(coll.project, coll), 'ProjectEntityClient')
  })

  test('inactive entities get a collision-free class name of their own', () => {
    const coll: any = {
      alpha: { name: 'alpha', active: false, op: { load: {} } },
      beta: { name: 'beta', active: true, op: { load: {} } },
    }
    strictEqual(entityClassName(coll.alpha, coll), 'AlphaEntity')
    strictEqual(entityClassName(coll.beta, coll), 'BetaEntity')
  })
})


// Source-level parity check. An op-less entity must not throw, and the guard
// has to be present in EVERY language — fixing it only where it surfaced is
// the failure mode AGENTS.md calls out.
describe('every language component guards a missing entity.op', () => {

  const langs = readdirSync(CMP_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()

  test('no component reads Object.keys(entity.op) unguarded', () => {
    const bad: string[] = []
    for (const lang of langs) {
      const dir = Path.join(CMP_DIR, lang)
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
        const src = readFileSync(Path.join(dir, f), 'utf8')
        if (/Object\.keys\(entity\.op\)/.test(src)) {
          bad.push(`${lang}/${f}`)
        }
      }
    }
    deepStrictEqual(bad, [],
      'use Object.keys(entity.op || {}) — an entity need not declare any op')
  })

  test('no component dereferences entity.op.load/list unguarded', () => {
    const bad: string[] = []
    for (const lang of langs) {
      const dir = Path.join(CMP_DIR, lang)
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
        const src = readFileSync(Path.join(dir, f), 'utf8')
        // `entity.op && entity.op.load` is an explicit guard — allow it.
        const stripped = src.replace(/entity\.op && entity\.op\.\w+/g, '')
        if (/(?:\(entity\.op as any\)|entity\.op)\.(?:load|list)\b/.test(stripped)) {
          bad.push(`${lang}/${f}`)
        }
      }
    }
    deepStrictEqual(bad, [], 'use entity.op?.load / entity.op?.list')
  })
})
