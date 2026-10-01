
import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { cmp } from 'jostraca'

import {
  ROOT, PROJECT, makeProject, recordLog, targetRef, target_add,
} from './actionharness'

import { doctor, copyCheck } from '../dist/action/doctor.js'
import { package_update } from '../dist/action/package.js'
import { kind_remove } from '../dist/action/remove.js'
import { COPY_LOG, fingerprint, readCopies } from '../dist/action/copies.js'
import { SdkGen, projectConst } from '../dist/sdkgen.js'


const SHIPPED = JSON.parse(
  Fs.readFileSync(Path.join(PROJECT, 'sdkgen-package.json'), 'utf8'))

// Where 4.34.0 kept the record, as one rewritten file.
const LEGACY = 'sdkgen-copies.json'


async function added(target = 'ts', opts: any = {}): Promise<any> {
  const project = makeProject(opts)
  await target_add([targetRef(target)], project.actx)
  return project
}


// As the CLI adds: with the `const` block its model compilation derives.
async function addedAsTheCli(target = 'ts'): Promise<any> {
  const project = makeProject({})
  project.actx.model.name = 'demo'
  project.actx.model.const = projectConst(project.actx.model)
  await target_add([targetRef(target)], project.actx)
  return project
}


function record(project: any): any {
  return readCopies(project.actx.fs(), ROOT)
}


function logText(project: any): string {
  const path = ROOT + '/' + COPY_LOG
  return project.fs.existsSync(path) ? String(project.fs.readFileSync(path, 'utf8')) : ''
}


function entries(project: any): any[] {
  return logText(project).split('\n').filter(Boolean).map((line: string) => JSON.parse(line))
}


// What an older generator leaves behind: a file it wrote, recorded as it
// wrote it, that the installed source now writes differently.
function ageCopy(project: any, rel: string) {
  const path = ROOT + '/' + rel
  const older = String(project.fs.readFileSync(path, 'utf8')) +
    '\n// written by an older generator\n'
  project.fs.writeFileSync(path, older)
  project.fs.appendFileSync(ROOT + '/' + COPY_LOG,
    JSON.stringify({ op: 'add', files: { [rel]: fingerprint(older) } }) + '\n')
}


function editCopy(project: any, rel: string) {
  const path = ROOT + '/' + rel
  project.fs.writeFileSync(path,
    String(project.fs.readFileSync(path, 'utf8')) + '\n// a local edit\n')
}


function crlf(project: any, rel: string) {
  const path = ROOT + '/' + rel
  project.fs.writeFileSync(path,
    String(project.fs.readFileSync(path, 'utf8')).replace(/\r?\n/g, '\r\n'))
}


function firstFile(project: any, prefix: string): string {
  const found = Object.keys(record(project).files)
    .find((rel: string) => rel.startsWith(prefix) && rel.endsWith('.ts'))
  ok(null != found, 'no recorded file under ' + prefix)
  return found as string
}


