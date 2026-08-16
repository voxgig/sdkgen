// The KIND spine: what `target add` and `feature add` share.
//
// They were two hand-written pipelines that had already drifted — only one
// took path refs, only one applied a replace map, only one recorded
// provenance — and each drift was found the hard way. What is common now runs
// once (action/kind), so a third kind cannot re-introduce the same gaps and
// the two existing ones cannot diverge again.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { KINDS, kindDef, kindTrees, resolveKind } from '../dist/action/kind.js'
import {
  ROOT, makeProject, targetRef, target_add, feature_add,
} from './actionharness'


// A package providing one target and one feature, so both kinds can be
// exercised against the same external source.
function externalPackage(): string {
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-kind-'))
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'tm', 'ts', 'src', 'feature', 'ext'),
    { recursive: true })

  Fs.writeFileSync(Path.join(sdk, 'model', 'feature', 'ext.aontu'),
    '\nmain: kit: feature: ext: {\n  name: key()\n  title: "x"\n' +
    "  version: '0.0.1'\n  active: true\n  base: 'BASE'\n" +
    '  config: options: active: false\n  hook: {}\n}\n')
  Fs.writeFileSync(
    Path.join(sdk, 'tm', 'ts', 'src', 'feature', 'ext', 'E.ts'), 'export {}\n')

  return dir
}


describe('kind registry', () => {

  test('declares the kinds an add understands', () => {
    deepStrictEqual(Object.keys(KINDS).sort(), ['docs', 'feature', 'target'])

    strictEqual(kindDef('target').alias, true,
      'a target must be installable under a new name')
    strictEqual(kindDef('feature').alias, false,
      'a feature name is part of the generated config and hook wiring')
    strictEqual(kindDef('docs').alias, true,
      'two docs items from one source is the same case as two Go modules')
  })


  test('a kind declares its trees ONCE, and everything reads them there', () => {
    // The add composes these paths, doctor walks them, and manifest
    // validation requires them. Three readers, one declaration — the
    // alternative is the same-rule-written-twice defect this registry exists
    // to prevent.
    deepStrictEqual(
      kindTrees('target', 'go').map((t: any) => t.path),
      ['src/cmp/go', 'tm/go'])

    // A docs item's trees are NESTED under the kind, so a docs item and a
    // target may share a name without sharing a directory.
    deepStrictEqual(
      kindTrees('docs', 'go').map((t: any) => t.path),
      ['src/cmp/docs/go', 'tm/docs/go'])

    // A feature IS its definition; it owns no tree of its own.
    deepStrictEqual(kindTrees('feature', 'log'), [])
  })


  test("a docs item's templates are OPTIONAL, its components are not", () => {
    // A docs item whose every emitted byte depends on the API — a catalogue
    // entry, a config file — legitimately ships no template tree, and a
    // manifest claiming it must still validate.
    const trees = kindTrees('docs', 'apidocs')

    strictEqual(trees.find((t: any) => t.path.startsWith('src/cmp'))?.required,
      true)
    strictEqual(trees.find((t: any) => t.path.startsWith('tm/'))?.required,
      false)
  })


  test('an unknown kind is refused by name', () => {
    let msg = ''
    try { kindDef('nosuch') } catch (e: any) { msg = e.message }
    ok(msg.includes('Unknown kind: nosuch'), 'got: ' + msg)
  })


  test('the registry has no inherited members', () => {
    // A plain object literal would make `kindDef('toString')` return
    // Object.prototype.toString and dispatch into it — the same hole
    // ACTION_MAP had.
    let msg = ''
    try { kindDef('toString') } catch (e: any) { msg = e.message }
    ok(msg.includes('Unknown kind: toString'), 'got: ' + msg)
  })


  test('the alias policy is enforced per kind, not per action', async () => {
    const project = makeProject({ target: { ts: { name: 'ts' } } })
    await target_add([targetRef('ts')], project.actx)

    await rejects(
      () => feature_add(['retry~breaker'], project.actx),
      /aliasing is not supported/,
      'a feature was accepted under an alias')
  })
})


// The property that makes provenance worth recording: a BARE name follows
// what the model already says, for EVERY kind. Without it the recording is
// write-only — the add actions re-run with the model's own keys, a bare name
// falls back to the bundled scaffold (whose .sdk folder exists, so resolution
// SUCCEEDS), and the copy then throws on a definition that is not there.
describe('bare names follow recorded provenance', () => {

  test('for a feature', async () => {
    const pkg = externalPackage()
    try {
      const project = makeProject({ target: { ts: { name: 'ts' } } })
      await target_add([targetRef('ts')], project.actx)
      await feature_add([Path.join(pkg, 'ext')], project.actx)

      const base = (String(project.fs.readFileSync(
        ROOT + '/model/feature/ext.aontu', 'utf8'))
        .match(/^\s*base:\s*'([^']*)'/m) || [])[1]
      project.actx.model.main.kit.feature = {
        ext: { name: 'ext', active: true, base },
      }

      await feature_add(['ext'], project.actx)

      ok(project.files().includes('model/feature/ext.aontu'),
        'the bare name did not resolve to the recorded source')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('for a target', async () => {
    // Targets went through their own resolver and did NOT do this, so an
    // externally-installed target resolved back to the bundled scaffold on
    // its next `target add` — silently reverting it to a different codebase,
    // or failing outright when the bundled scaffold has no such target.
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)

    const base = (String(project.fs.readFileSync(
      ROOT + '/model/target/go.aontu', 'utf8'))
      .match(/^\s*base:\s*'([^']*)'/m) || [])[1]

    const resolved = resolveKind('go', 'target', {
      ...project.actx,
      model: { main: { kit: { target: { go: { name: 'go', base } } } } },
      fs: project.actx.fs,
      folder: ROOT,
    })

    strictEqual(resolved.base, base,
      'a bare target name ignored the base its own model records')
  })


  test('an ALIAS resyncs as itself, not as its origin', async () => {
    // `target add go2`, after installing `go~go2`, must refresh go2.
    // Rebuilding only `<base>/../go` resolves to the ORIGIN name, so the run
    // would install a fresh `go` target, index it, and leave `go2` stale —
    // losing the differentiated identity the alias exists for, and the
    // project-owned model file with it.
    const project = makeProject({})
    await target_add([targetRef('go') + '~go2'], project.actx)

    const src = String(project.fs.readFileSync(
      ROOT + '/model/target/go2.aontu', 'utf8'))
    const base = (src.match(/^\s*base:\s*'([^']*)'/m) || [])[1]
    const origname = (src.match(/^\s*origname:\s*'([^']*)'/m) || [])[1]

    const resolved = resolveKind('go2', 'target', {
      ...project.actx,
      model: {
        main: { kit: { target: { go2: { name: 'go2', base, origname } } } },
      },
      fs: project.actx.fs,
      folder: ROOT,
    })

    strictEqual(resolved.name, 'go2',
      'the alias resolved back to its origin name')
    strictEqual(resolved.origname, 'go',
      'the origin name was lost')
  })


  test('an explicit ref still wins over the record', async () => {
    // That is how something is moved to a new source.
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)

    const resolved = resolveKind(targetRef('ts'), 'target', {
      ...project.actx,
      model: {
        main: { kit: { target: { ts: { name: 'ts', base: '/nowhere/.sdk' } } } },
      },
      fs: project.actx.fs,
      folder: ROOT,
    })

    strictEqual(resolved.origname, 'ts')
    ok(!resolved.base.includes('nowhere'),
      'the recorded base overrode an explicit ref: ' + resolved.base)
  })
})
