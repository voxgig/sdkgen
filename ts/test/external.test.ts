// Generating a target OUTSIDE the SDK repo — `output: path`.
//
// WHY THIS NEEDS ITS OWN SUITE
//
// Every other target writes into `<sdk-repo>/<target>/`, arranged by the
// consumer's Root.ts with `Folder({ name: target.name })`. Two things make
// "somewhere else" a different mechanism rather than a different folder name:
//
//   - jostraca REFUSES a `..` segment in a Folder name, deliberately;
//   - the output root is `folder` on the generate() CALL, not a node in the
//     tree.
//
// So an out-of-tree target gets a SECOND generate() pass at its own root, and
// the things that can go wrong are structural rather than textual: the target
// leaking into the in-tree pass as well, the SDK repo's own root files
// following it out, or per-target components being looked for under the
// destination (they live in the project, and the pass has just moved what
// `requirePath` resolves against).
//
// And it is the ONE code path that writes outside the repo it was pointed at,
// at a path taken verbatim from the model, by overwrite — so where a
// destination is REFUSED matters as much as where it is written. This suite
// once covered only an absolute path, one target, all of it succeeding; the
// forms every real project uses (a relative path, more than one target, a
// dry run) went untested, and so did every guard.

import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Path from 'node:path'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen.js'

import { makeModel, makeRoot, layeredFs, makeLog, STAGE, SCAFFOLD } from './generateharness'


// Somewhere that is emphatically not under STAGE, so "did it land outside?"
// is unambiguous.
const OUT = '/elsewhere/acme-provider'

// A second destination, for the multi-target case.
const OUT2 = '/elsewhere/acme-cli'

// The form every real project actually declares: relative, resolved against
// the SDK project rather than the working directory. The suite runs chdir'd
// to SCAFFOLD (see below), so the two bases give different answers here —
// which is the point.
const REL = '../elsewhere/rel-provider'


// A path as the in-memory VOLUME spells it. memfs is a POSIX volume: it
// stores '/a/b', never 'D:/a/b'. So a path built with Path.resolve has to
// lose its drive letter as well as its separators before it can be compared
// with a volume key — without which every destination assertion in this file
// passed on POSIX and failed on Windows, looking for 'D:/a/.../provider'
// among keys that all began '/a/...'.
//
// NOT for comparing against an ERROR MESSAGE: those carry the real resolved
// path, drive and backslashes included, because that is what an operator has
// to recognise. Compare messages against the raw Path.resolve value.
const norm = (path: string) =>
  path.split(Path.sep).join('/').replace(/^[A-Za-z]:/, '')


type GenOpts = {
  // Files already present at the destination before generation.
  seed?: Record<string, string>
  dryrun?: boolean
  extra?: string
  // Collects the generator's log entries, for the warnings that are the
  // only externally visible part of a decision.
  sink?: any[]
}


// One generator over one fresh memfs volume. The volume is handed back
// SEPARATELY from the run, so a test can assert on what was — or was not —
// written when generation is refused.
function setup(
  targets: string[], paths: Record<string, string>, opts: GenOpts = {}
) {
  const { fs, vol } = memfs(opts.seed || {})

  const sdkgen = SdkGen({
    fs: layeredFs(fs),
    folder: STAGE,
    root: '',
    pino: makeLog(opts.sink),
    dryrun: opts.dryrun,
  })

  const model = makeModel(targets, undefined,
    Object.entries(paths)
      .map(([name, path]) =>
        `main: kit: target: '${name}': output: path: '${path}'`)
      .join('\n') + '\n' + (opts.extra || ''))

  return {
    run: () => sdkgen.generate({ model, root: makeRoot() }),

    // EVERY written path, `.jostraca` bookkeeping included — that is what
    // the destination's own .gitignore has to cover, so a view that hides it
    // cannot test for it.
    files: (): Record<string, string> => {
      const out: Record<string, string> = {}
      for (const [path, content] of
        Object.entries(vol.toJSON() as Record<string, string>)) {
        out[norm(path)] = content
      }
      return out
    },
  }
}


