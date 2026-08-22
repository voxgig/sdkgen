// `feature add <name>` — the per-target source fan-out.
//
// WHAT WENT WRONG
//
// The fan-out copied a feature's per-target source with NO replace map, while
// `target add` copies the same target's `tm/<t>` tree WITH
// `templateReplacements`. So a feature source file carrying `ProjectName`
// arrived substituted or raw depending only on which action wrote it last:
//
//   target add ts   -> tm/ts/src/feature/log/LogFeature.ts   (substituted)
//   feature add log -> tm/ts/src/feature/log/LogFeature.ts   (RAW, overwrites)
//
// leaving `import type { ProjectNameSDK } from '../../ProjectNameSDK'` in a
// project whose SDK class is `DemoSDK` — a file that cannot compile, from a
// placeholder the toolchain is supposed to have consumed.
//
// This is the exact writer/writer disagreement `helpers/stdrep.ts` exists to
// prevent ("ONE definition, because two consumers must agree exactly"); the
// fan-out was the one writer that did not share the map.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import {
  makeProject, targetRef, target_add, feature_add, recordLog, ROOT,
} from './actionharness'


// An sdkgen package on disk providing one feature, with per-target source for
// a target it does NOT provide — the overlay case, which is the whole reason
// a feature has to be able to come from somewhere other than its target.
function externalFeaturePackage(name: string): string {
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-feat-'))
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'tm', 'ts', 'src', 'feature', name),
    { recursive: true })

  Fs.writeFileSync(Path.join(sdk, 'model', 'feature', name + '.aon'),
    '\nmain: kit: feature: ' + name + ': {\n' +
    '  name: key()\n' +
    '  title: "An externally defined feature"\n' +
    "  version: '0.0.1'\n" +
    '  active: true\n' +
    "  base: 'BASE'\n" +
    '  config: options: active: false\n' +
    '  hook: {}\n' +
    '}\n')

  Fs.writeFileSync(
    Path.join(sdk, 'tm', 'ts', 'src', 'feature', name, 'Ext.ts'),
    "import type { ProjectNameSDK } from '../../ProjectNameSDK'\n" +
    'export class Ext { _client?: ProjectNameSDK }\n')

  return dir
}


// A ts feature whose source names the SDK class, so substitution is visible.
const FEATURE = 'log'
const SOURCE = 'tm/ts/src/feature/log/LogFeature.ts'


async function addTargetThenFeature() {
  const project = makeProject({
    target: { ts: { name: 'ts' } },
    feature: { [FEATURE]: { name: FEATURE, active: true } },
  })

  await target_add([targetRef('ts')], project.actx)
  await feature_add([FEATURE], project.actx)

  return project
}


describe('feature add fan-out', () => {

  test('feature source is SUBSTITUTED, not raw', async () => {
    const project = await addTargetThenFeature()
    const src = project.fs.readFileSync(ROOT + '/' + SOURCE, 'utf8')

    ok(!src.includes('ProjectName'),
      'raw ProjectName survived into the project: ' +
      String(src).split('\n').filter((l: string) => l.includes('ProjectName'))
        .slice(0, 3).join(' | '))
    ok(src.includes('DemoSDK'),
      'the SDK class name was never substituted')
  })


  test('the fan-out agrees with what target add wrote', async () => {
    // The real invariant: whichever action writes the file last, the bytes
    // are the same. Previously the second writer undid the first.
    const first = makeProject({
      target: { ts: { name: 'ts' } },
      feature: { [FEATURE]: { name: FEATURE, active: true } },
    })
    await target_add([targetRef('ts')], first.actx)
    const afterTarget = first.fs.readFileSync(ROOT + '/' + SOURCE, 'utf8')

    const second = await addTargetThenFeature()
    const afterFeature = second.fs.readFileSync(ROOT + '/' + SOURCE, 'utf8')

    ok(afterTarget === afterFeature,
      'target add and feature add write different bytes for the same file')
  })


  test('feature add is idempotent', async () => {
    const project = await addTargetThenFeature()
    const once = project.fs.readFileSync(ROOT + '/' + SOURCE, 'utf8')

    await feature_add([FEATURE], project.actx)
    const twice = project.fs.readFileSync(ROOT + '/' + SOURCE, 'utf8')

    ok(once === twice, 'a second feature add changed the file')
  })
})