describe('the copy record', () => {

  test('target add records every file it wrote, and the version it came from', async () => {
    const project = await added('ts')
    const copies = record(project)

    deepStrictEqual(copies.items['target/ts'],
      { package: '@voxgig/sdkgen', version: SHIPPED.version })
    deepStrictEqual(copies.items['feature/test'],
      { package: '@voxgig/sdkgen', version: SHIPPED.version })

    const owned = project.files().filter((rel: string) =>
      rel.startsWith('src/cmp/ts/') || rel.startsWith('tm/ts/') ||
      'model/target/ts.aontu' === rel || 'model/feature/test.aontu' === rel)

    deepStrictEqual(Object.keys(copies.files).sort(), owned.sort())

    for (const rel of owned) {
      strictEqual(copies.files[rel],
        fingerprint(project.fs.readFileSync(ROOT + '/' + rel)), rel)
    }

    ok(!Object.keys(copies.files).some((rel: string) => rel.endsWith('-index.aontu')),
      'an index is rewritten by every add and has no source to compare with')
  })


  test('lives in .sdk/log, and an add writes nothing at the top of .sdk', async () => {
    const project = await added('ts')

    strictEqual(COPY_LOG, 'log/copies.jsonl')
    ok(project.fs.existsSync(ROOT + '/' + COPY_LOG))
    deepStrictEqual(project.files().filter((rel: string) => !rel.includes('/')), [])
  })


  test('each line is one change, with sorted keys', async () => {
    const project = await added('ts')
    const lines = entries(project)

    deepStrictEqual(lines.map((line: any) => [line.op, Object.keys(line.items)]), [
      ['add', ['target/ts']],
      ['add', ['feature/test']],
    ])

    for (const line of lines) {
      ok(!Number.isNaN(Date.parse(line.at)), line.at)
      const files = Object.keys(line.files)
      deepStrictEqual(files, [...files].sort())
    }
  })


  test('is append-only, and an add that changes nothing appends nothing', async () => {
    const project = await added('ts')
    const first = logText(project)

    await target_add([targetRef('ts')], project.actx)
    strictEqual(logText(project), first, 'a re-add of identical copies dirtied the log')

    const rel = firstFile(project, 'tm/ts/')
    ageCopy(project, rel)
    const aged = logText(project)

    await target_add([targetRef('ts')], project.actx)

    ok(logText(project).startsWith(aged), 'an add rewrote earlier lines')
    const last = entries(project).pop()
    deepStrictEqual([last.op, last.items, Object.keys(last.files)], ['add', {}, [rel]])
  })


  test('a dry run records nothing', async () => {
    const project = await added('ts', { dryrun: true })
    ok(!project.fs.existsSync(ROOT + '/log'))
  })


  test('remove forgets the item and the files it removed', async () => {
    const project = await added('ts')
    project.actx.flags = {}

    await kind_remove('target', ['ts'], project.actx)

    const copies = record(project)
    strictEqual(copies.items['target/ts'], undefined)
    deepStrictEqual(Object.keys(copies.files)
      .filter((rel: string) => rel.startsWith('tm/ts/') || rel.startsWith('src/cmp/ts/')), [])

    const last = entries(project).pop()
    deepStrictEqual([last.op, last.items], ['remove', { 'target/ts': null }])
    ok(Object.values(last.files).every((print: any) => null === print))
  })


  test('a record from 4.34.0 is read, then moved into the log by the next add', async () => {
    const project = await added('ts')
    const rel = firstFile(project, 'tm/ts/')
    ageCopy(project, rel)

    project.fs.writeFileSync(ROOT + '/' + LEGACY, JSON.stringify(record(project)))
    project.fs.unlinkSync(ROOT + '/' + COPY_LOG)

    const before: any = (await doctor(project.actx)).report
    deepStrictEqual(before.outdated, [rel])

    await target_add([targetRef('ts')], project.actx)

    ok(!project.fs.existsSync(ROOT + '/' + LEGACY))
    deepStrictEqual(entries(project).map((line: any) => line.op), ['import', 'add'])

    const after: any = (await doctor(project.actx)).report
    strictEqual(after.ok, true)
  })
})


