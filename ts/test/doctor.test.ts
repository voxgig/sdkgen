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

import Path from 'node:path'

import { doctor } from '../dist/action/doctor.js'
import {
  SCAFFOLD, SCAFFOLD_BASE, ROOT, KIT, makeProject, targetRef, target_add,
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
})