// The files under `folder`, keyed relative to it. Bookkeeping is dropped
// here: these views answer "what package landed where".
function under(all: Record<string, string>, folder: string) {
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(all)) {
    if (path.includes('/.jostraca/')) continue
    if (path.startsWith(folder + '/')) {
      out[path.slice(folder.length + 1)] = content
    }
  }
  return out
}


// Generate `targets`, with `external` pointed at OUT (or a name -> path map),
// and split the resulting volume into what landed in the SDK repo and what
// landed outside it.
async function generate(
  targets: string[],
  external: string | Record<string, string>,
  extra = '',
  opts: GenOpts = {},
) {
  const paths = 'string' === typeof external ? { [external]: OUT } : external

  const gen = setup(targets, paths, { ...opts, extra })

  const res = await gen.run()
  strictEqual(res.ok, true, 'generation did not report ok')

  const all = gen.files()

  return { inside: under(all, norm(STAGE)), outside: under(all, OUT), all }
}


// Generation must be REFUSED — and refused as an SdkGenError naming both the
// destination and the SDK project, because the whole point of the guard is
// that the operator can see which of the two paths is wrong.
async function refuse(
  targets: string[], paths: Record<string, string>, opts: GenOpts = {}
) {
  const gen = setup(targets, paths, opts)

  let err: any = null
  try {
    await gen.run()
  }
  catch (e: any) {
    err = e
  }

  ok(null != err, 'generation was allowed')
  strictEqual(err.name, 'SdkGenError', 'not an SdkGenError: ' + err)

  return { err, msg: String(err.message), files: gen.files() }
}


