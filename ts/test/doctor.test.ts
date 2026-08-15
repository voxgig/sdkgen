// `doctor` — the check that keeps every other fix from silently rotting.
//
// WHAT IT HAS TO GET RIGHT
//
// A naive `diff -r` against the scaffold is useless here: `target add` writes
// template masters with substitution PARTLY applied, and inconsistently.
// `tm/go/core/error.go` arrives substituted (`DemoError` where the scaffold
// says `ProjectNameError`); `tm/ts/test/utility.ts` arrives raw, because its
// placeholders are substituted later at generate time. On
// voxgig-solardemo-sdk a plain diff reported 20 edited files, of which 19
// were substitution artefacts and exactly ONE was a hand-edit.
//
// So the headline test here is the CLEAN one: a project straight out of
// `target add` must report zero drift. Anything less and the report is noise
// and nobody will run it.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { doctor } from '../dist/action/doctor.js'
import {
  SCAFFOLD, SCAFFOLD_BASE, ROOT, KIT, makeProject, targetRef, target_add,
  feature_add,
} from './actionharness'


// A project with `go` added and registered in the model, the way a real
// `.sdk` looks after `target add` (the action writes the target model; the
// consumer's next run picks it up through model/target/target-index.aontu).
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


  // The check would also pass if it looked at nothing at all.
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


  // Gap 5's detection half. `utility/make_target.go` (superseded upstream by
  // `make_point.go`, leaving a duplicate symbol) and `utility/struct/go.mod`
  // (a nested module that made the package unimportable) each broke the
  // solardemo Go build, and nothing reported either.
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

    // Root wiring that calls some root components and not others.
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


  // Feature trimming and doctor have to agree. A project that added its
  // targets before trimming existed carries source for features its model
  // never declared — dead code that `target add` would no longer write.
  test('unmodelled feature source reads as stale', async () => {
    const project = await addedProject()

    write(project, 'tm/go/feature/retry_feature.go', 'package feature\n')

    const report = await check(project)

    ok(report.stale.includes('tm/go/feature/retry_feature.go'),
      'feature source the model never selected was not reported stale')
  })


  // ...and once the model DOES declare it, the same file is expected, not
  // stale. Without this the two halves could disagree and nobody would know.
  test('modelled feature source is expected', async () => {
    const project = await addedProject({ retry: { name: 'retry', active: true } })

    const report = await check(project)

    ok(!report.stale.some((f: string) => f.includes('retry')),
      'declared feature source reported stale: ' + report.stale.join(', '))
    ok(!report.missing.some((f: string) => f.includes('retry')),
      'declared feature source reported missing: ' + report.missing.join(', '))
  })


  // `model/target/<t>.aontu` is OWNED by `target add` — it is overwritten
  // from the scaffold on every resync — and doctor did not look at it. So a
  // project that put a decision there (a pinned npm package name, in the case
  // that prompted this) had it silently reverted, with the only report of the
  // fork being the regression itself, later.
  test('a hand-edited target model reads as forked', async () => {
    const project = await addedProject()

    write(project, 'model/target/go.aontu',
      'main: kit: target: go: publish: registry: package: "pinned"\n')

    const report = await check(project)

    ok(report.forked.includes('model/target/go.aontu'),
      'edited target model not reported forked: ' + report.forked.join(', '))
    strictEqual(report.ok, false)
  })


  test('a deleted target model reads as missing', async () => {
    const project = await addedProject()

    project.fs.unlinkSync(Path.join(ROOT, 'model/target/go.aontu'))

    const report = await check(project)

    ok(report.missing.includes('model/target/go.aontu'),
      'deleted target model not reported missing: ' + report.missing.join(', '))
    strictEqual(report.ok, false)
  })


  // The clean case for a target whose scaffold carries `$$ref$$`
  // placeholders. `differs()` used to skip interpolation whenever the replace
  // map was empty — which it is for the whole `src/cmp` tree — while
  // jostraca's Copy ALWAYS interpolates. So
  // `src/cmp/ts/fragment/Config.fragment.ts` (`$$const.Name$$`) read as
  // FORKED straight out of `target add`, in every project with ts, js or
  // dart. `go` cannot catch this: it has no such fragment.
  test('a freshly added ts target reports no drift either', async () => {
    const project = makeProject({})

    await target_add([targetRef('ts')], project.actx)
    project.actx.model.main[KIT].target.ts = { name: 'ts', base: SCAFFOLD_BASE }

    const report = await check(project)

    deepStrictEqual(report.forked, [], 'fresh ts project reports forked components')
    deepStrictEqual(report.edited, [], 'fresh ts project reports edited masters')
    strictEqual(report.ok, true, 'fresh ts project is not ok')
  })

  // ALIASED TARGETS. Before `origname` was recorded, doctor rebuilt the ref
  // as `<base>/../<installed name>` — so `ts~ts2` sent it looking for a `ts2`
  // scaffold that does not exist. Both trees walked empty, so every component
  // read as `additive` and every template as `stale` (a FAILING category):
  // real edits were undetectable AND doctor went red on pure noise, for every
  // project carrying an alias.
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
    const path = Path.join(ROOT, 'model/target/go.aontu')
    const old = String(project.fs.readFileSync(path, 'utf8'))
      .split('\n')
      .filter((l: string) => !/^\s*(base|origname|package):/.test(l))
      .join('\n')
    project.fs.writeFileSync(path, old)

    const report = await check(project)

    deepStrictEqual(report.forked, [],
      'a copy predating provenance was reported as a fork')
    ok(report.resyncPending.includes('model/target/go.aontu'),
      'no resync-pending finding: ' + JSON.stringify(report.resyncPending))
    strictEqual(report.ok, true, 'resync-pending must not fail the check')
  })


  // ...but the tolerance is narrow: a real edit alongside the missing anchor
  // is still a fork.
  test('a real edit is still forked, anchor or not', async () => {
    const project = makeProject({})

    await target_add([targetRef('go')], project.actx)
    project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }

    const path = Path.join(ROOT, 'model/target/go.aontu')
    project.fs.writeFileSync(path,
      String(project.fs.readFileSync(path, 'utf8')) + '\n# hand edit\n')

    const report = await check(project)

    ok(report.forked.includes('model/target/go.aontu'),
      'a hand-edited target model was not reported as forked')
    strictEqual(report.ok, false)
  })


  test('a copy missing only a LATER provenance key is resync-pending', async () => {
    // The keys arrived in stages — `base`/`origname` first, `package` with
    // the manifest — so a project that resynced between two of them holds a
    // copy that IS stamped and is still missing a later key. Treating
    // "stamped at all" as the test made every one of those a fork: on the
    // released 3.4.8 scaffold only ts, csharp and swift carried the anchor,
    // and `ts` is in essentially every consumer SDK.
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)
    project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }

    const path = Path.join(ROOT, 'model/target/go.aontu')
    project.fs.writeFileSync(path,
      String(project.fs.readFileSync(path, 'utf8'))
        .split('\n').filter((l: string) => !/^\s*package:/.test(l)).join('\n'))

    const report = await check(project)

    deepStrictEqual(report.forked, [],
      'a copy predating the `package` stamp was reported as a fork')
    ok(report.resyncPending.includes('model/target/go.aontu'))
    strictEqual(report.ok, true)
  })


  test('a CHANGED provenance value is still a fork', async () => {
    // The narrowness the previous rollout's review required: the copy keeps
    // the old line, so it is unmatched and the tolerance does not apply.
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)
    project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }

    const path = Path.join(ROOT, 'model/target/go.aontu')
    project.fs.writeFileSync(path,
      String(project.fs.readFileSync(path, 'utf8'))
        .replace(/package: '[^']*'/, "package: '@evil/other'"))

    const report = await check(project)

    ok(report.forked.includes('model/target/go.aontu'),
      'a rewritten `package:` value was not reported as forked')
    strictEqual(report.ok, false)
  })
})