// A feature could not come from anywhere but the bundled scaffold: the model
// path was hardcoded to `node_modules/@voxgig/sdkgen`, and `feature add` took
// bare names with no ref grammar at all — while `target add` had accepted
// path refs and aliases for as long as it has existed.
describe('feature add from an external package', () => {

  test('installs a feature defined outside sdkgen', async () => {
    const pkg = externalFeaturePackage('circuitbreaker')
    try {
      const log = recordLog()
      const project = makeProject({ target: { ts: { name: 'ts' } }, log })
      await target_add([targetRef('ts')], project.actx)
      await feature_add([Path.join(pkg, 'circuitbreaker')], project.actx)

      // Surface WHY, rather than reporting a missing file: the action skips a
      // feature it cannot resolve, so a silent skip would otherwise show up
      // here as an unexplained absence.
      const skipped = log.lines.filter(
        (l: any) => 'feature-source-unresolved' === l.point)
      deepStrictEqual(skipped.map((l: any) => l.err), [],
        'the external feature was skipped: ' +
        skipped.map((l: any) => l.note).join(' | '))

      const files = project.files()

      ok(files.includes('model/feature/circuitbreaker.aon'),
        'the feature model was not copied; wrote: ' +
        files.filter((f: string) => f.startsWith('model/feature/')).join(', '))
      ok(files.includes('tm/ts/src/feature/circuitbreaker/Ext.ts'),
        'the feature source was not copied: ' +
        files.filter((f) => f.includes('circuit')).join(', '))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('the index lists the NAME, not the ref', async () => {
    // A ref is not a name. Writing `@"<abs path>/circuitbreaker.aon"` into
    // the index is an include of a file that does not exist, which fails the
    // whole model compile rather than just the feature.
    const pkg = externalFeaturePackage('circuitbreaker')
    try {
      const project = makeProject({ target: { ts: { name: 'ts' } } })
      await target_add([targetRef('ts')], project.actx)
      await feature_add([Path.join(pkg, 'circuitbreaker')], project.actx)

      const index = String(project.fs.readFileSync(
        ROOT + '/model/feature/feature-index.aon', 'utf8'))

      ok(index.includes('@"circuitbreaker.aon"'),
        'index does not name the installed feature: ' + JSON.stringify(index))

      for (const m of index.matchAll(/@"([^"]+)"/g)) {
        ok(project.files().includes('model/feature/' + m[1]),
          'feature-index.aon includes ' + m[1] + ', which was never written')
      }
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('the feature records where IT came from, not its target', async () => {
    const pkg = externalFeaturePackage('circuitbreaker')
    try {
      const project = makeProject({ target: { ts: { name: 'ts' } } })
      await target_add([targetRef('ts')], project.actx)
      await feature_add([Path.join(pkg, 'circuitbreaker')], project.actx)

      const src = String(project.fs.readFileSync(
        ROOT + '/model/feature/circuitbreaker.aon', 'utf8'))
      const base = (src.match(/^\s*base:\s*'([^']*)'/m) || [])[1]

      ok(null != base && base.includes('sdkgen-feat'),
        'the feature recorded the wrong source: ' + base)
      ok(!src.includes("'BASE'"), 'the raw anchor shipped into the project')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('external feature source is substituted like any other', async () => {
    const pkg = externalFeaturePackage('circuitbreaker')
    try {
      const project = makeProject({ target: { ts: { name: 'ts' } } })
      await target_add([targetRef('ts')], project.actx)
      await feature_add([Path.join(pkg, 'circuitbreaker')], project.actx)

      const src = String(project.fs.readFileSync(
        ROOT + '/tm/ts/src/feature/circuitbreaker/Ext.ts', 'utf8'))

      ok(src.includes('DemoSDK'), 'external feature source was not substituted')
      ok(!src.includes('ProjectName'), 'raw ProjectName survived')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('an unresolvable feature does not abort the whole run', async () => {
    // `target add` re-runs this action for EVERY active feature, so a feature
    // whose source has moved (package uninstalled, checkout relocated) must
    // not stop the others — including `test`, which every generated target
    // needs — from being copied. The already-copied files are left alone and
    // the run continues.
    const log = recordLog()
    const project = makeProject({ target: { ts: { name: 'ts' } }, log })
    await target_add([targetRef('ts')], project.actx)

    await feature_add(['/no/such/package/ghost', 'retry'], project.actx)

    ok(project.files().includes('model/feature/retry.aon'),
      'a healthy feature was skipped because another one could not resolve')
    ok(!project.files().some((f) => f.includes('ghost')),
      'the unresolvable feature was somehow written')
    ok(log.lines.some((l: any) =>
      'feature-source-unresolved' === l.point && String(l.feature).includes('ghost')),
      'the skip was not reported')
  })
})
