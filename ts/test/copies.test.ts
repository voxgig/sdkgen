
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
import { COPIES, fingerprint, readCopies } from '../dist/action/copies.js'
import { SdkGen, projectConst } from '../dist/sdkgen.js'


const SHIPPED = JSON.parse(
  Fs.readFileSync(Path.join(PROJECT, 'sdkgen-package.json'), 'utf8'))


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


// What an older generator leaves behind: a file it wrote, recorded as it
// wrote it, that the installed source now writes differently.
function ageCopy(project: any, rel: string) {
  const path = ROOT + '/' + rel
  const older = String(project.fs.readFileSync(path, 'utf8')) +
    '\n// written by an older generator\n'
  project.fs.writeFileSync(path, older)

  const copies = JSON.parse(String(project.fs.readFileSync(
    ROOT + '/' + COPIES, 'utf8')))
  copies.files[rel] = fingerprint(older)
  project.fs.writeFileSync(ROOT + '/' + COPIES, JSON.stringify(copies))
}


function editCopy(project: any, rel: string) {
  const path = ROOT + '/' + rel
  project.fs.writeFileSync(path,
    String(project.fs.readFileSync(path, 'utf8')) + '\n// a local edit\n')
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


  test('is byte-stable, with sorted keys', async () => {
    const one = String((await added('ts')).fs.readFileSync(ROOT + '/' + COPIES, 'utf8'))
    const two = String((await added('ts')).fs.readFileSync(ROOT + '/' + COPIES, 'utf8'))

    strictEqual(one, two)

    const files = Object.keys(JSON.parse(one).files)
    deepStrictEqual(files, [...files].sort())
  })


  test('a dry run records nothing', async () => {
    const project = await added('ts', { dryrun: true })
    ok(!project.fs.existsSync(ROOT + '/' + COPIES))
  })


  test('remove forgets the item and the files it removed', async () => {
    const project = await added('ts')
    project.actx.flags = {}

    await kind_remove('target', ['ts'], project.actx)

    const copies = record(project)
    strictEqual(copies.items['target/ts'], undefined)
    deepStrictEqual(Object.keys(copies.files)
      .filter((rel: string) => rel.startsWith('tm/ts/') || rel.startsWith('src/cmp/ts/')), [])
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
    project.fs.unlinkSync(ROOT + '/' + COPIES)
    editCopy(project, rel)

    const report: any = (await doctor(project.actx)).report

    deepStrictEqual(report.edited, [rel])
    deepStrictEqual(report.unrecorded, [rel])
    deepStrictEqual(report.outdated, [])
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