// EVERY KIND'S COPIED MODEL FILE, not just targets'.
//
// `add` writes `model/feature/<f>.aontu` exactly as it writes
// `model/target/<t>.aontu`, and overwrites it on every resync — `target add`
// re-runs `feature add` for every active feature. Only the target one was
// compared, so a hand-edit to an installed feature definition read as
// perfectly in sync and was reverted with nothing said.
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

    const path = Path.join(ROOT, 'model/feature/retry.aontu')
    project.fs.writeFileSync(path,
      String(project.fs.readFileSync(path, 'utf8')) + '\n# hand edit\n')

    const report = await check(project)

    ok(report.forked.includes('model/feature/retry.aontu'),
      'an edited feature model was not reported: ' +
      JSON.stringify(report.forked))
    strictEqual(report.ok, false)
  })


  test('a deleted feature model reads as MISSING', async () => {
    const project = await withFeature()

    project.fs.unlinkSync(Path.join(ROOT, 'model/feature/retry.aontu'))

    const report = await check(project)

    ok(report.missing.includes('model/feature/retry.aontu'))
    strictEqual(report.ok, false)
  })


  test('the resync tolerance applies to features too', async () => {
    // Feature models carry provenance as of the manifest work, so a copy
    // predating a key must not read as a fork here either — same rule, and it
    // comes along free because the comparison is kind-neutral.
    const project = await withFeature()

    const path = Path.join(ROOT, 'model/feature/retry.aontu')
    project.fs.writeFileSync(path,
      String(project.fs.readFileSync(path, 'utf8'))
        .split('\n').filter((l: string) => !/^\s*package:/.test(l)).join('\n'))

    const report = await check(project)

    deepStrictEqual(report.forked, [])
    ok(report.resyncPending.includes('model/feature/retry.aontu'))
    strictEqual(report.ok, true)
  })
})


