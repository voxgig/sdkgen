// PROVENANCE: where a copied target or feature came from.
//
// WHY THIS EXISTS
//
// `feature add` needs each target's template tree, and `doctor` needs the
// scaffold a copy should be compared against. Both find it through the
// target model's `base` — and only three of the 27 shipped target models
// carried that line, so for the other 24, and for EVERY feature, both
// silently fell back to the bundled scaffold.
//
// That is right only while everything ships inside @voxgig/sdkgen. The moment
// a target or feature can come from somewhere else, a fallback to the bundled
// scaffold is a wrong answer rather than a missing one: doctor compares a copy
// against a scaffold it never came from, and the feature fan-out looks for
// source in a tree that does not have it.
//
// `base` alone is also not enough for an ALIAS, which is why `origname` is
// recorded beside it — see alias.test.ts.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'

import { provenanceReplace } from '../dist/helpers/stdrep.js'
import {
  SCAFFOLD, SCAFFOLD_BASE, ROOT, makeProject, targetRef, absoluteTargetRef,
  target_add, feature_add,
} from './actionharness'


function provenanceOf(project: any, kind: string, name: string) {
  const src = project.fs.readFileSync(
    ROOT + '/model/' + kind + '/' + name + '.aontu', 'utf8')

  const out: Record<string, string> = {}
  for (const m of String(src).matchAll(
    /^\s*(base|origname|package):\s*'([^']*)'\s*$/gm)) {
    out[m[1]] = m[2]
  }
  return { src, keys: out }
}


describe('provenance', () => {

  test('EVERY shipped model carries the anchor', () => {
    // The anchor is the only place the stamp can hang: a replace map can
    // rewrite text that is there, and there is nowhere else to put keys the
    // source does not have. A model without it records nothing, silently.
    const missing: string[] = []

    for (const kind of ['target', 'feature']) {
      const dir = Path.join(SCAFFOLD, 'model', kind)
      for (const f of Fs.readdirSync(dir).sort()) {
        if (!f.endsWith('.aontu') || f.includes('-index')) continue
        const src = Fs.readFileSync(Path.join(dir, f), 'utf8')
        if (!src.includes("base: 'BASE'")) {
          missing.push(kind + '/' + f)
        }
      }
    }

    deepStrictEqual(missing, [],
      'shipped model(s) with no provenance anchor — a copy of these records ' +
      'nothing, and doctor and the feature fan-out fall back to the bundled ' +
      'scaffold for them')
  })


  test('a target records where it came from', async () => {
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)

    const { keys, src } = provenanceOf(project, 'target', 'go')

    strictEqual(keys.base, SCAFFOLD_BASE, 'wrong or missing base')
    ok(!src.includes("'BASE'"), 'the raw anchor shipped into the project')

    // Not stamped when they do not apply, so an ordinary install records
    // exactly one line and reads as it always did.
    strictEqual(keys.origname, undefined, 'origname stamped for a plain add')
    strictEqual(keys.package, undefined, 'package stamped with no manifest')
  })


  test('a FEATURE records where it came from', async () => {
    // New: a feature model recorded nothing at all, so `feature add` could
    // only ever mean the bundled scaffold.
    const project = makeProject({ target: { go: { name: 'go' } } })
    await target_add([targetRef('go')], project.actx)
    await feature_add(['retry'], project.actx)

    const { keys, src } = provenanceOf(project, 'feature', 'retry')

    strictEqual(keys.base, SCAFFOLD_BASE, 'wrong or missing base')
    ok(!src.includes("'BASE'"), 'the raw anchor shipped into the project')
  })


  test('an alias records the name it came from', async () => {
    const project = makeProject({})
    await target_add([targetRef('go') + '~go2'], project.actx)

    const { keys } = provenanceOf(project, 'target', 'go2')

    strictEqual(keys.base, SCAFFOLD_BASE)
    strictEqual(keys.origname, 'go',
      'no origname — doctor cannot find the tree an alias came from')
  })


  test('an out-of-tree source records its absolute path', async () => {
    const project = makeProject({})
    await target_add([absoluteTargetRef('go')], project.actx)

    const { keys } = provenanceOf(project, 'target', 'go')

    ok(Path.isAbsolute(keys.base),
      'an out-of-tree scaffold did not record an absolute base: ' + keys.base)
  })


  test('the stamped model still COMPILES', async () => {
    // The stamp rewrites one line into three, so it has to produce valid
    // aontu — and the values have to land where the schema declares them.
    const project = makeProject({})
    await target_add([targetRef('go') + '~go2'], project.actx)

    const { src } = provenanceOf(project, 'target', 'go2')
    const errs: any[] = []
    const model = new Aontu().generate(src, {
      path: Path.join(SCAFFOLD, 'model', 'target', 'go2.aontu'), errs,
    })

    strictEqual(errs.length, 0, 'stamped model did not compile: ' +
      errs.map((e: any) => e.msg || String(e)).join(' | '))
    strictEqual(model?.main?.kit?.target?.go2?.origname, 'go')
    strictEqual(model?.main?.kit?.target?.go2?.base, SCAFFOLD_BASE)
  })


  test('the base is `/`-normalised', async () => {
    // It is written into a COMMITTED file, so it must not depend on the OS
    // that ran the add — otherwise the same project resynced on Windows and
    // on Linux records two different values and each churns the other.
    const project = makeProject({})
    await target_add([targetRef('ts')], project.actx)

    const { keys } = provenanceOf(project, 'target', 'ts')
    ok(!keys.base.includes('\\'), 'base contains a backslash: ' + keys.base)
  })
})


describe('provenanceReplace', () => {

  test('emits only the keys that apply', () => {
    deepStrictEqual(provenanceReplace({ base: 'b/.sdk' }),
      { "base: 'BASE'": "base: 'b/.sdk'" })

    deepStrictEqual(
      provenanceReplace({ base: 'b/.sdk', origname: 'go', name: 'go' }),
      { "base: 'BASE'": "base: 'b/.sdk'" },
      'origname stamped when it equals the installed name')
  })


  test('adds origname for an alias, indented to match', () => {
    deepStrictEqual(
      provenanceReplace({ base: 'b/.sdk', origname: 'go', name: 'go2' }),
      { "base: 'BASE'": "base: 'b/.sdk'\n  origname: 'go'" })
  })


  test('adds package when the source declared one', () => {
    deepStrictEqual(
      provenanceReplace({ base: 'b/.sdk', package: '@acme/sdkgen-iot' }),
      { "base: 'BASE'": "base: 'b/.sdk'\n  package: '@acme/sdkgen-iot'" })
  })
})