describe('external target', () => {

  let cwd = ''

  // A component's `Copy({ from: 'tm/<target>' })` is CWD-relative — jostraca
  // stats it directly — so the suite must run from the staged scaffold the
  // way a consumer's `generate` runs from its own `.sdk`. Mirrors
  // generate.test.ts.
  before(() => {
    cwd = process.cwd()
    process.chdir(SCAFFOLD)
  })

  after(() => {
    if ('' !== cwd) process.chdir(cwd)
  })


  // An ABSOLUTE output path, which is the unambiguous case.
  test('its files land at the output path, not in the SDK repo', async () => {
    const { inside, outside } = await generate(['ts', 'seneca-provider'], 'seneca-provider')

    ok(0 < Object.keys(outside).length, 'nothing was written to the output path')

    // The package is written at the ROOT of the destination: the destination
    // IS the package, so a `seneca-provider/` subfolder there would be wrong.
    ok(null != outside['package.json'],
      'no package.json at the output root — files landed under a subfolder:\n  ' +
      Object.keys(outside).join('\n  '))

    // ...and nothing of it stayed behind.
    const strays = Object.keys(inside).filter((p) => p.startsWith('seneca-provider/'))
    deepStrictEqual(strays, [],
      'the external target ALSO generated into the SDK repo — the in-tree ' +
      'pass still saw it')
  })


  // The RELATIVE form, which is what every real project declares
  // (voxgig-solardemo-sdk: '../../seneca/solardemo-provider'). It resolves
  // against the SDK project, NOT the working directory — a generation is run
  // from the project's `.sdk`, and a model path that moved with the caller's
  // CWD would put the package somewhere different depending on where the
  // command was typed. Nothing else in this suite can catch a base swap: an
  // absolute path resolves the same against either.
  test('a relative output path resolves against the SDK project, not the CWD',
    async () => {
      const gen = setup(['ts', 'seneca-provider'], { 'seneca-provider': REL })
      const res = await gen.run()
      strictEqual(res.ok, true, 'generation did not report ok')

      const fromProject = norm(Path.resolve(STAGE, REL))
      const fromCwd = norm(Path.resolve(SCAFFOLD, REL))
      ok(fromProject !== fromCwd,
        'the two bases coincide here, so this test proves nothing')

      const all = gen.files()

      ok(null != under(all, fromProject)['package.json'],
        'nothing landed at the project-relative destination ' + fromProject +
        ':\n  ' + Object.keys(all).join('\n  '))

      const stray = Object.keys(all).filter((p) => p.startsWith(fromCwd + '/'))
      deepStrictEqual(stray, [],
        'the output path resolved against the WORKING DIRECTORY')
    })


  // The SDK repo's own root files (README, AGENTS.md, the build scaffold) are
  // emitted once per repo by the consumer Root. They must not follow a target
  // out to a separate package's repo.
  test('the SDK repo\'s own root files do not follow it out', async () => {
    const { inside, outside } = await generate(['ts', 'seneca-provider'], 'seneca-provider')

    ok(null != inside['README.md'], 'the SDK repo lost its own README')

    const rootFiles = Object.keys(outside)
      .filter((p) => !p.includes('/'))
      .sort()

    // Whatever the target itself emits at its root is fine; what must NOT
    // appear is the SDK's. The SDK README names the SDK, the provider's names
    // the provider.
    const readme = outside['README.md']
    if (null != readme) {
      ok(!readme.includes('# Demo SDK'),
        'the SDK repo README was written into the external target:\n' +
        readme.split('\n').slice(0, 3).join('\n'))
    }

    ok(!rootFiles.includes('AGENTS.md'),
      'the SDK repo AGENTS.md followed the external target out: ' +
      rootFiles.join(', '))
  })


  // The in-tree targets must be untouched by the partition — a bug here would
  // drop them from the model the consumer Root is handed.
  test('the other targets still generate normally', async () => {
    const { inside } = await generate(['ts', 'go', 'seneca-provider'], 'seneca-provider')

    for (const t of ['ts', 'go']) {
      ok(Object.keys(inside).some((p) => p.startsWith(t + '/')),
        t + ' generated nothing — the external partition dropped it')
    }
  })


  // More than one target out of tree. Each pass is rooted at its own
  // destination, so nothing of one may appear in the other, and the in-tree
  // model must lose BOTH.
  test('two external targets each generate into their own repo', async () => {
    const { inside, all } = await generate(['ts', 'go', 'seneca-provider'],
      { 'seneca-provider': OUT, go: OUT2 })

    const provider = under(all, OUT)
    const cli = under(all, OUT2)

    ok(null != provider['package.json'],
      'the provider did not land at its own destination:\n  ' +
      Object.keys(provider).join('\n  '))
    // Each destination holds ONE package: the provider's manifest is
    // package.json, go's is go.mod, and neither may appear in the other.
    ok(null != cli['go.mod'],
      'go did not land at its own destination:\n  ' +
      Object.keys(cli).join('\n  '))
    ok(null == cli['package.json'],
      'the provider generated into the go destination as well')
    ok(null == provider['go.mod'],
      'go generated into the provider destination as well')

    for (const t of ['seneca-provider', 'go']) {
      const strays = Object.keys(inside).filter((p) => p.startsWith(t + '/'))
      deepStrictEqual(strays, [], t + ' also generated into the SDK repo')
    }

    ok(Object.keys(inside).some((p) => p.startsWith('ts/')),
      'ts generated nothing — the external partition dropped it')
  })


  // Components live in the PROJECT. The external pass retargets jostraca's
  // output folder, which is what requirePath resolves against, so without
  // ctx$.cmpfolder the pass looks for `<destination>/.sdk/dist/cmp/...` and
  // dies with "Cannot find module".
  test('per-target components resolve from the project, not the destination',
    async () => {
      const { outside } = await generate(['ts', 'seneca-provider'], 'seneca-provider')

      // Main_seneca-provider is what emits this; reaching it at all is the
      // proof that resolution stayed with the project.
      const src = outside['src/demo-provider.ts']
      ok(null != src,
        'the target component did not run — generated:\n  ' +
        Object.keys(outside).join('\n  '))
    })


  // An unset path is the ordinary in-tree case. This is the default every
  // existing target has, so it is the regression that would hurt most.
  test('an unset output path generates in-tree as before', async () => {
    const { fs, vol } = memfs({})

    const sdkgen = SdkGen({
      fs: layeredFs(fs),
      folder: STAGE,
      root: '',
      pino: makeLog(),
    })

    const res = await sdkgen.generate({
      model: makeModel(['ts', 'seneca-provider']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true)

    const paths = Object.keys(vol.toJSON() as Record<string, string>)
      .map((p) => Path.relative(STAGE, p).split(Path.sep).join('/'))

    ok(paths.some((p) => p.startsWith('seneca-provider/')),
      'with no output path the target should generate in-tree, under ' +
      'seneca-provider/')
  })


  // Dry run is a hard rule for every write path (AGENTS.md), and the external
  // pass is the one that writes outside the repo — the place where "let me
  // see what this would do first" matters most.
  test('a dry run writes nothing, at the destination or in the SDK repo',
    async () => {
      const gen = setup(['ts', 'seneca-provider'], { 'seneca-provider': OUT },
        { dryrun: true })

      const res = await gen.run()
      strictEqual(res.ok, true, 'generation did not report ok')

      deepStrictEqual(Object.keys(gen.files()), [],
        'a dry run wrote files')
    })


  // `active: false` is the model's off switch. For an in-tree target it only
  // decides whether a subfolder of the SDK repo is written; for this one it
  // is the only lever a project has to stop the generator writing into a repo
  // it does not own. It used to gate nothing at all.
  test('an inactive external target generates nowhere', async () => {
    const { inside, all } = await generate(['ts', 'seneca-provider'],
      'seneca-provider',
      'main: kit: target: \'seneca-provider\': active: false')

    deepStrictEqual(Object.keys(under(all, OUT)), [],
      'an inactive target still generated into the destination')

    // Nor may switching it off RELOCATE it into the SDK repo: the in-tree
    // pass must not pick it up either.
    const strays = Object.keys(inside).filter((p) => p.startsWith('seneca-provider/'))
    deepStrictEqual(strays, [],
      'an inactive external target fell back to generating in-tree')

    ok(Object.keys(inside).some((p) => p.startsWith('ts/')),
      'the rest of the SDK stopped generating')
  })


  // A DIFFERENT off switch from the one above: an entity inactive within a
  // target that IS generated. ExternalTarget.ts's phase-based entity loop
  // (the out-of-tree counterpart of Root.ts's, exercised here by pointing the
  // plain `ts` target itself out-of-tree rather than the seneca-provider
  // consumer, which disables this phase and filters independently in its own
  // Main) read the raw entity map with no `active` check, so an inactive
  // entity still got a full source file at the destination.
  test('an inactive entity is excluded from a plain target generated out-of-tree', async () => {
    const { outside } = await generate(['ts'], 'ts',
      'main: kit: entity: history: active: false\n')
    const files = Object.keys(outside)

    ok(files.some((p) => p.endsWith('PlanetEntity.ts')),
      'control failed: active entity Planet missing from the destination')
    ok(!files.some((p) => p.endsWith('HistoryEntity.ts')),
      'inactive entity History still generated a source file out-of-tree: ' +
      files.filter((p) => p.includes('History')).join(', '))
  })


  // The bookkeeping jostraca leaves at an output root: a meta log and a full
  // duplicate of the generated output. The SDK repo commits its own; the
  // destination is a DIFFERENT repo, which nothing here puts under version
  // control — so without the ignore, every regeneration leaves that repo
  // dirty with hundreds of untracked files.
  test('the destination ignores the generator bookkeeping left in it', async () => {
    const { all, outside } = await generate(['ts', 'seneca-provider'], 'seneca-provider')

    ok(Object.keys(all).some((p) => p.startsWith(OUT + '/.jostraca/')),
      'no bookkeeping was written to the destination — this test no longer ' +
      'proves anything')

    const gitignore = outside['.gitignore']
    ok(null != gitignore, 'the destination has no .gitignore')

    ok(gitignore.split('\n').some((line) => '.jostraca/' === line.trim()),
      'the destination .gitignore does not ignore .jostraca/:\n' + gitignore)
  })


  // `sdkrelpath` — the walk BACK from the destination to the SDK project,
  // which the target writes into its README and its live/quick test scripts
  // (the companion test server lives in the SDK repo and is not published).
  // Those files are COMMITTED in the destination repo, so anything
  // machine-local that gets into this value becomes a tracked diff on the
  // next developer's machine.
  describe('path back to the SDK project', () => {

    // Derived by inverting the two resolved folders. That is exact only
    // while the walk back crosses nothing the model names — true of
    // '../<repo>', false of anything ascending further, where the segments
    // in between are directories that exist only on this machine
    // ('../../voxgig-sdk/voxgig-solardemo-sdk', committed).
    test('a derivation that names undeclared directories warns', async () => {
      const sink: any[] = []
      await generate(['ts', 'seneca-provider'], 'seneca-provider', '', { sink })

      const warn = sink.find((e: any) => 'external-sdkrel-derived' === e.point)
      ok(null != warn,
        'no warning for a derived path naming ' +
        norm(Path.resolve(STAGE)).split('/').length + ' undeclared directories')
      ok(String(warn.note).includes('seneca-provider'),
        'the warning does not name the target: ' + warn.note)
    })


    // ...and the one-level case does NOT warn, or the warning is noise every
    // ordinary sibling layout emits.
    test('a sibling destination derives cleanly', async () => {
      const sink: any[] = []
      const gen = setup(['ts', 'seneca-provider'], { 'seneca-provider': REL },
        { sink })
      await gen.run()

      const warn = sink.find((e: any) => 'external-sdkrel-derived' === e.point)
      strictEqual(warn, undefined,
        'a destination one level from the SDK project should derive cleanly')
    })


    // The declared value takes over, and it is what reaches the generated
    // files — the project states the layout instead of the filesystem
    // implying it.
    test('a declared `output: sdkrel` is used verbatim', async () => {
      const sink: any[] = []
      const { outside } = await generate(['ts', 'seneca-provider'],
        'seneca-provider',
        'main: kit: target: \'seneca-provider\': output: sdkrel: \'../../acme-sdk\'',
        { sink })

      const named = Object.entries(outside)
        .filter(([, content]) => content.includes('../../acme-sdk'))
        .map(([path]) => path)

      ok(0 < named.length,
        'the declared path back to the SDK project reached no generated file')

      // Nothing may still be carrying the derived value, which on this
      // machine names the checkout layout.
      const leaked = Object.entries(outside)
        .filter(([, content]) => content.includes('dist-test-scaffold'))
        .map(([path]) => path)
      deepStrictEqual(leaked, [],
        'generated files still carry the machine-derived path')

      strictEqual(sink.find((e: any) => 'external-sdkrel-derived' === e.point),
        undefined, 'a declared path back should not warn')
    })

  })


  describe('destination guard', () => {

    // '.' is the whole point of the guard: it resolves to the SDK project
    // itself, and the external pass runs SECOND, so it overwrites what the
    // in-tree pass has just written — the SDK repo's own README, and a
    // package.json it never had.
    test('a path resolving to the SDK project is refused', async () => {
      const { msg, files } = await refuse(['ts', 'seneca-provider'],
        { 'seneca-provider': '.' })

      ok(msg.includes(STAGE),
        'the message does not name the SDK project:\n' + msg)
      ok(msg.includes('seneca-provider'),
        'the message does not name the target:\n' + msg)

      deepStrictEqual(Object.keys(files), [],
        'the refusal came too late — the in-tree pass had already written')
    })


    // A target NAME as the path — the plausible typo, since that is where an
    // in-tree target lands. It is also the collision the external pass would
    // win, silently replacing what the in-tree pass wrote there.
    test('a path inside the SDK project is refused', async () => {
      const { msg } = await refuse(['ts', 'seneca-provider'],
        { 'seneca-provider': 'ts' })

      ok(msg.includes(Path.resolve(STAGE, 'ts')),
        'the message does not name the destination:\n' + msg)
    })


    // The other direction: a destination that CONTAINS the SDK project, which
    // is what one `..` too many produces. Nothing above is inside the guard's
    // "inside the project" test, and generation would write a package over
    // the directory holding the project itself.
    test('a path containing the SDK project is refused', async () => {
      const { msg } = await refuse(['ts', 'seneca-provider'],
        { 'seneca-provider': '..' })

      ok(msg.includes('contains the SDK project'),
        'unexpected refusal reason:\n' + msg)
    })


    // Two targets, one folder: the second pass overwrites the first, in
    // target-name order, and the operator sees two "generated ok" lines.
    test('two targets claiming the same folder are refused', async () => {
      const { msg } = await refuse(['ts', 'go', 'seneca-provider'],
        { 'seneca-provider': OUT, go: OUT })

      ok(msg.includes('go') && msg.includes('seneca-provider'),
        'the message does not name both targets:\n' + msg)
    })


    // The one that matters most in practice: a path that LOOKS right and is
    // someone else's repo. Overwrite-not-merge means generation would replace
    // its package.json, README and LICENSE in place.
    test('a destination holding unrelated content is refused', async () => {
      const { msg, files } = await refuse(['ts', 'seneca-provider'],
        { 'seneca-provider': OUT },
        {
          seed: {
            [OUT + '/package.json']: '{"name":"someone-elses-repo"}',
            [OUT + '/README.md']: '# Someone else\'s repo\n',
          }
        })

      ok(msg.includes('README.md') || msg.includes('package.json'),
        'the message does not say what it found:\n' + msg)
      ok(msg.includes('adopt'),
        'the message does not say how to proceed deliberately:\n' + msg)

      strictEqual(files[OUT + '/package.json'], '{"name":"someone-elses-repo"}',
        'the unrelated repo was overwritten anyway')
    })


    // ...and the escape hatch, which is a model DECLARATION rather than a
    // flag on the command line: the destination is a property of the project.
    test('`output: adopt` writes into a destination holding other content',
      async () => {
        const { outside } = await generate(['ts', 'seneca-provider'],
          'seneca-provider',
          'main: kit: target: \'seneca-provider\': output: adopt: true',
          { seed: { [OUT + '/README.md']: '# Seeded by the repo host\n' } })

        ok(null != outside['package.json'],
          'adopt did not let generation proceed')
      })


    // A destination this generator has written before carries jostraca's
    // bookkeeping tree, and that is the ownership marker: the live provider
    // repos are all in exactly this state, so the guard must not stop them.
    test('a destination carrying the generator\'s own marker is accepted',
      async () => {
        const { outside } = await generate(['ts', 'seneca-provider'],
          'seneca-provider', '',
          {
            seed: {
              [OUT + '/package.json']: '{"name":"@seneca/demo-provider"}',
              [OUT + '/.jostraca/jostraca.meta.log']: '{}\n',
            }
          })

        ok(null != outside['package.json'],
          'a destination generated into before was refused')
      })


    // A freshly created repo holds only `.git`, and that is precisely the
    // destination a FIRST generation is aimed at.
    test('an empty destination is accepted', async () => {
      const { outside } = await generate(['ts', 'seneca-provider'],
        'seneca-provider', '',
        { seed: { [OUT + '/.git/HEAD']: 'ref: refs/heads/main\n' } })

      ok(null != outside['package.json'],
        'an empty git repo was refused')
    })

  })

})