// A FEATURE PACKAGE'S PER-TARGET SOURCE — design §12.3.
//
// A feature supplied by a different package than the target ships its
// per-target source in its OWN `tm/<target>/` overlay, and `feature add`
// copies that into the project. Compared against the target's scaffold alone,
// those files are present in the project and absent upstream — so every one
// of them was reported STALE, a FAILING category. Any project using an
// external feature had a red `doctor` and nothing wrong with it.
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
      Path.join(sdk, 'model', 'feature', 'circuitbreaker.aontu'), FEATURE)

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
      ROOT + '/model/feature/circuitbreaker.aontu', 'utf8'))

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


// `base`, `origname` and `package` ARE NOT RESERVED WORDS.
//
// `main: kit: target: <t>: module: package` (the Go root package identifier)
// and `publish: registry: package` (the published package name) are declared
// model slots — see model/sdkgen.aontu — and a target model may write either
// in block form, on its own line, indistinguishable from a provenance line to
// any regex that matches on the key alone.
//
// Such a regex got BOTH directions wrong, which is why the tolerance now
// compares against the exact lines `provenanceReplace` emits.
describe('doctor: a model key that merely LOOKS like provenance', () => {

  // A third-party target whose model sets `module: package` as a BLOCK — a
  // declared schema slot (`main: kit: target: &: module: package`), holding
  // the Go root package identifier. Shipped from a package with a manifest,
  // so the provenance stamp carries a `package:` line of its own and the two
  // are genuinely ambiguous to a key-only match.
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
      Path.join(sdk, 'model', 'target', 'acme-go.aontu'), MODEL)
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

      const path = Path.join(ROOT, 'model/target/acme-go.aontu')
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
    ok(report.resyncPending.includes('model/target/acme-go.aontu'),
      'no resync-pending finding: ' + JSON.stringify(report.resyncPending))
    strictEqual(report.ok, true)
  })


  test('the lookalike is still COMPARED, so deleting it is a fork', async () => {
    // The mirror, and the worse half: a key-only match stripped the real
    // `module: package:` line from both sides, so deleting it — a genuine
    // fork, silently reverted by the next `target add` — passed the check.
    // That is precisely the class of hidden fork the previous review round
    // required be caught.
    const report = await acmeReport((src: string) =>
      dropProvenancePackage(src)
        .split('\n')
        .filter((l: string) => !/^\s*package: 'acmesdk'/.test(l))
        .join('\n'))

    ok(report.forked.includes('model/target/acme-go.aontu'),
      'deleting a real `module: package:` line was not reported as a fork: ' +
      JSON.stringify(report))
    strictEqual(report.ok, false)
  })
})
