
import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { KINDS, kindDef, kindTrees, resolveKind } from '../dist/action/kind.js'
import {
  ROOT, makeProject, targetRef, target_add, feature_add,
} from './actionharness'


function externalPackage(): string {
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-kind-'))
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'tm', 'ts', 'src', 'feature', 'ext'),
    { recursive: true })

  Fs.writeFileSync(Path.join(sdk, 'model', 'feature', 'ext.aon'),
    '\nmain: kit: feature: ext: {\n  name: key()\n  title: "x"\n' +
    "  version: '0.0.1'\n  active: true\n  base: 'BASE'\n" +
    '  config: options: active: false\n  hook: {}\n}\n')
  Fs.writeFileSync(
    Path.join(sdk, 'tm', 'ts', 'src', 'feature', 'ext', 'E.ts'), 'export {}\n')

  return dir
}


describe('kind registry', () => {

  test('declares the kinds an add understands', () => {
    deepStrictEqual(Object.keys(KINDS).sort(), ['edition', 'feature', 'target'])

    strictEqual(kindDef('target').alias, true,
      'a target must be installable under a new name')
    strictEqual(kindDef('feature').alias, false,
      'a feature name is part of the generated config and hook wiring')
    strictEqual(kindDef('edition').alias, true,
      'two docs items from one source is the same case as two Go modules')
  })


  test('a kind declares its trees ONCE, and everything reads them there', () => {
    deepStrictEqual(
      kindTrees('target', 'go').map((t: any) => t.path),
      ['src/cmp/go', 'tm/go'])

    deepStrictEqual(
      kindTrees('edition', 'go').map((t: any) => t.path),
      ['src/cmp/edition/go', 'tm/edition/go'])

    deepStrictEqual(kindTrees('feature', 'log'), [])
  })


  test("a docs item's templates are OPTIONAL, its components are not", () => {
    const trees = kindTrees('edition', 'summary')

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
        ROOT + '/model/feature/ext.aon', 'utf8'))
        .match(/^\s*base:\s*'([^']*)'/m) || [])[1]
      project.actx.model.main.kit.feature = {
        ext: { name: 'ext', active: true, base },
      }

      await feature_add(['ext'], project.actx)

      ok(project.files().includes('model/feature/ext.aon'),
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
      ROOT + '/model/target/go.aon', 'utf8'))
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
      ROOT + '/model/target/go2.aon', 'utf8'))
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
