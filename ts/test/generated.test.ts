import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Os from 'node:os'
import Path from 'node:path'

import { memfs } from 'memfs'

import { GENERATED_LOG, readGenerated, pruneGenerated } from '../dist/helpers/generated.js'
import { SdkGen } from '../dist/sdkgen.js'

import {
  STAGE, SCAFFOLD, makeModel, makeRoot, layeredFs, makeLog, namedEntity,
} from './generateharness'


const P = Path.resolve(Os.tmpdir(), 'sdkgen-generated-log')


function abs(rel: string, root = P): string {
  return Path.join(root, ...rel.split('/'))
}


function write(fs: any, rel: string, root = P) {
  fs.mkdirSync(Path.dirname(abs(rel, root)), { recursive: true })
  fs.writeFileSync(abs(rel, root), rel)
}


function quietLog(notes: string[] = []): any {
  const note = (entry: any) => { notes.push(entry.note) }
  return { info: note, warn: note, debug: () => {} }
}


// A generate run into `out` that writes `rels`, as jostraca reports one.
function run(fs: any, rels: string[], opts: {
  out?: string, dryrun?: boolean, notes?: string[],
  declared?: string[], once?: string[], injected?: string[],
} = {}) {
  const out = opts.out ?? P
  if (!opts.dryrun) {
    rels.forEach((rel) => write(fs, rel, out))
  }
  const paths = (list?: string[]) => (list ?? []).map((rel) => abs(rel, out))
  return pruneGenerated({
    fs, log: quietLog(opts.notes), project: P, out, dryrun: !!opts.dryrun,
    jres: { when: 0, files: { written: paths(rels) } },
    claims: {
      files: paths([...(opts.declared ?? []), ...(opts.once ?? [])]),
      once: paths(opts.once),
      injected: paths(opts.injected),
    },
  })
}


function logLines(fs: any): any[] {
  const path = abs('.sdk/' + GENERATED_LOG)
  return fs.existsSync(path) ?
    String(fs.readFileSync(path, 'utf8')).trim().split('\n').map((line: string) => JSON.parse(line)) : []
}


