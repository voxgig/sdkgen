import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects } from 'node:assert'

import { memfs } from 'memfs'

import { withCopyMerge } from '../dist/helpers/copymerge.js'
import { fingerprint } from '../dist/action/copies.js'

import { ROOT, makeProject, recordLog, targetRef, target_add } from './actionharness'
import { doctor, copyCheck } from '../dist/action/doctor.js'
import { package_update } from '../dist/action/package.js'
import { readCopies } from '../dist/action/copies.js'


const DIR = '/p'

const BASE = 'one\ntwo\nthree\nfour\nfive\n'
const INCOMING = 'ONE\ntwo\nthree\nfour\nfive\n'


function fixture(files: Record<string, string>, recorded: Record<string, string> = {}) {
  const { fs } = memfs({})
  fs.mkdirSync(DIR, { recursive: true })
  for (const [rel, text] of Object.entries(files)) {
    const abs = DIR + '/' + rel
    fs.mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true })
    fs.writeFileSync(abs, text)
  }

  const record: Record<string, string> = {}
  for (const [rel, text] of Object.entries(recorded)) {
    record[rel] = fingerprint(text)
  }

  const log = recordLog()

  const spec = (over: any = {}) => ({
    fs,
    folder: DIR,
    log,
    mode: 'merge',
    what: 'target add ts',
    manage: (rel: string) => rel.startsWith('tm/'),
    recorded: (rel: string) => record[rel],
    fingerprint,
    basedir: 'log/base',
    conflictdir: 'log/conflict',
    ...over,
  })

  const read = (rel: string) => {
    const abs = DIR + '/' + rel
    return fs.existsSync(abs) ? String(fs.readFileSync(abs, 'utf8')) : undefined
  }

  return { fs, log, spec, read }
}


// An add's write, as jostraca makes it: a temp file renamed over the target.
function atomicWrite(fs: any, rel: string, text: string) {
  const abs = DIR + '/' + rel
  fs.writeFileSync(abs + '.tmp', text)
  fs.renameSync(abs + '.tmp', abs)
}


