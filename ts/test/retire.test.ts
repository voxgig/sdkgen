import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import {
  ROOT, makeProject, targetRef, target_add, recordLog,
} from './actionharness'

import { action_doctor, copyWarnings, doctor } from '../dist/action/doctor.js'
import { package_update } from '../dist/action/package.js'
import { kind_remove } from '../dist/action/remove.js'
import { COPY_LOG, fingerprint, readCopies } from '../dist/action/copies.js'


// Unshipped by the installed source, recorded exactly as an add wrote it.
const RETIRED = 'src/cmp/ts/ReadmeGone_ts.ts'
const COMPILED = 'dist/cmp/ts/ReadmeGone_ts.js'


async function retiredProject(opts: any = {}): Promise<any> {
  const project = makeProject(opts)
  await target_add([targetRef('ts')], project.actx)

  const text = "export const ReadmeGone = 'as an earlier release shipped it'\n"
  project.fs.writeFileSync(ROOT + '/' + RETIRED, text)
  project.fs.mkdirSync(ROOT + '/dist/cmp/ts', { recursive: true })
  project.fs.writeFileSync(ROOT + '/' + COMPILED, '// compiled\n')
  project.fs.appendFileSync(ROOT + '/' + COPY_LOG,
    JSON.stringify({ op: 'add', files: { [RETIRED]: fingerprint(text) } }) + '\n')

  return project
}


function edit(project: any) {
  project.fs.appendFileSync(ROOT + '/' + RETIRED, '// a local edit\n')
}


const exists = (project: any, rel: string) => project.fs.existsSync(ROOT + '/' + rel)


describe('a component the source has retired', () => {

  test('doctor reports an unchanged copy as retired, and an add removes it', async () => {
    const project = await retiredProject()

    const before: any = (await doctor(project.actx)).report
    deepStrictEqual(before.retired, [RETIRED])
    deepStrictEqual(before.additive, [])
    strictEqual(before.ok, false)
    strictEqual(before.byItem['target/ts'].outdated, 1)

    await target_add([targetRef('ts')], project.actx)

    ok(!exists(project, RETIRED), 'the retired copy is still there')
    ok(!exists(project, COMPILED), 'its compiled output is still there')
    strictEqual(readCopies(project.actx.fs(), ROOT).files[RETIRED], undefined)

    const after: any = (await doctor(project.actx)).report
    strictEqual(after.ok, true, JSON.stringify(after))
  })


  test('package update removes it without --force', async () => {
    const project = await retiredProject()
    project.actx.flags = { nofetch: true }

    await package_update(['@voxgig/sdkgen'], project.actx)

    ok(!exists(project, RETIRED))
  })


  test('a dry run removes nothing', async () => {
    const project = await retiredProject()
    project.actx.opts.dryrun = true

    await target_add([targetRef('ts')], project.actx)

    ok(exists(project, RETIRED))
    ok(exists(project, COMPILED))
  })


  test('a changed copy is kept as an override, and does not fail doctor', async () => {
    const log = recordLog()
    const project = await retiredProject({ log })
    edit(project)

    const before: any = (await doctor(project.actx)).report
    deepStrictEqual(before.override, [RETIRED])
    deepStrictEqual(before.retired, [])
    strictEqual(before.ok, true, JSON.stringify(before))

    await target_add([targetRef('ts')], project.actx)

    ok(exists(project, RETIRED), 'an edited copy was deleted')
    ok(exists(project, COMPILED))
    ok(log.lines.some((l: any) => 'target-component-override' === l.point &&
      RETIRED === l.file), 'the add did not say it kept the override')
  })


  test('overwrite mode treats a changed copy as it treats any other', async () => {
    const project = await retiredProject({ copies: 'overwrite' })
    edit(project)

    await target_add([targetRef('ts')], project.actx)

    ok(!exists(project, RETIRED))
  })


  test('a file the record does not name is the project\'s own', async () => {
    const project = makeProject()
    await target_add([targetRef('ts')], project.actx)
    project.fs.writeFileSync(ROOT + '/' + RETIRED, '// the project\'s own\n')

    const report: any = (await doctor(project.actx)).report
    deepStrictEqual(report.additive, [RETIRED])

    await target_add([targetRef('ts')], project.actx)
    ok(exists(project, RETIRED), 'an unrecorded file was deleted')
  })


  test('remove deletes an unchanged retired copy and refuses an override', async () => {
    const plain = await retiredProject()
    await kind_remove('target', ['ts'], plain.actx)
    ok(!exists(plain, RETIRED))

    const edited = await retiredProject()
    edit(edited)
    let refused = ''
    try {
      await kind_remove('target', ['ts'], edited.actx)
    }
    catch (err: any) {
      refused = err.message
    }
    ok(refused.includes(RETIRED), refused)
  })
})


describe('compiled output whose source is gone', () => {

  async function orphaned(): Promise<any> {
    const project = makeProject()
    await target_add([targetRef('ts')], project.actx)
    project.fs.mkdirSync(ROOT + '/dist/cmp/ts', { recursive: true })
    project.fs.writeFileSync(ROOT + '/' + COMPILED, '// compiled, source deleted\n')
    project.fs.writeFileSync(ROOT + '/' + COMPILED + '.map', '{}\n')
    // Compiled output beside its source is not an orphan.
    project.fs.writeFileSync(ROOT + '/dist/cmp/ts/Main_ts.js', '// compiled\n')
    return project
  }

  test('fails doctor, and generate is told', async () => {
    const project = await orphaned()
    const report: any = (await doctor(project.actx)).report
    deepStrictEqual(report.orphanCompiled, [COMPILED])
    strictEqual(report.ok, false)
    ok(copyWarnings(report).some((l: string) => l.includes(COMPILED)))
  })

  test('doctor prune deletes it, and a dry run does not', async () => {
    const dry = await orphaned()
    dry.actx.opts.dryrun = true
    await action_doctor(['doctor', 'prune'], dry.actx)
    ok(exists(dry, COMPILED))

    const project = await orphaned()
    await action_doctor(['doctor', 'prune'], project.actx)
    ok(!exists(project, COMPILED))
    ok(!exists(project, COMPILED + '.map'))
    ok(exists(project, 'dist/cmp/ts/Main_ts.js'))
    strictEqual(((await doctor(project.actx)).report as any).ok, true)
  })
})
