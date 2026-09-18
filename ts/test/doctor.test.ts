
import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { action_doctor, doctor } from '../dist/action/doctor.js'
import {
  SCAFFOLD, SCAFFOLD_BASE, ROOT, KIT, makeProject, targetRef, target_add,
  feature_add,
} from './actionharness'


async function addedProject(feature: Record<string, any> = {}) {
  const project = makeProject({ feature })

  await target_add([targetRef('go')], project.actx)

  // `base` is what `target add` writes into the target's own model, and what
  // doctor uses to find the scaffold a target came from.
  project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }

  return project
}


async function check(project: any): Promise<any> {
  const res: any = await doctor(project.actx)
  return res.report
}


function write(project: any, rel: string, content: string) {
  const path = Path.join(ROOT, rel)
  project.fs.mkdirSync(Path.dirname(path), { recursive: true })
  project.fs.writeFileSync(path, content)
}


function read(project: any, rel: string): string {
  return project.fs.readFileSync(Path.join(ROOT, rel), 'utf8')
}


describe('doctor', () => {

  // THE test. Substitution artefacts must not read as drift.
  test('a freshly added target reports no drift', async () => {
    const report = await check(await addedProject())

    deepStrictEqual(report.forked, [], 'fresh project reports forked components')
    deepStrictEqual(report.edited, [], 'fresh project reports edited masters')
    deepStrictEqual(report.stale, [], 'fresh project reports stale files')
    deepStrictEqual(report.missing, [], 'fresh project reports missing files')
    strictEqual(report.ok, true, 'fresh project is not ok')
  })


  test('superseded output is a finding, and prune deletes exactly it', async () => {
    const project = await addedProject()

    // The target model declares one retired file; the project still has
    // it, in the target OUTPUT directory (a sibling of .sdk/).
    project.actx.model.main[KIT].target.go.superseded = ['test/old_runner.go']
    write(project, '../go/test/old_runner.go', '// stale generated runner\n')
    write(project, '../go/test/keep_test.go', '// current\n')

    const report = await check(project)
    strictEqual(report.ok, false, 'a superseded leftover must fail the check')
    deepStrictEqual(report.superseded.map((p: string) => p.split(/[\\/]/).pop()),
      ['old_runner.go'])

    await action_doctor(['doctor', 'prune'], project.actx)
    strictEqual(project.fs.existsSync(Path.join(ROOT, '../go/test/old_runner.go')), false,
      'prune must delete the declared superseded file')
    strictEqual(project.fs.existsSync(Path.join(ROOT, '../go/test/keep_test.go')), true,
      'prune must not touch anything the model does not name')

    const after = await check(project)
    deepStrictEqual(after.superseded, [], 'after prune the finding clears')
  })


  test('a model file nothing includes is a finding', async () => {
    const project = await addedProject()

    write(project, 'model/orphan.aon', 'main: kit: name: "ignored"\n')
    const stray = await check(project)
    strictEqual(stray.ok, false, 'an unincluded model file must fail the check')
    deepStrictEqual(stray.orphanModel, ['orphan.aon'])

    // REACHABILITY, not a mention scan: including it from another orphan
    // leaves both unreachable, and both must still be reported.
    write(project, 'model/alsoorphan.aon', '@"./orphan.aon"\n')
    const pair = await check(project)
    deepStrictEqual(pair.orphanModel.sort(), ['alsoorphan.aon', 'orphan.aon'])

    // Included from the entry point, it is model input like any other.
    const sdk = read(project, 'model/sdk.aon')
    write(project, 'model/sdk.aon', '@"./orphan.aon"\n' + sdk)
    const wired = await check(project)
    strictEqual(wired.orphanModel.includes('orphan.aon'), false,
      'a file the entry point includes is not an orphan')
  })


  test('it actually compared the trees', async () => {
    const project = await addedProject()

    // Break one file in each owned tree and confirm both are seen.
    write(project, 'src/cmp/go/Main_go.ts', '// forked\n')
    write(project, 'tm/go/core/error.go', '// edited\n')

    const report = await check(project)

    deepStrictEqual(report.forked, ['src/cmp/go/Main_go.ts'])
    deepStrictEqual(report.edited, ['tm/go/core/error.go'])
    strictEqual(report.ok, false)
  })


  test('it finds a file the scaffold no longer ships', async () => {
    const project = await addedProject()

    write(project, 'tm/go/utility/make_target.go', 'package utility\n')

    const report = await check(project)

    deepStrictEqual(report.stale, ['tm/go/utility/make_target.go'])
    strictEqual(report.ok, false)
  })


  test('it finds a file target add would write', async () => {
    const project = await addedProject()

    project.fs.unlinkSync(Path.join(ROOT, 'tm/go/VERSION'))

    const report = await check(project)

    deepStrictEqual(report.missing, ['tm/go/VERSION'])
    strictEqual(report.ok, false)
  })


  // Project-owned components are the SUPPORTED way to extend a target
  // (see registerComponent). They must be reported as what they are, and
  // must not fail the check — otherwise the extension point is unusable in CI.
  test('a project-owned component is additive, not drift', async () => {
    const project = await addedProject()

    write(project, 'src/cmp/go/Agents_go.ts', 'export const Agents = 1\n')

    const report = await check(project)

    deepStrictEqual(report.additive, ['src/cmp/go/Agents_go.ts'])
    deepStrictEqual(report.forked, [])
    deepStrictEqual(report.stale, [])
    strictEqual(report.ok, true, 'an additive component failed the check')
  })


  // Gap 9: a project's root wiring (Root.ts / Top.ts) comes from
  // create-sdkgen at init and is then frozen — `target add` never touches
  // it — so a capability sdkgen adds later is invisible. solardemo's Top.ts,
  // written before `ReadmeTop` existed, hand-rolled a 9-line stub root README
  // for months and nothing ever said so.
  test('it names root capabilities the project never wired in', async () => {
    const project = await addedProject()

    write(project, 'src/Top.ts', `
import { ReadmeTop, License } from '@voxgig/sdkgen'

const Top = () => {
  ReadmeTop({})
  License({})
}
`)

    const report = await check(project)

    ok(report.unwired.some((u: string) => u.startsWith('Deploy ')),
      'Deploy is not wired in and was not reported: ' + report.unwired.join(' | '))
    ok(report.unwired.some((u: string) => u.startsWith('Changelog ')),
      'Changelog is not wired in and was not reported')

    ok(!report.unwired.some((u: string) => u.startsWith('ReadmeTop ')),
      'ReadmeTop IS wired in but was reported unwired')
    ok(!report.unwired.some((u: string) => u.startsWith('License ')),
      'License IS wired in but was reported unwired')

    // Opting out of a root component is legitimate — it must not fail CI.
    strictEqual(report.ok, true, 'an unwired root capability failed the check')
  })


  test('unmodelled feature source reads as stale', async () => {
    const project = await addedProject()

    write(project, 'tm/go/feature/retry_feature.go', 'package feature\n')

    const report = await check(project)

    ok(report.stale.includes('tm/go/feature/retry_feature.go'),
      'feature source the model never selected was not reported stale')
  })


  test('modelled feature source is expected', async () => {
    const project = await addedProject({ retry: { name: 'retry', active: true } })

    const report = await check(project)

    ok(!report.stale.some((f: string) => f.includes('retry')),
      'declared feature source reported stale: ' + report.stale.join(', '))
    ok(!report.missing.some((f: string) => f.includes('retry')),
      'declared feature source reported missing: ' + report.missing.join(', '))
  })


  test('a hand-edited target model reads as forked', async () => {
    const project = await addedProject()

    write(project, 'model/target/go.aon',
      'main: kit: target: go: publish: registry: package: "pinned"\n')

    const report = await check(project)

    ok(report.forked.includes('model/target/go.aon'),
      'edited target model not reported forked: ' + report.forked.join(', '))
    strictEqual(report.ok, false)
  })


  test('a deleted target model reads as missing', async () => {
    const project = await addedProject()

    project.fs.unlinkSync(Path.join(ROOT, 'model/target/go.aon'))

    const report = await check(project)

    ok(report.missing.includes('model/target/go.aon'),
      'deleted target model not reported missing: ' + report.missing.join(', '))
    strictEqual(report.ok, false)
  })


  test('a freshly added ts target reports no drift either', async () => {
    const project = makeProject({})

    await target_add([targetRef('ts')], project.actx)
    project.actx.model.main[KIT].target.ts = { name: 'ts', base: SCAFFOLD_BASE }

    const report = await check(project)

    deepStrictEqual(report.forked, [], 'fresh ts project reports forked components')
    deepStrictEqual(report.edited, [], 'fresh ts project reports edited masters')
    strictEqual(report.ok, true, 'fresh ts project is not ok')
  })

  test('an aliased target is CHECKED, against the tree it came from', async () => {
    const project = makeProject({})

    await target_add([targetRef('go') + '~go2'], project.actx)
    project.actx.model.main[KIT].target.go2 =
      { name: 'go2', base: SCAFFOLD_BASE, origname: 'go' }

    const report = await check(project)

    deepStrictEqual(report.stale, [], 'aliased target reports stale templates')
    deepStrictEqual(report.forked, [], 'aliased target reports forked components')
    deepStrictEqual(report.edited, [], 'aliased target reports edited masters')
    strictEqual(report.ok, true, 'a freshly aliased project is not ok')

    // And it is really comparing, not skipping: a hand-edit is still caught.
    write(project, 'tm/go2/Makefile', '# clobbered\n')
    const after = await check(project)
    ok(after.edited.includes('tm/go2/Makefile'),
      'an edit to an aliased template was not detected: ' +
      JSON.stringify(after.edited))
  })


  // A project whose copies predate the provenance rollout differs from the
  // scaffold by exactly the anchor line. The project changed nothing, so
  // calling that a fork would turn every existing consumer's CI red at once.
  test('a pre-provenance copy is resync-pending, not forked', async () => {
    const project = makeProject({})

    await target_add([targetRef('go')], project.actx)
    project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }

    // Roll the model file back to what an older sdkgen wrote: NO provenance
    // at all. Stripping only `base:` does not model that — a copy left
    // carrying `package:` is stamped, just inconsistently, and doctor is
    // right to call that a fork rather than a pending resync.
    const path = Path.join(ROOT, 'model/target/go.aon')
    const old = String(project.fs.readFileSync(path, 'utf8'))
      .split('\n')
      .filter((l: string) => !/^\s*(base|origname|package):/.test(l))
      .join('\n')
    project.fs.writeFileSync(path, old)

    const report = await check(project)

    deepStrictEqual(report.forked, [],
      'a copy predating provenance was reported as a fork')
    ok(report.resyncPending.includes('model/target/go.aon'),
      'no resync-pending finding: ' + JSON.stringify(report.resyncPending))
    strictEqual(report.ok, true, 'resync-pending must not fail the check')
  })


  // ...but the tolerance is narrow: a real edit alongside the missing anchor
  // is still a fork.
  test('a real edit is still forked, anchor or not', async () => {
    const project = makeProject({})

    await target_add([targetRef('go')], project.actx)
    project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }

    const path = Path.join(ROOT, 'model/target/go.aon')
    project.fs.writeFileSync(path,
      String(project.fs.readFileSync(path, 'utf8')) + '\n# hand edit\n')

    const report = await check(project)

    ok(report.forked.includes('model/target/go.aon'),
      'a hand-edited target model was not reported as forked')
    strictEqual(report.ok, false)
  })


  test('a copy missing only a LATER provenance key is resync-pending', async () => {
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)
    project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }

    const path = Path.join(ROOT, 'model/target/go.aon')
    project.fs.writeFileSync(path,
      String(project.fs.readFileSync(path, 'utf8'))
        .split('\n').filter((l: string) => !/^\s*package:/.test(l)).join('\n'))

    const report = await check(project)

    deepStrictEqual(report.forked, [],
      'a copy predating the `package` stamp was reported as a fork')
    ok(report.resyncPending.includes('model/target/go.aon'))
    strictEqual(report.ok, true)
  })


  test('a CHANGED provenance value is still a fork', async () => {
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)
    project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }

    const path = Path.join(ROOT, 'model/target/go.aon')
    project.fs.writeFileSync(path,
      String(project.fs.readFileSync(path, 'utf8'))
        .replace(/package: '[^']*'/, "package: '@evil/other'"))

    const report = await check(project)

    ok(report.forked.includes('model/target/go.aon'),
      'a rewritten `package:` value was not reported as forked')
    strictEqual(report.ok, false)
  })
})