describe('the generated-file record', () => {

  test('the first run into a root records what it wrote and prunes nothing', () => {
    const { fs } = memfs({})
    write(fs, 'ts/old.ts')

    deepStrictEqual(run(fs, ['ts/a.ts']), [])
    ok(fs.existsSync(abs('ts/old.ts')), 'a file no run recorded was removed')
    deepStrictEqual(logLines(fs), [{
      at: '1970-01-01T00:00:00.000Z', op: 'record', root: '.', files: { 'ts/a.ts': true },
    }])
  })

  test('a file an earlier run emitted and this one did not is removed', () => {
    const { fs } = memfs({})
    run(fs, ['ts/a.ts', 'ts/b.ts', 'go/a.go'])

    deepStrictEqual(run(fs, ['ts/a.ts', 'go/a.go']), ['ts/b.ts'])
    strictEqual(fs.existsSync(abs('ts/b.ts')), false)
    ok(fs.existsSync(abs('ts/a.ts')) && fs.existsSync(abs('go/a.go')))
    deepStrictEqual(logLines(fs)[1].files, { 'ts/b.ts': null })
    deepStrictEqual(Array.from(readGenerated(fs, P)['.']).sort(), ['go/a.go', 'ts/a.ts'])
  })

  test('a part of the output the run emitted nothing into keeps its files', () => {
    const { fs } = memfs({})
    run(fs, ['ts/a.ts', 'go/a.go', 'README.md'])

    deepStrictEqual(run(fs, ['ts/a.ts']), [])
    ok(fs.existsSync(abs('go/a.go')) && fs.existsSync(abs('README.md')))
    strictEqual(logLines(fs).length, 1, 'a run that changed nothing wrote a line')
  })

  test('a dry run removes and records nothing', () => {
    const { fs } = memfs({})
    run(fs, ['ts/a.ts', 'ts/b.ts'])

    const notes: string[] = []
    deepStrictEqual(run(fs, ['ts/a.ts'], { dryrun: true, notes }), ['ts/b.ts'])
    ok(fs.existsSync(abs('ts/b.ts')))
    strictEqual(logLines(fs).length, 1)
    ok(notes.includes('would remove ts/b.ts, no longer generated'), notes.join('\n'))
  })

  test('the record is untrusted: only a canonical path inside the root is pruned', () => {
    const { fs } = memfs({})
    for (const rel of ['ts/x.ts', 'ts/y.ts', 'outside.ts']) {
      write(fs, rel)
    }
    write(fs, 'gone.ts', Path.dirname(P))

    fs.mkdirSync(Path.dirname(abs('.sdk/' + GENERATED_LOG)), { recursive: true })
    fs.writeFileSync(abs('.sdk/' + GENERATED_LOG), [
      'not json',
      JSON.stringify({ root: '.', files: 'nothing' }),
      JSON.stringify({ root: '.', files: {
        '../gone.ts': true, [abs('outside.ts')]: true, 'ts/./y.ts': true, 'ts/x.ts': true,
      } }),
    ].join('\n') + '\n')

    deepStrictEqual(run(fs, ['ts/a.ts']), ['ts/x.ts'])
    ok(fs.existsSync(abs('gone.ts', Path.dirname(P))), 'a path outside the root was pruned')
    ok(fs.existsSync(abs('outside.ts')) && fs.existsSync(abs('ts/y.ts')),
      'a path the record spelled another way was pruned')
  })

  test('a path that is no longer a plain file, or that a generated name meets in another case, is kept', () => {
    const { fs } = memfs({})
    run(fs, ['ts/Pet.ts', 'ts/d', 'ts/keep.ts'])
    fs.unlinkSync(abs('ts/d'))
    write(fs, 'ts/d/inner.ts')

    const notes: string[] = []
    deepStrictEqual(run(fs, ['ts/pet.ts', 'ts/keep.ts'], { notes }), [])
    ok(fs.existsSync(abs('ts/Pet.ts')) && fs.existsSync(abs('ts/d/inner.ts')))
    strictEqual(notes.filter((note) => note.startsWith('kept ')).length, 2, notes.join('\n'))
    deepStrictEqual(logLines(fs)[1].files, { 'ts/Pet.ts': null, 'ts/d': null, 'ts/pet.ts': true })
  })

  test('a file reached through a folder that is now a symbolic link is kept', () => {
    const { fs } = memfs({})
    const elsewhere = abs('elsewhere', Path.dirname(P))
    run(fs, ['ts/a.ts', 'ts/sub/b.ts'])
    fs.unlinkSync(abs('ts/sub/b.ts'))
    fs.rmdirSync(abs('ts/sub'))
    write(fs, 'b.ts', elsewhere)
    fs.symlinkSync(elsewhere, abs('ts/sub'))

    const notes: string[] = []
    deepStrictEqual(run(fs, ['ts/a.ts'], { notes }), [])
    ok(fs.existsSync(Path.join(elsewhere, 'b.ts')), 'a file outside the root was removed')
    ok(notes.includes('kept ts/sub/b.ts, no longer generated: a folder above it is a symbolic link'),
      notes.join('\n'))
  })

  test('an emptied directory goes; the root and a directory still holding a file stay', () => {
    const { fs } = memfs({})
    run(fs, ['ts/feature/cache/a.ts', 'ts/feature/cache/b.ts', 'ts/feature/log/c.ts', 'ts/x.ts'])

    run(fs, ['ts/feature/log/c.ts', 'ts/x.ts'])
    strictEqual(fs.existsSync(abs('ts/feature/cache')), false)
    ok(fs.existsSync(abs('ts/feature/log/c.ts')))
  })

  test('a file a component still claims, though it skipped writing it, is kept and not recorded', () => {
    const { fs } = memfs({})
    run(fs, ['ts/a.ts', 'ts/test/control.json'])
    fs.writeFileSync(abs('ts/test/control.json'), 'edited')

    deepStrictEqual(run(fs, ['ts/a.ts'], { declared: ['ts/test/control.json', 'ts/src/tm.ts'] }), [])
    strictEqual(String(fs.readFileSync(abs('ts/test/control.json'))), 'edited')
    strictEqual(logLines(fs).length, 1, 'a claimed file that was not written was recorded')
  })

  test('a file written only when absent is the project\'s: never recorded, so never removed', () => {
    const { fs } = memfs({})
    run(fs, ['ts/a.ts', 'CHANGELOG.md'], { once: ['CHANGELOG.md'] })
    deepStrictEqual(logLines(fs)[0].files, { 'ts/a.ts': true })

    deepStrictEqual(run(fs, ['ts/a.ts', 'README.md']), [])
    ok(fs.existsSync(abs('CHANGELOG.md')), 'the project\'s own file was removed')
  })

  test('a file an Inject edits is not recorded by it, and is kept while one edits it', () => {
    const { fs } = memfs({})
    write(fs, 'ts/own.ts')
    run(fs, ['ts/a.ts', 'ts/b.ts', 'ts/own.ts'], { injected: ['ts/own.ts'] })
    deepStrictEqual(logLines(fs)[0].files, { 'ts/a.ts': true, 'ts/b.ts': true })

    deepStrictEqual(run(fs, ['ts/a.ts', 'ts/b.ts'], { injected: ['ts/b.ts'] }), [])
    ok(fs.existsSync(abs('ts/own.ts')), 'a file only an Inject wrote was removed')
    ok(fs.existsSync(abs('ts/b.ts')), 'a file an Inject still edits was removed')
  })

  test('a file removed by hand leaves the record', () => {
    const { fs } = memfs({})
    run(fs, ['ts/a.ts', 'ts/b.ts'])
    fs.unlinkSync(abs('ts/b.ts'))

    deepStrictEqual(run(fs, ['ts/a.ts']), [])
    deepStrictEqual(logLines(fs)[1].files, { 'ts/b.ts': null })
  })

  test('each output root keeps its own record', () => {
    const { fs } = memfs({})
    const ext = abs('provider')
    run(fs, ['src/a.ts', 'src/b.ts'], { out: ext })
    run(fs, ['ts/a.ts', 'src/z.ts'])

    ok(fs.existsSync(abs('provider/src/b.ts')))
    deepStrictEqual(run(fs, ['src/a.ts'], { out: ext }), ['src/b.ts'])
    deepStrictEqual(logLines(fs).map((line: any) => line.root), ['provider', '.', 'provider'])
  })
})


