import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Path from 'node:path'

import {
  ROOT, makeProject, targetRef, target_add, recordLog,
} from './actionharness'

import { RETIRED_FILE } from '../dist/helpers/manifest.js'

import { action_doctor, copyWarnings, doctor } from '../dist/action/doctor.js'
import { package_update } from '../dist/action/package.js'
import { kind_remove } from '../dist/action/remove.js'
import { COPY_LOG, fingerprint, readCopies } from '../dist/action/copies.js'


const PACKAGE_ROOT = Path.resolve(__dirname, '..')

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


describe('a retired copy recognised without the record', () => {

  const LIST = PACKAGE_ROOT + '/project/' + RETIRED_FILE
  const TEXT = "import { x } from './utility_ts'\nexport const ReadmeGone = 'released'\n"

  // The bundled package's retired list, naming RETIRED with TEXT's fingerprint.
  function released(project: any, prints: string[] = [fingerprint(TEXT)]) {
    project.fs.mkdirSync(PACKAGE_ROOT + '/project', { recursive: true })
    project.fs.writeFileSync(LIST, JSON.stringify({ files: { [RETIRED]: prints } }))
  }

  async function unrecorded(rel = RETIRED, text = TEXT, alias?: string): Promise<any> {
    const project = makeProject()
    await target_add([targetRef('ts') + (null == alias ? '' : '~' + alias)], project.actx)
    project.fs.writeFileSync(ROOT + '/' + rel, text)
    released(project)
    return project
  }

  test('an unrecorded copy a release shipped is retired, and an add removes it', async () => {
    const project = await unrecorded()

    const before: any = (await doctor(project.actx)).report
    deepStrictEqual(before.retired, [RETIRED])
    deepStrictEqual(before.additive, [])
    strictEqual(before.ok, false)

    await target_add([targetRef('ts')], project.actx)
    ok(!exists(project, RETIRED))
    strictEqual(((await doctor(project.actx)).report as any).ok, true)
  })

  test('remove does not refuse it', async () => {
    const project = await unrecorded()
    await kind_remove('target', ['ts'], project.actx)
    ok(!exists(project, RETIRED))
  })

  test('a record that calls it changed does not outweigh the release', async () => {
    const project = await unrecorded()
    project.fs.appendFileSync(ROOT + '/' + COPY_LOG,
      JSON.stringify({ op: 'add', files: { [RETIRED]: 'feedfacefeedface' } }) + '\n')
    deepStrictEqual(((await doctor(project.actx)).report as any).retired, [RETIRED])
  })

  test('an aliased copy is read back through the alias', async () => {
    const rel = 'src/cmp/ts2/ReadmeGone_ts2.ts'
    const project = await unrecorded(rel, TEXT.replace("'./utility_ts'", "'./utility_ts2'"), 'ts2')
    deepStrictEqual(((await doctor(project.actx)).report as any).retired, [rel])
  })

  test('a copy that is no release is the project\'s, as before', async () => {
    const project = await unrecorded(RETIRED, TEXT + '// local\n')
    const report: any = (await doctor(project.actx)).report
    deepStrictEqual(report.additive, [RETIRED])
    deepStrictEqual(report.retired, [])
    await target_add([targetRef('ts')], project.actx)
    ok(exists(project, RETIRED))
  })
})


describe('a changed copy of a section a shared component writes', () => {

  const QUICK = 'src/cmp/ts/ReadmeQuick_ts.ts'

  async function overridden(declared: boolean): Promise<any> {
    const project = makeProject(declared ?
      { target: { ts: { override: { ReadmeQuick: true } } } } : {})
    await target_add([targetRef('ts')], project.actx)
    project.fs.writeFileSync(ROOT + '/' + QUICK, '// this project\'s own tutorial\n')
    return project
  }

  test('fails doctor until the model declares it', async () => {
    const report: any = (await doctor((await overridden(false)).actx)).report
    deepStrictEqual(report.undeclared, [QUICK])
    strictEqual(report.ok, false)

    const declared: any = (await doctor((await overridden(true)).actx)).report
    deepStrictEqual(declared.undeclared, [])
    deepStrictEqual(declared.additive, [QUICK])
    strictEqual(declared.ok, true, JSON.stringify(declared))
  })

  test('an add keeps it and names the declaration', async () => {
    const log = recordLog()
    const project = makeProject({ log })
    await target_add([targetRef('ts')], project.actx)
    project.fs.writeFileSync(ROOT + '/' + QUICK, '// own\n')
    project.fs.appendFileSync(ROOT + '/' + COPY_LOG,
      JSON.stringify({ op: 'add', files: { [QUICK]: fingerprint('// other\n') } }) + '\n')
    await target_add([targetRef('ts')], project.actx)
    ok(exists(project, QUICK))
    ok(log.lines.some((l: any) => 'target-component-override' === l.point &&
      String(l.note).includes('override: ReadmeQuick: true')))
  })
})


describe('a damaged copy record', () => {

  test('a line that cannot be read is a doctor finding', async () => {
    const project = makeProject()
    await target_add([targetRef('ts')], project.actx)
    project.fs.appendFileSync(ROOT + '/' + COPY_LOG, '{"op":"add","files":{"src/cm\n')

    const lines = String(project.fs.readFileSync(ROOT + '/' + COPY_LOG, 'utf8')).split('\n')
    const report: any = (await doctor(project.actx)).report
    deepStrictEqual(report.damagedRecord, [COPY_LOG + ':' + (lines.length - 1)])
    strictEqual(report.ok, false)
  })

  test('an entry of the wrong shape is damage too', async () => {
    const project = makeProject()
    await target_add([targetRef('ts')], project.actx)
    project.fs.appendFileSync(ROOT + '/' + COPY_LOG, '[1,2]\n"x"\n')
    strictEqual(readCopies(project.actx.fs(), ROOT).damaged.length, 2)
  })

  test('the next add does not join its line to a cut one', async () => {
    const project = makeProject()
    await target_add([targetRef('ts')], project.actx)
    project.fs.appendFileSync(ROOT + '/' + COPY_LOG, '{"op":"add","fi')
    await target_add([targetRef('go')], project.actx)

    const record = readCopies(project.actx.fs(), ROOT)
    strictEqual(record.damaged.length, 1)
    ok(Object.keys(record.files).some((rel: string) => rel.startsWith('src/cmp/go/')))
  })
})