describe('doctor reads the copy record', () => {

  test('an untouched copy whose source moved on is OUTDATED, not edited', async () => {
    const project = await added('ts')
    const rel = firstFile(project, 'tm/ts/')
    ageCopy(project, rel)

    const report: any = (await doctor(project.actx)).report

    deepStrictEqual(report.outdated, [rel])
    deepStrictEqual(report.edited, [])
    deepStrictEqual(report.forked, [])
    strictEqual(report.ok, false, 'outdated is drift: generate would read it')
    deepStrictEqual(report.byItem['target/ts'], {
      package: '@voxgig/sdkgen', from: SHIPPED.version, to: SHIPPED.version,
      outdated: 1, changed: 0,
    })
  })


  test('a copy changed after the add is still a local change', async () => {
    const project = await added('ts')
    const rel = firstFile(project, 'src/cmp/ts/')
    editCopy(project, rel)

    const report: any = (await doctor(project.actx)).report

    deepStrictEqual(report.forked, [rel])
    deepStrictEqual(report.outdated, [])
    deepStrictEqual(report.unrecorded, [], 'the record shows it was changed')
  })


  test('without a record a difference stays unproven, as it always was', async () => {
    const project = await added('ts')
    const rel = firstFile(project, 'tm/ts/')
    project.fs.unlinkSync(ROOT + '/' + COPY_LOG)
    editCopy(project, rel)

    const report: any = (await doctor(project.actx)).report

    deepStrictEqual(report.edited, [rel])
    deepStrictEqual(report.unrecorded, [rel])
    deepStrictEqual(report.outdated, [])
  })
})


describe('line endings, which git may rewrite on checkout', () => {

  test('a copy checked out with CRLF is the copy add wrote', async () => {
    const project = await added('ts')
    crlf(project, firstFile(project, 'tm/ts/'))
    crlf(project, firstFile(project, 'src/cmp/ts/'))
    crlf(project, 'model/target/ts.aontu')

    const report: any = (await doctor(project.actx)).report

    strictEqual(report.ok, true, JSON.stringify(
      { forked: report.forked, edited: report.edited, outdated: report.outdated }))
    deepStrictEqual(await copyCheck(project.actx), [])
  })


  test('an outdated copy checked out with CRLF is still outdated', async () => {
    const project = await added('ts')
    const rel = firstFile(project, 'tm/ts/')
    ageCopy(project, rel)
    crlf(project, rel)

    const report: any = (await doctor(project.actx)).report

    deepStrictEqual(report.outdated, [rel])
    deepStrictEqual(report.edited, [])
  })
})


describe('a .gitignore that hides the log', () => {

  // What every create-sdkgen scaffold wrote before the record moved here.
  const SCAFFOLDED = '# Generated logs\nlog/\n*.log\n'


  test('the add that starts the log says so, once', async () => {
    const log = recordLog()
    const project = makeProject({ log })
    project.fs.writeFileSync(ROOT + '/.gitignore', SCAFFOLDED)

    await target_add([targetRef('ts')], project.actx)
    await target_add([targetRef('go')], project.actx)

    const warned = log.lines.filter((l: any) => 'copies-ignored' === l.point)
    strictEqual(warned.length, 1, JSON.stringify(warned))
    strictEqual(warned[0].level, 'warn')
    ok(warned[0].note.includes('Delete the log/ line'), warned[0].note)
  })


  test('doctor and generate keep saying so until the line goes', async () => {
    const project = await added('ts')
    project.fs.writeFileSync(ROOT + '/.gitignore', SCAFFOLDED)

    const hidden: any = (await doctor(project.actx)).report
    strictEqual(hidden.ignoredLog, true)
    strictEqual(hidden.ok, true, 'a hidden record is not drift')

    const lines = await copyCheck(project.actx)
    strictEqual(lines.length, 1, lines.join('\n'))
    ok(lines[0].includes('.gitignore ignores log/'), lines[0])

    project.fs.writeFileSync(ROOT + '/.gitignore', '# Generated logs\n*.log\n')

    const shown: any = (await doctor(project.actx)).report
    strictEqual(shown.ignoredLog, false)
    deepStrictEqual(await copyCheck(project.actx), [])
  })
})