describe('copy merge', () => {

  test('an untouched copy takes the incoming copy', async () => {
    const f = fixture({ 'tm/a.ts': BASE }, { 'tm/a.ts': BASE })

    await withCopyMerge(f.spec(), async (fs: any) => atomicWrite(fs, 'tm/a.ts', INCOMING))

    strictEqual(f.read('tm/a.ts'), INCOMING)
    strictEqual(f.read('log/base/tm/a.ts'), undefined)
  })


  test('a local change in other lines is merged with the incoming copy', async () => {
    const local = BASE + 'six (local)\n'
    const f = fixture({ 'tm/a.ts': local, 'log/base/tm/a.ts': BASE }, { 'tm/a.ts': BASE })

    let seen: string | undefined
    await withCopyMerge(f.spec(), async (fs: any) => {
      atomicWrite(fs, 'tm/a.ts', INCOMING)
      seen = String(fs.readFileSync(DIR + '/tm/a.ts', 'utf8'))
    })

    strictEqual(seen, INCOMING, 'the run reads what it wrote')
    strictEqual(f.read('tm/a.ts'), INCOMING + 'six (local)\n')
    strictEqual(f.read('log/base/tm/a.ts'), INCOMING)
  })


  test('the base can come from an earlier version of the file', async () => {
    const local = BASE + 'six (local)\n'
    const f = fixture({ 'tm/a.ts': local }, { 'tm/a.ts': BASE })

    await withCopyMerge(f.spec({
      versions: () => [Buffer.from(local), Buffer.from(BASE)],
    }), async (fs: any) => fs.writeFileSync(DIR + '/tm/a.ts', INCOMING))

    strictEqual(f.read('tm/a.ts'), INCOMING + 'six (local)\n')
  })


  test('a conflict changes nothing, and leaves the incoming copy to read', async () => {
    const local = 'one (local)\ntwo\nthree\nfour\nfive\n'
    const f = fixture({
      'tm/a.ts': local, 'log/base/tm/a.ts': BASE,
      'tm/b.ts': BASE, 'log/copies.jsonl': '{}\n',
    }, { 'tm/a.ts': BASE, 'tm/b.ts': BASE })

    await rejects(withCopyMerge(f.spec(), async (fs: any) => {
      atomicWrite(fs, 'tm/b.ts', INCOMING)
      atomicWrite(fs, 'tm/a.ts', INCOMING)
      fs.mkdirSync(DIR + '/tm/fresh', { recursive: true })
      fs.writeFileSync(DIR + '/tm/fresh/c.ts', 'c\n')
      fs.appendFileSync(DIR + '/log/copies.jsonl', '{"op":"add"}\n')
    }), (err: any) => {
      ok(err.message.includes('tm/a.ts'), err.message)
      ok(err.message.includes('--keep') && err.message.includes('--force'), err.message)
      return true
    })

    strictEqual(f.read('tm/a.ts'), local)
    strictEqual(f.read('tm/b.ts'), BASE, 'the clean file is rolled back too')
    strictEqual(f.read('tm/fresh/c.ts'), undefined)
    ok(!f.fs.existsSync(DIR + '/tm/fresh'), 'a folder the run made is removed')
    strictEqual(f.read('log/copies.jsonl'), '{}\n')
    strictEqual(f.read('log/base/tm/a.ts'), BASE, 'the base stays where it was')

    const preview = f.read('log/conflict/tm/a.ts') as string
    ok(preview.includes('<<<<<<< LOCAL'), preview)
    ok(preview.includes('>>>>>>> INCOMING (target add ts)'), preview)
    strictEqual(f.read('log/conflict/.gitignore'), '*\n')
  })


  test('--keep keeps the local file and records the incoming copy as its base', async () => {
    const local = 'one (local)\ntwo\nthree\nfour\nfive\n'
    const f = fixture({ 'tm/a.ts': local, 'log/base/tm/a.ts': BASE }, { 'tm/a.ts': BASE })

    await withCopyMerge(f.spec({ keep: true }),
      async (fs: any) => atomicWrite(fs, 'tm/a.ts', INCOMING))

    strictEqual(f.read('tm/a.ts'), local)
    strictEqual(f.read('log/base/tm/a.ts'), INCOMING)
  })


  test('--force and overwrite mode take the incoming copy', async () => {
    for (const over of [{ force: true }, { mode: 'overwrite' }]) {
      const f = fixture({ 'tm/a.ts': 'local\n' }, { 'tm/a.ts': BASE })
      await withCopyMerge(f.spec(over),
        async (fs: any) => atomicWrite(fs, 'tm/a.ts', INCOMING))
      strictEqual(f.read('tm/a.ts'), INCOMING, JSON.stringify(over))
    }
  })


  test('a forced run clears the previews a stopped run left', async () => {
    const f = fixture({ 'tm/a.ts': 'local\n' })

    await rejects(withCopyMerge(f.spec(),
      async (fs: any) => atomicWrite(fs, 'tm/a.ts', INCOMING)))
    strictEqual(f.read('log/conflict/tm/a.ts'), INCOMING)

    await withCopyMerge(f.spec({ force: true }),
      async (fs: any) => atomicWrite(fs, 'tm/a.ts', INCOMING))
    strictEqual(f.read('log/conflict/tm/a.ts'), undefined)
  })


  test('a changed file the record does not hold cannot be merged', async () => {
    const f = fixture({ 'tm/a.ts': 'local\n' })

    await rejects(withCopyMerge(f.spec(),
      async (fs: any) => atomicWrite(fs, 'tm/a.ts', INCOMING)),
      (err: any) => /no record of what the toolchain wrote here/.test(err.message) &&
        /Commit, then re-run with --force/.test(err.message) &&
        !/re-run with --keep/.test(err.message))

    strictEqual(f.read('tm/a.ts'), 'local\n')
    strictEqual(f.read('log/conflict/tm/a.ts'), INCOMING)
  })


  test('--keep on a file the record does not hold records no base for it', async () => {
    const f = fixture({ 'tm/a.ts': 'local\n' })
    const forgotten: string[][] = []

    await withCopyMerge(f.spec({ keep: true, forget: (rels: string[]) => forgotten.push(rels) }),
      async (fs: any) => atomicWrite(fs, 'tm/a.ts', INCOMING))

    strictEqual(f.read('tm/a.ts'), 'local\n')
    strictEqual(f.read('log/base/tm/a.ts'), undefined)
    deepStrictEqual(forgotten, [['tm/a.ts']])

    const kept = f.log.lines.find((l: any) => 'copy-merge-kept' === l.point)
    deepStrictEqual(kept.unrecorded, ['tm/a.ts'])
  })


  test('a file still holding conflict markers is not merged over', async () => {
    const local = '<<<<<<< LOCAL\none\n=======\nONE\n>>>>>>> INCOMING (x)\ntwo\nthree\nfour\nfive\n'
    const f = fixture({ 'tm/a.ts': local, 'log/base/tm/a.ts': BASE }, { 'tm/a.ts': BASE })

    await rejects(withCopyMerge(f.spec(),
      async (fs: any) => atomicWrite(fs, 'tm/a.ts', INCOMING + 'six\n')))

    strictEqual(f.read('tm/a.ts'), local)
  })


  test('a delete spares changed files and files no add wrote', async () => {
    const f = fixture({
      'tm/edited.ts': 'local\n', 'tm/mine.ts': 'mine\n', 'tm/old.ts': BASE,
      'log/base/tm/old.ts': BASE,
    }, { 'tm/edited.ts': BASE, 'tm/old.ts': BASE })

    const out = await withCopyMerge(f.spec(), async (fs: any) => {
      for (const rel of ['tm/edited.ts', 'tm/mine.ts', 'tm/old.ts']) {
        fs.unlinkSync(DIR + '/' + rel)
      }
      return 'done'
    })

    strictEqual(out, 'done')
    strictEqual(f.read('tm/edited.ts'), 'local\n')
    strictEqual(f.read('tm/mine.ts'), 'mine\n')
    strictEqual(f.read('tm/old.ts'), undefined)
    strictEqual(f.read('log/base/tm/old.ts'), undefined)
  })


  test('a failing run is rolled back', async () => {
    const f = fixture({ 'tm/a.ts': BASE }, { 'tm/a.ts': BASE })

    await rejects(withCopyMerge(f.spec(), async (fs: any) => {
      atomicWrite(fs, 'tm/a.ts', INCOMING)
      throw new Error('boom')
    }), /boom/)

    strictEqual(f.read('tm/a.ts'), BASE)
  })


  test('a binary file is never merged', async () => {
    const f = fixture({ 'tm/a.bin': 'lo\u0000cal' }, { 'tm/a.bin': 'ba\u0000se' })

    await rejects(withCopyMerge(f.spec({ versions: () => [Buffer.from('ba\u0000se')] }),
      async (fs: any) => fs.writeFileSync(DIR + '/tm/a.bin', 'in\u0000coming')),
      /binary/)
  })


  test('files outside the managed set are written through', async () => {
    const f = fixture({ 'model/x.aontu': 'local\n' })

    await withCopyMerge(f.spec(), async (fs: any) =>
      fs.writeFileSync(DIR + '/model/x.aontu', 'incoming\n'))

    strictEqual(f.read('model/x.aontu'), 'incoming\n')
  })
})