describe('generation prunes what the model no longer produces', () => {

  // Generates ts and go into `vol`, as one CLI run would, and lists what their
  // folders hold.
  async function generated(
    vol: any, fs: any, opts: { extra?: string, features?: string[] } = {},
  ): Promise<string[]> {
    const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
    const cwd = process.cwd()
    process.chdir(SCAFFOLD)
    try {
      const res = await sdkgen.generate({
        model: makeModel(['ts', 'go'], undefined, opts.extra, opts.features), root: makeRoot() })
      strictEqual(res.ok, true)
    }
    finally {
      process.chdir(cwd)
    }
    return Object.keys(vol.toJSON())
      .map((path) => Path.relative(STAGE, path).split(Path.sep).join('/'))
      .filter((rel) => /^(ts|go)\//.test(rel))
      .sort()
  }


  test('an entity the model drops takes its generated files with it', async () => {
    const { fs, vol } = memfs({})

    const before = await generated(vol, fs, { extra: namedEntity('comet') })
    const comet = before.filter((rel) => /comet/i.test(rel))
    ok(comet.some((rel) => rel.startsWith('ts/')) && comet.some((rel) => rel.startsWith('go/')),
      'the fixture generated no comet files to prune: ' + comet.join(', '))

    // Written once, then the project's: no later run rewrites or reports it.
    const control = Path.join(STAGE, 'ts', 'test', 'sdk-test-control.json')
    ok(before.includes('ts/test/sdk-test-control.json'))
    const recorded = readGenerated(fs, STAGE)['.']
    ok(0 < (recorded?.size ?? 0), 'the first run recorded nothing')
    strictEqual(recorded.has('ts/test/sdk-test-control.json'), false,
      'the record claims a file the component writes only when it is absent')
    fs.writeFileSync(control, '{"edited":true}')

    const after = await generated(vol, fs)
    strictEqual(String(fs.readFileSync(control)), '{"edited":true}',
      'the project\'s own control file was removed or rewritten')
    deepStrictEqual(after.filter((rel) => /comet/i.test(rel)), [],
      'a dropped entity left files behind')
    deepStrictEqual(after, before.filter((rel) => !/comet/i.test(rel)),
      'pruning removed or added something else')
  })


  test('a plugin group, then the feature, switched off takes its source with it', async () => {
    const features = ['test', 'log', 'secrets']
    const on = 'main: kit: feature: secrets: active: true'
    const vault = on + '\nmain: kit: feature: secrets: plugin: vault: active: true'
    const grouped = (rel: string) => /hashicorp|boru/i.test(rel)
    const secret = (rel: string) => /secrets/i.test(rel)
    const afresh = (extra?: string) => {
      const fresh = memfs({})
      return generated(fresh.vol, fresh.fs, { features, extra })
    }
    const { fs, vol } = memfs({})

    const before = await generated(vol, fs, { features, extra: vault })
    ok(before.filter(grouped).some((rel) => rel.startsWith('ts/')) &&
      before.filter(grouped).some((rel) => rel.startsWith('go/')),
    'the fixture generated no vault plugin source to prune')

    const ungrouped = await generated(vol, fs, { features, extra: on })
    deepStrictEqual(ungrouped.filter(grouped), [], 'a plugin group switched off left its source')
    ok(ungrouped.some(secret), 'the feature went with its plugin group')
    deepStrictEqual(ungrouped, await afresh(on),
      'regenerating in place left a different file set from generating afresh')

    const off = await generated(vol, fs, { features })
    deepStrictEqual(off.filter(secret), [], 'a feature switched off left its source')
    deepStrictEqual(off, await afresh(),
      'regenerating in place left a different file set from generating afresh')
  })
})