describe('package update reads the copy record', () => {

  test('refreshes outdated copies without --force', async () => {
    const project = await added('ts')
    const rel = firstFile(project, 'tm/ts/')
    ageCopy(project, rel)

    project.actx.flags = { nofetch: true }
    await package_update(['@voxgig/sdkgen'], project.actx)

    const report: any = (await doctor(project.actx)).report
    strictEqual(report.ok, true, JSON.stringify(report.outdated))
    ok(!String(project.fs.readFileSync(ROOT + '/' + rel, 'utf8'))
      .includes('older generator'), 'the outdated copy was not refreshed')
  })


  test('refuses a local edit, and names it as one', async () => {
    const project = await added('ts')
    editCopy(project, firstFile(project, 'src/cmp/ts/'))

    project.actx.flags = { nofetch: true }

    await rejects(() => package_update(['@voxgig/sdkgen'], project.actx),
      (err: any) => /changed in this project after an add wrote them/.test(err.message) &&
        !/out of band/.test(err.message))
  })
})


describe('generate warns about copies', () => {

  test('copyCheck names the items and the command that refreshes them', async () => {
    const project = await added('ts')
    ageCopy(project, firstFile(project, 'tm/ts/'))
    editCopy(project, firstFile(project, 'src/cmp/ts/'))

    const lines = await copyCheck(project.actx)

    strictEqual(lines.length, 2, lines.join('\n'))
    ok(/^target ts: 1 file\(s\) in \.sdk are unchanged copies/.test(lines[0]), lines[0])
    ok(lines[0].includes('`npx voxgig-sdkgen package update @voxgig/sdkgen --no-fetch`'),
      lines[0])
    ok(/^target ts: 1 file\(s\) in \.sdk differ from what @voxgig\/sdkgen/.test(lines[1]),
      lines[1])
  })


  test('a project that matches its generator gets no warning', async () => {
    deepStrictEqual(await copyCheck((await added('ts')).actx), [])
  })


  test('generate compares with the values add substituted', async () => {
    // Generation derives `const` later, in the project's Root, so the model
    // it starts with has none. Rendering the copies without it would read
    // every ProjectName placeholder as a change.
    const project = await addedAsTheCli('ts')
    const log = recordLog()
    const { const: _derived, ...unbuilt } = project.actx.model

    await SdkGen({
      fs: underWorkspace(project.actx.fs()), folder: WORKSPACE, pino: log,
    } as any).generate({
      model: unbuilt, root: cmp(function Nothing() { }),
    })

    deepStrictEqual(log.lines.filter((l: any) => 'generate-copies' === l.point), [])
  })


  test('generate warns before it writes, and still generates', async () => {
    const project = await addedAsTheCli('ts')
    ageCopy(project, firstFile(project, 'tm/ts/'))

    const log = recordLog()
    const sdkgen = SdkGen({
      fs: underWorkspace(project.actx.fs()), folder: WORKSPACE, pino: log,
    } as any)

    const res = await sdkgen.generate({
      model: project.actx.model, root: cmp(function Nothing() { }),
    })

    strictEqual(res.ok, true)

    const points = log.lines.map((l: any) => l.point)
    const warned = log.lines.filter((l: any) => 'generate-copies' === l.point)

    strictEqual(warned.length, 1, JSON.stringify(warned))
    strictEqual(warned[0].level, 'warn')
    ok(warned[0].note.includes('package update @voxgig/sdkgen --no-fetch'),
      warned[0].note)
    ok(points.indexOf('generate-copies') < points.indexOf('generate-end'))
  })
})


// `generate` is given the project ROOT and reads `.sdk` beneath it, while the
// harness keeps its `.sdk` at ROOT. This maps one onto the other. `generate`
// resolves the folder, which on Windows adds a drive and backslashes.
const WORKSPACE = '/w'

function underWorkspace(fs: any): any {
  const sdk = WORKSPACE + '/.sdk'
  const map = (arg: any) => {
    if ('string' !== typeof arg) {
      return arg
    }
    const posix = arg.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
    return (sdk === posix || posix.startsWith(sdk + '/')) ?
      ROOT + posix.slice(sdk.length) : arg
  }

  return new Proxy(fs, {
    get(target: any, prop: any) {
      const value = target[prop]
      return 'function' === typeof value ?
        (...args: any[]) => value.apply(target, args.map(map)) : value
    }
  })
}