describe('doctor: feature model files', () => {

  async function withFeature() {
    const project = makeProject({
      feature: { retry: { name: 'retry', active: true } },
    })

    await target_add([targetRef('go')], project.actx)

    project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }
    project.actx.model.main[KIT].feature.retry = {
      name: 'retry', active: true, base: SCAFFOLD_BASE,
    }

    return project
  }


  test('a freshly added feature reports no drift', async () => {
    // The clean case first: if this is noisy, nothing else here is usable.
    const report = await check(await withFeature())

    deepStrictEqual(report.forked, [])
    deepStrictEqual(report.missing, [])
    strictEqual(report.ok, true)
  })


  test('a hand-edited feature model reads as FORKED', async () => {
    // It carries the feature's version, `active` default, config defaults and
    // hook wiring — and the next `target add` silently reverts an edit to any
    // of them.
    const project = await withFeature()

    const path = Path.join(ROOT, 'model/feature/retry.aon')
    project.fs.writeFileSync(path,
      String(project.fs.readFileSync(path, 'utf8')) + '\n# hand edit\n')

    const report = await check(project)

    ok(report.forked.includes('model/feature/retry.aon'),
      'an edited feature model was not reported: ' +
      JSON.stringify(report.forked))
    strictEqual(report.ok, false)
  })


  test('a deleted feature model reads as MISSING', async () => {
    const project = await withFeature()

    project.fs.unlinkSync(Path.join(ROOT, 'model/feature/retry.aon'))

    const report = await check(project)

    ok(report.missing.includes('model/feature/retry.aon'))
    strictEqual(report.ok, false)
  })


  test('the resync tolerance applies to features too', async () => {
    // Feature models carry provenance as of the manifest work, so a copy
    // predating a key must not read as a fork here either — same rule, and it
    // comes along free because the comparison is kind-neutral.
    const project = await withFeature()

    const path = Path.join(ROOT, 'model/feature/retry.aon')
    project.fs.writeFileSync(path,
      String(project.fs.readFileSync(path, 'utf8'))
        .split('\n').filter((l: string) => !/^\s*package:/.test(l)).join('\n'))

    const report = await check(project)

    deepStrictEqual(report.forked, [])
    ok(report.resyncPending.includes('model/feature/retry.aon'))
    strictEqual(report.ok, true)
  })
})