describe('target add in merge mode', () => {

  function firstTemplate(project: any): string {
    const rel = Object.keys(readCopies(project.actx.fs(), ROOT).files)
      .find((rel: string) => rel.startsWith('tm/ts/') && rel.endsWith('.ts'))
    ok(null != rel)
    return rel as string
  }


  test('a local edit to a template survives a resync', async () => {
    const project = makeProject()
    await target_add([targetRef('ts')], project.actx)

    const rel = firstTemplate(project)
    const path = ROOT + '/' + rel
    const edited = String(project.fs.readFileSync(path, 'utf8')) + '\n// a local edit\n'
    project.fs.writeFileSync(path, edited)

    await target_add([targetRef('ts')], project.actx)

    strictEqual(String(project.fs.readFileSync(path, 'utf8')), edited)

    const res: any = await doctor(project.actx)
    ok(res.report.customized.includes(rel), JSON.stringify(res.report.customized))
    ok(res.report.ok, 'a customization is not drift in merge mode')
  })


  test('a local edit takes an upstream change in other lines', async () => {
    const project = makeProject()
    await target_add([targetRef('ts')], project.actx)

    const rel = firstTemplate(project)
    const path = ROOT + '/' + rel
    const current = String(project.fs.readFileSync(path, 'utf8'))

    // What an older source wrote: the current copy with a different first line.
    const lines = current.split('\n')
    const older = ['// an older first line', ...lines.slice(1)].join('\n')
    project.fs.writeFileSync(path, older + '\n// a local edit\n')
    project.fs.mkdirSync(ROOT + '/log/base/' + rel.slice(0, rel.lastIndexOf('/')), { recursive: true })
    project.fs.writeFileSync(ROOT + '/log/base/' + rel, older)
    project.fs.appendFileSync(ROOT + '/log/copies.jsonl',
      JSON.stringify({ op: 'add', files: { [rel]: fingerprint(older) } }) + '\n')

    await target_add([targetRef('ts')], project.actx)

    strictEqual(String(project.fs.readFileSync(path, 'utf8')), current + '\n// a local edit\n')
    strictEqual(String(project.fs.readFileSync(ROOT + '/log/base/' + rel, 'utf8')), current)
  })


  test('package update merges into a local edit rather than refusing', async () => {
    const project = makeProject()
    await target_add([targetRef('ts')], project.actx)

    const rel = firstTemplate(project)
    const path = ROOT + '/' + rel
    const edited = String(project.fs.readFileSync(path, 'utf8')) + '\n// a local edit\n'
    project.fs.writeFileSync(path, edited)

    project.actx.flags = { nofetch: true }
    await package_update(['@voxgig/sdkgen'], project.actx)

    strictEqual(String(project.fs.readFileSync(path, 'utf8')), edited)
  })


  // A project from before the copy record: nothing tells its older copies
  // from local changes, so --keep must not pass them off as customizations.
  test('--keep on a copy with no record leaves doctor reporting it', async () => {
    const project = makeProject()
    await target_add([targetRef('ts')], project.actx)

    const rel = firstTemplate(project)
    const path = ROOT + '/' + rel
    project.fs.writeFileSync(path,
      '// an older generator\n' + String(project.fs.readFileSync(path, 'utf8')))
    project.fs.unlinkSync(ROOT + '/log/copies.jsonl')

    await rejects(target_add([targetRef('ts')], project.actx),
      (err: any) => /Commit, then re-run with --force/.test(err.message))

    project.actx.flags = { keep: true }
    await target_add([targetRef('ts')], project.actx)

    const report: any = (await doctor(project.actx)).report
    strictEqual(report.ok, false, 'a kept copy with no record is not a customization')
    deepStrictEqual(report.unrecorded, [rel])
    deepStrictEqual(report.customized, [])
    ok(!project.fs.existsSync(ROOT + '/log/base/' + rel))
  })


  // A kept copy that never took the incoming change breaks every copy that
  // imports what the change added.
  test('a kept copy lacking a name the incoming copy exports is a finding', async () => {
    const log = recordLog()
    const project = makeProject({ log })
    await target_add([targetRef('ts')], project.actx)

    const rel = 'src/cmp/ts/utility_ts.ts'
    const path = ROOT + '/' + rel
    const current = String(project.fs.readFileSync(path, 'utf8'))
    ok(current.includes('  projectPath,\n  exampleValue,\n}'), 'the export list moved')

    const older = current.replace('  exampleValue,\n', '')
    project.fs.mkdirSync(ROOT + '/log/base/src/cmp/ts', { recursive: true })
    project.fs.writeFileSync(ROOT + '/log/base/' + rel, older)
    project.fs.appendFileSync(ROOT + '/log/copies.jsonl',
      JSON.stringify({ op: 'add', files: { [rel]: fingerprint(older) } }) + '\n')
    project.fs.writeFileSync(path, older.replace('  projectPath,\n}', '  projectPath,\n  localHelper,\n}'))

    await rejects(target_add([targetRef('ts')], project.actx),
      (err: any) => err.message.includes(rel) && /re-run with\s+--keep/.test(err.message))

    project.actx.flags = { keep: true }
    await target_add([targetRef('ts')], project.actx)

    const kept = log.lines.find((l: any) => 'copy-merge-kept' === l.point)
    deepStrictEqual(kept.lacking, { [rel]: ['exampleValue'] })

    const report: any = (await doctor(project.actx)).report
    deepStrictEqual(report.unfolded, [{ file: rel, item: 'target/ts', names: ['exampleValue'] }])
    ok(report.customized.includes(rel), JSON.stringify(report.customized))
    strictEqual(report.ok, false)

    const lines = await copyCheck(project.actx)
    ok(lines.some((line: string) => line.startsWith(rel + ': lacks exampleValue') &&
      line.includes('`npx voxgig-sdkgen target add ts --force`')), lines.join('\n'))
  })


  test('overwrite mode reverts a local edit, as a full regeneration wants', async () => {
    const project = makeProject()
    project.actx.model.main.kit.copies = 'overwrite'
    await target_add([targetRef('ts')], project.actx)

    const rel = firstTemplate(project)
    const path = ROOT + '/' + rel
    const original = String(project.fs.readFileSync(path, 'utf8'))
    project.fs.writeFileSync(path, original + '\n// a local edit\n')

    await target_add([targetRef('ts')], project.actx)

    strictEqual(String(project.fs.readFileSync(path, 'utf8')), original)
    deepStrictEqual((await doctor(project.actx) as any).report.customized, [])
  })
})
