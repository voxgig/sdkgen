import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { memfs } from 'memfs'

import { GENERATED_LOG, readGenerated, pruneGenerated } from '../dist/helpers/generated.js'
import {
  SdkGen, cmp, each, names, Project, Folder, File, Content, Main, PublishWorkflow,
} from '../dist/sdkgen.js'

import {
  KIT, STAGE, SCAFFOLD, makeModel, makeRoot, layeredFs, makeLog, namedEntity,
} from './generateharness'


const P = Path.resolve(Os.tmpdir(), 'sdkgen-generated-log')

// The scope every simulated file belongs to unless a test names another.
const GEN = 'gen'


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


type RunOpts = {
  out?: string, dryrun?: boolean, notes?: string[],
  declared?: string[], once?: string[], injected?: string[],
  // Paths a save visited and declined to write.
  skipped?: string[],
  // Written paths with no File claim of their own, as a Copy's are.
  copied?: string[],
  copies?: { to: string, owner: string }[],
  owners?: Record<string, string>,
  scopes?: string[],
  // Report and claim every path relative to the working directory.
  cwdrel?: boolean,
}


// A generate run into `out` that writes `rels`, as jostraca reports one: the
// result lists, the audit of every save, and the claims of the tree.
function run(fs: any, rels: string[], opts: RunOpts = {}) {
  const out = opts.out ?? P
  if (!opts.dryrun) {
    rels.forEach((rel) => write(fs, rel, out))
  }
  const path = (rel: string) =>
    opts.cwdrel ? Path.relative(process.cwd(), abs(rel, out)) : abs(rel, out)
  const paths = (list?: string[]) => (list ?? []).map(path)
  const decision = (action: string, protect: boolean) => (rel: string) =>
    ['FileHandler:save:' + action, { action, actions: [action], protect, path: path(rel) }]

  // A File claim for each written path a Copy or an Inject did not write.
  const files: Record<string, string> = {}
  const unclaimed = [...(opts.copied ?? []), ...(opts.injected ?? [])]
  for (const rel of [...rels.filter((rel) => !unclaimed.includes(rel)),
    ...(opts.declared ?? []), ...(opts.once ?? [])]) {
    files[path(rel)] = opts.owners?.[rel] ?? GEN
  }

  return pruneGenerated({
    fs, log: quietLog(opts.notes), project: P, out, dryrun: !!opts.dryrun,
    jres: {
      when: 0,
      files: { written: paths(rels) },
      audit: () => [
        ...rels.map(decision('write', false)),
        ...(opts.skipped ?? []).map(decision('skip', true)),
      ],
    },
    claims: {
      files,
      once: paths(opts.once),
      injected: paths(opts.injected),
      copies: (opts.copies ?? []).map((copy) => ({ to: path(copy.to), owner: copy.owner })),
      scopes: opts.scopes ?? [GEN],
    } as any,
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
      at: '1970-01-01T00:00:00.000Z', op: 'record', root: '.', files: { 'ts/a.ts': GEN },
    }])
  })

  test('a file an earlier run emitted and this one did not is removed', () => {
    const { fs } = memfs({})
    run(fs, ['ts/a.ts', 'ts/b.ts', 'go/a.go'])

    deepStrictEqual(run(fs, ['ts/a.ts', 'go/a.go']), ['ts/b.ts'])
    strictEqual(fs.existsSync(abs('ts/b.ts')), false)
    ok(fs.existsSync(abs('ts/a.ts')) && fs.existsSync(abs('go/a.go')))
    deepStrictEqual(logLines(fs)[1].files, { 'ts/b.ts': null })
    deepStrictEqual(Array.from(readGenerated(fs, P)['.'].keys()).sort(), ['go/a.go', 'ts/a.ts'])
  })

  test('a file whose scope did not run is kept: a target switched off', () => {
    const { fs } = memfs({})
    const owners = { 'ts/a.ts': 'Root/Main@ts', 'go/a.go': 'Root/Main@go', 'README.md': 'Root/Top' }
    run(fs, ['ts/a.ts', 'go/a.go', 'README.md'], { owners, scopes: Object.values(owners) })

    deepStrictEqual(run(fs, ['ts/a.ts'], { owners, scopes: ['Root/Main@ts'] }), [])
    ok(fs.existsSync(abs('go/a.go')) && fs.existsSync(abs('README.md')))
    strictEqual(logLines(fs).length, 1, 'a run that changed nothing wrote a line')
  })

  test('a file whose scope did not run is kept: a phase switched off, in a folder other scopes still write into', () => {
    const { fs } = memfs({})
    const owners = {
      '.sdk/test/entity/planet/PlanetTestData.json': 'Root/BuildSDK',
      '.sdk/PUBLISHING.md': 'Root/Top/PublishWorkflow',
      'ts/README.md': 'Root/Readme@ts',
      'ts/test/readme_examples.test.ts': 'Root/Test/Test_ts@ts',
      'ts/package.json': 'Root/Main/Main_ts@ts',
    }
    const all = Object.keys(owners)
    run(fs, all, { owners, scopes: Object.values(owners) })
    fs.writeFileSync(abs('.sdk/test/entity/planet/PlanetTestData.json'), '{"edited":true}')
    fs.writeFileSync(abs('ts/README.md'), '# mine')

    const live = ['.sdk/PUBLISHING.md', 'ts/package.json']
    deepStrictEqual(run(fs, live, { owners, scopes: live.map((rel) => owners[rel as keyof typeof owners]) }), [])
    strictEqual(String(fs.readFileSync(abs('.sdk/test/entity/planet/PlanetTestData.json'))), '{"edited":true}',
      'the test data of a build phase switched off was removed')
    strictEqual(String(fs.readFileSync(abs('ts/README.md'))), '# mine',
      'the README of a readme phase switched off was removed')
    ok(fs.existsSync(abs('ts/test/readme_examples.test.ts')),
      'a test of a test phase switched off was removed')
    strictEqual(logLines(fs).length, 1, 'a run that changed nothing wrote a line')

    deepStrictEqual(run(fs, live, { owners, scopes: Object.values(owners) }),
      ['.sdk/test/entity/planet/PlanetTestData.json', 'ts/README.md', 'ts/test/readme_examples.test.ts'])
    strictEqual(fs.existsSync(abs('.sdk/test/entity')), false)
  })

  test('a file jostraca saw and declined to write is kept and stays recorded', () => {
    const { fs } = memfs({})
    run(fs, ['ts/a.ts', 'ts/src/utility/Fetcher.ts'])
    fs.writeFileSync(abs('ts/src/utility/Fetcher.ts'), 'JOSTRACA_PROTECT edited')

    deepStrictEqual(run(fs, ['ts/a.ts'], { skipped: ['ts/src/utility/Fetcher.ts'] }), [])
    strictEqual(String(fs.readFileSync(abs('ts/src/utility/Fetcher.ts'))), 'JOSTRACA_PROTECT edited')
    strictEqual(logLines(fs).length, 1, 'a skipped file changed the record')
    ok(readGenerated(fs, P)['.'].has('ts/src/utility/Fetcher.ts'))
  })

  test('a file carrying the JOSTRACA_PROTECT marker is never removed, though nothing produces it', () => {
    const { fs } = memfs({})
    run(fs, ['ts/a.ts', 'ts/b.ts'])
    fs.writeFileSync(abs('ts/b.ts'), '// JOSTRACA_PROTECT\nmine')

    const notes: string[] = []
    deepStrictEqual(run(fs, ['ts/a.ts'], { notes }), [])
    strictEqual(String(fs.readFileSync(abs('ts/b.ts'))), '// JOSTRACA_PROTECT\nmine')
    ok(notes.includes('kept ts/b.ts, no longer generated: it carries the JOSTRACA_PROTECT marker'),
      notes.join('\n'))
    deepStrictEqual(logLines(fs)[1].files, { 'ts/b.ts': null })
  })

  test('a run reporting paths relative to the working directory is recorded; a path outside the root is a warning', () => {
    const { fs } = memfs({})
    const notes: string[] = []
    deepStrictEqual(run(fs, ['ts/a.ts', 'ts/b.ts'], { cwdrel: true, notes }), [])
    deepStrictEqual(logLines(fs)[0].files, { 'ts/a.ts': GEN, 'ts/b.ts': GEN })
    strictEqual(notes.length, 0, notes.join("\n"))

    deepStrictEqual(run(fs, ['ts/a.ts'], { cwdrel: true, notes }), ['ts/b.ts'])

    const elsewhere = Path.join(Path.dirname(P), 'elsewhere', 'c.ts')
    pruneGenerated({
      fs, log: quietLog(notes), project: P, out: P, dryrun: false,
      jres: { when: 0, files: { written: [abs('ts/a.ts'), elsewhere] } },
      claims: { files: { [abs('ts/a.ts')]: GEN }, once: [], injected: [], copies: [], scopes: [GEN] } as any,
    })
    ok(notes.some((note) => note.includes('1 path(s) resolve outside ' + P) && note.includes(elsewhere)),
      notes.join('\n'))
    strictEqual(logLines(fs).length, 2, 'a path outside the root was recorded')
  })

  test('a file a Copy wrote belongs to the scope that copied it', () => {
    const { fs } = memfs({})
    const copies = [{ to: 'ts/src', owner: 'Root/Main@ts' }, { to: 'ts/src/feature', owner: 'Root/Feature@ts' }]
    const copied = ['ts/src/utility/Fetcher.ts', 'ts/src/feature/log/Log.ts']
    run(fs, ['ts/package.json', ...copied], {
      copied, copies, owners: { 'ts/package.json': 'Root/Main@ts' },
      scopes: ['Root/Main@ts', 'Root/Feature@ts'],
    })
    deepStrictEqual(logLines(fs)[0].files, {
      'ts/package.json': 'Root/Main@ts',
      'ts/src/feature/log/Log.ts': 'Root/Feature@ts',
      'ts/src/utility/Fetcher.ts': 'Root/Main@ts',
    })

    deepStrictEqual(run(fs, ['ts/package.json'], {
      copies, owners: { 'ts/package.json': 'Root/Main@ts' }, scopes: ['Root/Main@ts'],
    }), ['ts/src/utility/Fetcher.ts'])
    ok(fs.existsSync(abs('ts/src/feature/log/Log.ts')), 'a file of a scope that did not run was removed')
  })

  test('a file no scope accounts for is recorded and kept, with a warning', () => {
    const { fs } = memfs({})
    const notes: string[] = []
    run(fs, ['ts/a.ts', 'ts/loose.ts'], { copied: ['ts/loose.ts'], notes })
    deepStrictEqual(logLines(fs)[0].files, { 'ts/a.ts': GEN, 'ts/loose.ts': '' })
    ok(notes.some((note) => note.includes('recorded but never removed: ts/loose.ts')), notes.join('\n'))

    deepStrictEqual(run(fs, ['ts/a.ts']), [])
    ok(fs.existsSync(abs('ts/loose.ts')))
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
        '../gone.ts': GEN, [abs('outside.ts')]: GEN, 'ts/./y.ts': GEN, 'ts/x.ts': GEN,
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
    deepStrictEqual(logLines(fs)[1].files, { 'ts/Pet.ts': null, 'ts/d': null, 'ts/pet.ts': GEN })
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
    deepStrictEqual(logLines(fs)[0].files, { 'ts/a.ts': GEN })

    deepStrictEqual(run(fs, ['ts/a.ts', 'README.md']), [])
    ok(fs.existsSync(abs('CHANGELOG.md')), 'the project\'s own file was removed')
  })

  test('a file an Inject edits is not recorded by it, and is kept while one edits it', () => {
    const { fs } = memfs({})
    write(fs, 'ts/own.ts')
    run(fs, ['ts/a.ts', 'ts/b.ts', 'ts/own.ts'], { injected: ['ts/own.ts'] })
    deepStrictEqual(logLines(fs)[0].files, { 'ts/a.ts': GEN, 'ts/b.ts': GEN })

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

  type Generation = {
    extra?: string, features?: string[], targets?: string[], folder?: string, root?: any,
  }


  // Generates the targets (ts and go) into `vol`, as one CLI run would, and
  // lists what their folders hold. Every file must be traced to a scope and
  // lie inside the root, or the record is silently inert for it.
  async function generated(vol: any, fs: any, opts: Generation = {}): Promise<string[]> {
    const targets = opts.targets ?? ['ts', 'go']
    const entries: any[] = []
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: opts.folder ?? STAGE, root: '', pino: makeLog(entries) })
    const cwd = process.cwd()
    process.chdir(SCAFFOLD)
    try {
      const res = await sdkgen.generate({
        model: makeModel(targets, undefined, opts.extra, opts.features),
        root: opts.root ?? makeRoot() })
      strictEqual(res.ok, true)
    }
    finally {
      process.chdir(cwd)
    }
    deepStrictEqual(entries.filter((entry) =>
      'generate-record-unowned' === entry.point || 'generate-record-outside' === entry.point)
      .map((entry) => entry.note), [])
    return Object.keys(vol.toJSON())
      .map((path) => Path.relative(STAGE, path).split(Path.sep).join('/'))
      .filter((rel) => targets.includes(rel.split('/')[0]))
      .sort()
  }


  // The standard Root's phases that both write into `.sdk/`: Top, whose
  // PublishWorkflow documents an npm target there, and BuildSDK, which writes
  // the per-entity test data. `main: false` leaves out every component loaded
  // from the output folder.
  function sdkRoot(opts: { main?: boolean } = {}): any {
    const Top = cmp(function Top() {
      PublishWorkflow({})
    })

    const BuildSDK = cmp(function BuildSDK(props: any) {
      const entity = props.ctx$.model.main[KIT].entity
      Folder({ name: '.sdk' }, () => Folder({ name: 'test' }, () => Folder({ name: 'entity' }, () => {
        each(entity, (entity: any) => {
          names(entity, entity.name)
          Folder({ name: entity.name }, () => File({ name: entity.Name + 'TestData.json' }, () =>
            Content('{"generated":true}')))
        })
      })))
    })

    return cmp(function Root(props: any) {
      const { model, ctx$ } = props
      model.const = { name: model.name }
      names(model.const, model.name)
      names(model, model.name)
      ctx$.model = model
      ctx$.stdrep = {}
      names(ctx$.stdrep, model.Name, 'ProjectName')

      const phase = model.main[KIT].phase || {}
      Project({}, () => {
        if (false !== phase.top?.active) Top({})
        if (false !== phase.build?.active) BuildSDK({})
        each(false === opts.main ? {} : model.main[KIT].target, (target: any) => {
          names(target, target.name)
          Folder({ name: target.name }, () => Main({ target }))
        })
      })
    })
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


  test('a phase switched off keeps what it generated, inside a target still generated', async () => {
    const { fs, vol } = memfs({})
    const readme = Path.join(STAGE, 'ts', 'README.md')

    const before = await generated(vol, fs)
    ok(before.includes('ts/README.md'))
    fs.writeFileSync(readme, '# mine')

    const after = await generated(vol, fs, { extra: 'main: kit: target: ts: phase: readme: active: false' })
    strictEqual(String(fs.readFileSync(readme)), '# mine', 'the README of a phase switched off was removed')
    deepStrictEqual(after, before, 'a phase switched off changed the file set')

    const back = await generated(vol, fs)
    strictEqual(String(fs.readFileSync(readme)).startsWith('# mine'), false,
      'the phase switched back on did not regenerate its README')
    deepStrictEqual(back, before)
  })


  test('a template file the project protected is kept, and a protected file nothing produces stays', async () => {
    const { fs, vol } = memfs({})

    const before = await generated(vol, fs, { extra: namedEntity('comet') })
    const copied = before.find((rel) => rel.startsWith('ts/src/utility/'))
    const comet = before.find((rel) => rel.startsWith('ts/') && /comet/i.test(rel))
    ok(null != copied && null != comet, 'the fixture generated nothing to protect')
    for (const rel of [copied, comet]) {
      const path = Path.join(STAGE, rel as string)
      fs.writeFileSync(path, '// JOSTRACA_PROTECT\n' + String(fs.readFileSync(path)))
    }

    const after = await generated(vol, fs)
    for (const rel of [copied, comet]) {
      ok(String(fs.readFileSync(Path.join(STAGE, rel as string))).startsWith('// JOSTRACA_PROTECT'),
        rel + ' was rewritten or removed')
    }
    deepStrictEqual(after.filter((rel) => /comet/i.test(rel)), [comet],
      'the dropped entity left files other than the protected one')
  })


  test('the build phase switched off keeps the test data, though Top still writes into .sdk/', async () => {
    const { fs, vol } = memfs({})
    const data = Path.join(STAGE, '.sdk', 'test', 'entity', 'planet', 'PlanetTestData.json')
    const publishing = Path.join(STAGE, '.sdk', 'PUBLISHING.md')

    await generated(vol, fs, { targets: ['ts'], root: sdkRoot() })
    ok(fs.existsSync(data) && fs.existsSync(publishing), 'the fixture wrote nothing into .sdk/')
    ok(readGenerated(fs, STAGE)['.'].has('.sdk/test/entity/planet/PlanetTestData.json'))
    fs.writeFileSync(data, '{"edited":true}')

    await generated(vol, fs, {
      targets: ['ts'], root: sdkRoot(), extra: 'main: kit: phase: build: active: false' })
    ok(fs.existsSync(publishing), 'Top wrote nothing into .sdk/ on the second run')
    strictEqual(fs.existsSync(data) && String(fs.readFileSync(data)), '{"edited":true}',
      'the test data of the build phase switched off was removed')
  })


  test('a relative output folder is recorded and pruned as an absolute one is', async () => {
    const { fs, vol } = memfs({})
    const folder = Path.relative(SCAFFOLD, STAGE)
    ok(!Path.isAbsolute(folder))
    const comet = Path.join(STAGE, '.sdk', 'test', 'entity', 'comet', 'CometTestData.json')
    const planet = Path.join(STAGE, '.sdk', 'test', 'entity', 'planet', 'PlanetTestData.json')

    await generated(vol, fs, {
      folder, targets: ['ts'], root: sdkRoot({ main: false }), extra: namedEntity('comet') })
    ok(fs.existsSync(comet) && fs.existsSync(planet), 'the fixture wrote no test data')
    ok(readGenerated(fs, STAGE)['.']?.has('.sdk/test/entity/comet/CometTestData.json'),
      'a relative output folder recorded nothing')

    await generated(vol, fs, { folder, targets: ['ts'], root: sdkRoot({ main: false }) })
    strictEqual(fs.existsSync(comet), false, 'a relative output folder left a dropped entity\'s file')
    ok(fs.existsSync(planet))
  })


  test('an entity the model drops takes its files with it in every target that generates entities', async () => {
    const cmps = Path.join(SCAFFOLD, 'src', 'cmp')
    const targets = Fs.readdirSync(cmps)
      .filter((t: string) => Fs.existsSync(Path.join(cmps, t, 'Entity_' + t + '.ts'))).sort()
    ok(10 < targets.length, targets.join(', '))
    const { fs, vol } = memfs({})

    const before = await generated(vol, fs, { targets, extra: namedEntity('comet') })
    const left = targets.filter((t) => !before.some((rel) => rel.startsWith(t + '/') && /comet/i.test(rel)))
    deepStrictEqual(left, [], 'these targets generated no comet files to prune')

    const after = await generated(vol, fs, { targets })
    deepStrictEqual(after.filter((rel) => /comet/i.test(rel)), [], 'a dropped entity left files behind')
    deepStrictEqual(after, before.filter((rel) => !/comet/i.test(rel)),
      'pruning removed or added something else')
  })
})