describe('doctor: a feature package\'s overlay for someone else\'s target', () => {

  const FEATURE = `
main: kit: feature: circuitbreaker: {
  name: key()
  title: "cb"
  version: '0.0.1'
  active: true
  base: 'BASE'
  config: options: active: false
  hook: {}
}
`

  // Provides `circuitbreaker` plus an overlay for `go` — a target this
  // project got from the bundled scaffold, not from here.
  function featurePackage(): string {
    const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-foreign-'))
    const sdk = Path.join(dir, '.sdk')

    Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })
    Fs.writeFileSync(
      Path.join(sdk, 'model', 'feature', 'circuitbreaker.aon'), FEATURE)

    Fs.mkdirSync(Path.join(sdk, 'tm', 'go', 'feature'), { recursive: true })
    Fs.writeFileSync(
      Path.join(sdk, 'tm', 'go', 'feature', 'circuitbreaker_feature.go'),
      'package feature\n')

    return dir
  }


  async function withForeignFeature(pkg: string) {
    const project = makeProject({
      feature: { circuitbreaker: { name: 'circuitbreaker', active: true } },
    })

    await target_add([targetRef('go')], project.actx)
    project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }

    await feature_add([Path.join(pkg, 'circuitbreaker')], project.actx)

    const src = String(project.fs.readFileSync(
      ROOT + '/model/feature/circuitbreaker.aon', 'utf8'))

    project.actx.model.main[KIT].feature.circuitbreaker = {
      name: 'circuitbreaker', active: true,
      base: (src.match(/^\s*base:\s*'([^']*)'/m) || [])[1],
    }

    return project
  }


  test('its source is EXPECTED, not stale', async () => {
    const pkg = featurePackage()
    try {
      const project = await withForeignFeature(pkg)

      ok(project.files().includes('tm/go/feature/circuitbreaker_feature.go'),
        'the overlay was never installed — this test measures nothing')

      const report = await check(project)

      deepStrictEqual(report.stale, [],
        'a foreign feature\'s source was reported as stale, so doctor goes ' +
        'red for any project using an external feature')
      strictEqual(report.ok, true)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('...but it is still COMPARED, so an edit is caught', async () => {
    // Expected is not the same as ignored. Suppressing these would have
    // fixed the false stale and left a hole: `feature add` overwrites the
    // file, and `package update`'s gate needs to know before it does.
    const pkg = featurePackage()
    try {
      const project = await withForeignFeature(pkg)

      const path = Path.join(ROOT, 'tm/go/feature/circuitbreaker_feature.go')
      project.fs.writeFileSync(path,
        String(project.fs.readFileSync(path, 'utf8')) + '\n// hand edit\n')

      const report = await check(project)

      ok(report.edited.includes('tm/go/feature/circuitbreaker_feature.go'),
        'an edit to a foreign feature\'s source was invisible: ' +
        JSON.stringify(report))
      strictEqual(report.ok, false)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('it is compared when SCOPED to the feature alone', async () => {
    // The case the whole thing is for. `package update` on a FEATURE package
    // scopes doctor to that feature — no target is walked — and `feature add`
    // is about to rewrite exactly these files. Leaving the comparison in the
    // target walk left the gate open in the one scenario it was built for.
    const pkg = featurePackage()
    try {
      const project = await withForeignFeature(pkg)

      const path = Path.join(ROOT, 'tm/go/feature/circuitbreaker_feature.go')
      project.fs.writeFileSync(path,
        String(project.fs.readFileSync(path, 'utf8')) + '\n// hand edit\n')

      const res: any = await doctor(project.actx,
        (kind: string, name: string) =>
          'feature' === kind && 'circuitbreaker' === name)

      ok(res.report.edited.includes('tm/go/feature/circuitbreaker_feature.go'),
        'scoped to the feature, its own source was not compared: ' +
        JSON.stringify(res.report))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('it is compared ONCE, not once per side', async () => {
    // The target walk marks these expected; the feature check compares them.
    // If both compared, a full run would report the same file twice.
    const pkg = featurePackage()
    try {
      const project = await withForeignFeature(pkg)

      const path = Path.join(ROOT, 'tm/go/feature/circuitbreaker_feature.go')
      project.fs.writeFileSync(path,
        String(project.fs.readFileSync(path, 'utf8')) + '\n// hand edit\n')

      const report = await check(project)
      const hits = report.edited.filter(
        (f: string) => f === 'tm/go/feature/circuitbreaker_feature.go')

      strictEqual(hits.length, 1, 'reported ' + hits.length + ' times')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a DEACTIVATED feature\'s source is stale again', async () => {
    // `feature add` copies only active features, so what a switched-off
    // feature leaves behind really is orphaned output — which is the
    // category this whole check exists for.
    const pkg = featurePackage()
    try {
      const project = await withForeignFeature(pkg)

      project.actx.model.main[KIT].feature.circuitbreaker.active = false

      const report = await check(project)

      ok(report.stale.includes('tm/go/feature/circuitbreaker_feature.go'),
        'source for a switched-off feature was still treated as expected')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })
})


describe('doctor: a model key that merely LOOKS like provenance', () => {

  const MODEL = `
main: kit: target: 'acme-go': {

  title: 'Acme Go'
  ext: go
  comment: line: "//"
  module: {
    name: '$$name$$'
    package: 'acmesdk'
  }
  base: 'BASE'
  srcfeature: false

  deps: &: {
    kind: *'prod' | string
  }
  deps: {}
}
`

  function acmePackage(): string {
    const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-acme-'))
    const sdk = Path.join(dir, '.sdk')

    Fs.mkdirSync(Path.join(sdk, 'model', 'target'), { recursive: true })
    Fs.writeFileSync(
      Path.join(sdk, 'model', 'target', 'acme-go.aon'), MODEL)
    Fs.mkdirSync(Path.join(sdk, 'src', 'cmp', 'acme-go'), { recursive: true })
    Fs.writeFileSync(
      Path.join(sdk, 'src', 'cmp', 'acme-go', 'Main_acme-go.ts'), 'export {}\n')
    Fs.mkdirSync(Path.join(sdk, 'tm', 'acme-go'), { recursive: true })
    Fs.writeFileSync(Path.join(sdk, 'tm', 'acme-go', 'x.txt'), 'x\n')
    Fs.writeFileSync(Path.join(dir, 'sdkgen-package.json'), JSON.stringify({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-go', version: '1.0.0',
      provides: { target: ['acme-go'] },
    }))

    return dir
  }


  async function acmeReport(mutate: (src: string) => string) {
    const pkg = acmePackage()
    try {
      const project = makeProject({
        target: { 'acme-go': { name: 'acme-go' } },
      })
      await target_add([Path.join(pkg, 'acme-go')], project.actx)

      const path = Path.join(ROOT, 'model/target/acme-go.aon')
      const src = mutate(String(project.fs.readFileSync(path, 'utf8')))
      project.fs.writeFileSync(path, src)

      project.actx.model.main[KIT].target['acme-go'] = {
        name: 'acme-go',
        base: (src.match(/^\s*base:\s*'([^']*)'/m) || [])[1],
      }

      return await check(project)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  }


  const dropProvenancePackage = (src: string) =>
    src.split('\n')
      .filter((l: string) => !/^ {2}package: '@acme/.test(l))
      .join('\n')


  test('the lookalike is not mistaken for a stamp', async () => {
    // The copy predates the `package` stamp and is otherwise untouched. Read
    // by a key-only match, its `module: package:` line said "already
    // stamped", the tolerance did not apply, and doctor reported a fork on a
    // file nobody had edited — the exact false-red the tolerance exists to
    // prevent.
    const report = await acmeReport(dropProvenancePackage)

    deepStrictEqual(report.forked, [],
      "a target model's own `module: package:` line was read as provenance")
    ok(report.resyncPending.includes('model/target/acme-go.aon'),
      'no resync-pending finding: ' + JSON.stringify(report.resyncPending))
    strictEqual(report.ok, true)
  })


  test('the lookalike is still COMPARED, so deleting it is a fork', async () => {
    const report = await acmeReport((src: string) =>
      dropProvenancePackage(src)
        .split('\n')
        .filter((l: string) => !/^\s*package: 'acmesdk'/.test(l))
        .join('\n'))

    ok(report.forked.includes('model/target/acme-go.aon'),
      'deleting a real `module: package:` line was not reported as a fork: ' +
      JSON.stringify(report))
    strictEqual(report.ok, false)
  })
})
