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
//
// THE TARGET HERE IS A VEHICLE, NOT THE SUBJECT. Everything below is about
// the MECHANISM — placement, partition, resolution, refusal — so the target
// driving it only has to be one with an `output: path`. It was
// `seneca-provider` for as long as that was the only such target; that target
// now lives in packages/sdkgen-seneca-provider and its own suite covers what
// it EMITS. `go-cli` took its place because the shape is what matters: a
// consumer target emitting a small package with its own README and manifest
// and no AGENTS.md, which is what makes "the SDK repo's own root files did
// not follow it out" a statement about the mechanism rather than about one
// target's file list. It needs `go` in the model, as every consumer target
// needs the target it wraps.

import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Path from 'node:path'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen.js'

import { makeModel, makeRoot, layeredFs, makeLog, STAGE, SCAFFOLD } from './generateharness'


// Somewhere that is emphatically not under STAGE, so "did it land outside?"
// is unambiguous.
const OUT = '/elsewhere/acme-cli'

// A second destination, for the multi-target case.
const OUT2 = '/elsewhere/acme-sdk'

// The form every real project actually declares: relative, resolved against
// the SDK project rather than the working directory. The suite runs chdir'd
// to SCAFFOLD (see below), so the two bases give different answers here —
// which is the point.
const REL = '../elsewhere/rel-cli'


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
    const { inside, outside } = await generate(['go', 'go-cli'], 'go-cli')

    ok(0 < Object.keys(outside).length, 'nothing was written to the output path')

    // The package is written at the ROOT of the destination: the destination
    // IS the package, so a `go-cli/` subfolder there would be wrong.
    ok(null != outside['go.mod'],
      'no go.mod at the output root — files landed under a subfolder:\n  ' +
      Object.keys(outside).join('\n  '))

    // ...and nothing of it stayed behind.
    const strays = Object.keys(inside).filter((p) => p.startsWith('go-cli/'))
    deepStrictEqual(strays, [],
      'the external target ALSO generated into the SDK repo — the in-tree ' +
      'pass still saw it')
  })


  // The RELATIVE form, which is what every real project declares
  // (voxgig-solardemo-sdk points its provider at
  // '../../seneca/solardemo-provider'). It resolves
  // against the SDK project, NOT the working directory — a generation is run
  // from the project's `.sdk`, and a model path that moved with the caller's
  // CWD would put the package somewhere different depending on where the
  // command was typed. Nothing else in this suite can catch a base swap: an
  // absolute path resolves the same against either.
  test('a relative output path resolves against the SDK project, not the CWD',
    async () => {
      const gen = setup(['go', 'go-cli'], { 'go-cli': REL })
      const res = await gen.run()
      strictEqual(res.ok, true, 'generation did not report ok')

      const fromProject = norm(Path.resolve(STAGE, REL))
      const fromCwd = norm(Path.resolve(SCAFFOLD, REL))
      ok(fromProject !== fromCwd,
        'the two bases coincide here, so this test proves nothing')

      const all = gen.files()

      ok(null != under(all, fromProject)['go.mod'],
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
    const { inside, outside } = await generate(['go', 'go-cli'], 'go-cli')

    ok(null != inside['README.md'], 'the SDK repo lost its own README')

    const rootFiles = Object.keys(outside)
      .filter((p) => !p.includes('/'))
      .sort()

    // Whatever the target itself emits at its root is fine; what must NOT
    // appear is the SDK's. Both are checked by CONTENT, not by filename: a
    // target that emits a README of its own — this one does — makes "no
    // README out there" the wrong assertion, and asserting the filename is
    // absent would pass for the wrong reason the moment the SDK's README
    // stopped being called README.md.
    const readme = outside['README.md']
    if (null != readme) {
      ok(!readme.includes('# Demo SDK'),
        'the SDK repo README was written into the external target:\n' +
        readme.split('\n').slice(0, 3).join('\n'))
      ok(readme !== inside['README.md'],
        'the external target got a byte-identical copy of the SDK README')
    }

    // The SDK repo's agent guides are emitted once per repo by the consumer
    // Root and belong to the repo, not to any target.
    for (const name of ['AGENTS.md', 'CLAUDE.md']) {
      const out = outside[name]
      if (null != out && null != inside[name]) {
        ok(out !== inside[name],
          'the SDK repo ' + name + ' followed the external target out: ' +
          rootFiles.join(', '))
      }
    }
  })


  // The in-tree targets must be untouched by the partition — a bug here would
  // drop them from the model the consumer Root is handed.
  test('the other targets still generate normally', async () => {
    const { inside } = await generate(['ts', 'go', 'go-cli'], 'go-cli')

    for (const t of ['ts', 'go']) {
      ok(Object.keys(inside).some((p) => p.startsWith(t + '/')),
        t + ' generated nothing — the external partition dropped it')
    }
  })


  // More than one target out of tree. Each pass is rooted at its own
  // destination, so nothing of one may appear in the other, and the in-tree
  // model must lose BOTH.
  test('two external targets each generate into their own repo', async () => {
    const { inside, all } = await generate(['ts', 'go', 'go-cli'],
      { 'go-cli': OUT, go: OUT2 })

    const cli = under(all, OUT)
    const sdk = under(all, OUT2)

    // BOTH are Go modules, so `go.mod` cannot tell them apart and the
    // discriminator is a file only one of them emits: `main.go` from
    // Main_go-cli, `core/config.go` from the SDK's own components. Picking
    // the manifest here would assert nothing — each destination would hold
    // one either way.
    ok(null != cli['main.go'],
      'the cli did not land at its own destination:\n  ' +
      Object.keys(cli).join('\n  '))
    ok(null != sdk['core/config.go'],
      'the SDK did not land at its own destination:\n  ' +
      Object.keys(sdk).join('\n  '))
    ok(null == sdk['main.go'],
      'the cli generated into the SDK destination as well')
    ok(null == cli['core/config.go'],
      'the SDK generated into the cli destination as well')

    for (const t of ['go-cli', 'go']) {
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
      const { outside } = await generate(['go', 'go-cli'], 'go-cli')

      // Main_go-cli is what emits this — it is not in the target's template
      // tree, so a Copy could not have produced it. Reaching it at all is the
      // proof that resolution stayed with the project.
      const src = outside['main.go']
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
      model: makeModel(['go', 'go-cli']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true)

    const paths = Object.keys(vol.toJSON() as Record<string, string>)
      .map((p) => Path.relative(STAGE, p).split(Path.sep).join('/'))

    ok(paths.some((p) => p.startsWith('go-cli/')),
      'with no output path the target should generate in-tree, under ' +
      'go-cli/')
  })


  // An out-of-tree target may belong to a separate fleet whose repos are not
  // checked out on every machine. It must stay active in the model — so it is
  // available whenever its repo IS present — without generation fabricating
  // a new checkout when it is absent.
  test('`output.create: false` skips an absent destination without deactivating the target',
    async () => {
      const sink: any[] = []
      const { inside, outside } = await generate(
        ['go', 'go-cli'], 'go-cli',
        "main: kit: target: 'go-cli': output: create: false",
        { sink })

      deepStrictEqual(Object.keys(outside), [],
        'an absent optional destination was created and generated into')

      const strays = Object.keys(inside)
        .filter((p) => p.startsWith('go-cli/'))
      deepStrictEqual(strays, [],
        'the skipped external target fell back to generating in-tree')

      ok(Object.keys(inside).some((p) => p.startsWith('go/')),
        'the rest of the SDK stopped generating')

      const skip = sink.find((e: any) =>
        'generate-external-skip' === e.point &&
        'go-cli' === e.target)
      ok(null != skip, 'the skipped target was not reported')
      ok(String(skip.note).includes('output.create=false'),
        'the skip report does not name the controlling setting: ' + skip.note)
    })


  test('`output.create: false` still generates when the destination exists',
    async () => {
      const { outside } = await generate(
        ['go', 'go-cli'], 'go-cli',
        "main: kit: target: 'go-cli': output: create: false",
        { seed: { [OUT + '/.git/HEAD']: 'ref: refs/heads/main\n' } })

      ok(null != outside['go.mod'],
        'an existing destination was skipped')
    })


  // Dry run is a hard rule for every write path (AGENTS.md), and the external
  // pass is the one that writes outside the repo — the place where "let me
  // see what this would do first" matters most.
  test('a dry run writes nothing, at the destination or in the SDK repo',
    async () => {
      const gen = setup(['go', 'go-cli'], { 'go-cli': OUT },
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
    const { inside, all } = await generate(['go', 'go-cli'],
      'go-cli',
      'main: kit: target: \'go-cli\': active: false')

    deepStrictEqual(Object.keys(under(all, OUT)), [],
      'an inactive target still generated into the destination')

    // Nor may switching it off RELOCATE it into the SDK repo: the in-tree
    // pass must not pick it up either.
    const strays = Object.keys(inside).filter((p) => p.startsWith('go-cli/'))
    deepStrictEqual(strays, [],
      'an inactive external target fell back to generating in-tree')

    ok(Object.keys(inside).some((p) => p.startsWith('go/')),
      'the rest of the SDK stopped generating')
  })


  // ExternalTarget.ts's own entity loop had no `active` check at all. A
  // consumer target cannot catch this — it disables the entity phase — so
  // this case drives a PLAIN target out of tree, which is the other half of
  // what `output: path` has to support.
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
    const { all, outside } = await generate(['go', 'go-cli'], 'go-cli')

    ok(Object.keys(all).some((p) => p.startsWith(OUT + '/.jostraca/')),
      'no bookkeeping was written to the destination — this test no longer ' +
      'proves anything')

    const gitignore = outside['.gitignore']
    ok(null != gitignore, 'the destination has no .gitignore')

    ok(gitignore.split('\n').some((line) => '.jostraca/' === line.trim()),
      'the destination .gitignore does not ignore .jostraca/:\n' + gitignore)
  })


  // `sdkrelpath` — the walk BACK from the destination to the SDK project,
  // which a target writes into files such as its README and its live-test
  // scripts (the companion test server lives in the SDK repo and is not
  // published). Those files are COMMITTED in the destination repo, so
  // anything machine-local that gets into this value becomes a tracked diff
  // on the next developer's machine. That is why the derivation WARNS rather
  // than quietly emitting a path only this checkout has.
  describe('path back to the SDK project', () => {

    // Derived by inverting the two resolved folders. That is exact only
    // while the walk back crosses nothing the model names — true of
    // '../<repo>', false of anything ascending further, where the segments
    // in between are directories that exist only on this machine
    // ('../../voxgig-sdk/voxgig-solardemo-sdk', committed).
    test('a derivation that names undeclared directories warns', async () => {
      const sink: any[] = []
      await generate(['go', 'go-cli'], 'go-cli', '', { sink })

      const warn = sink.find((e: any) => 'external-sdkrel-derived' === e.point)
      ok(null != warn,
        'no warning for a derived path naming ' +
        norm(Path.resolve(STAGE)).split('/').length + ' undeclared directories')
      ok(String(warn.note).includes('go-cli'),
        'the warning does not name the target: ' + warn.note)
    })


    // ...and the one-level case does NOT warn, or the warning is noise every
    // ordinary sibling layout emits.
    test('a sibling destination derives cleanly', async () => {
      const sink: any[] = []
      const gen = setup(['go', 'go-cli'], { 'go-cli': REL },
        { sink })
      await gen.run()

      const warn = sink.find((e: any) => 'external-sdkrel-derived' === e.point)
      strictEqual(warn, undefined,
        'a destination one level from the SDK project should derive cleanly')
    })


    // A declared value takes over from the derivation: the project states
    // the layout instead of the filesystem implying it, so the generator
    // stops deriving and stops warning.
    //
    // SPLIT AT THE SEAM, DELIBERATELY. This used to also assert that the
    // declared string reached generated CONTENT. It cannot here, and the
    // reason is worth stating rather than working around: the core's job
    // ends at handing `ctx$.sdkrelpath` to the pass, and reading it is a
    // COMPONENT's job. The only component that ever did was
    // Main_seneca-provider, which now lives in
    // packages/sdkgen-seneca-provider — and its suite asserts the content
    // half, against the component that consumes the value. Substituting a
    // target that ignores `sdkrelpath` would have left an assertion that
    // passes without testing anything.
    //
    // What stays here is the whole of `externalSdkRel`'s decision surface,
    // which is observable in the log without any target's cooperation:
    // derive-and-warn (above), derive-cleanly (above), and declared-so-do-
    // neither (here).
    test('a declared `output: sdkrel` replaces the derivation', async () => {
      const sink: any[] = []
      const gen = setup(['go', 'go-cli'], { 'go-cli': OUT },
        {
          extra:
            'main: kit: target: \'go-cli\': output: sdkrel: \'../../acme-sdk\'',
          sink,
        })
      await gen.run()

      strictEqual(sink.find((e: any) => 'external-sdkrel-derived' === e.point),
        undefined,
        'a declared path back was derived — and warned about — anyway')
    })

  })


  describe('destination guard', () => {

    // '.' is the whole point of the guard: it resolves to the SDK project
    // itself, and the external pass runs SECOND, so it overwrites what the
    // in-tree pass has just written — the SDK repo's own README, and a
    // go.mod it never had.
    test('a path resolving to the SDK project is refused', async () => {
      const { msg, files } = await refuse(['go', 'go-cli'],
        { 'go-cli': '.' })

      ok(msg.includes(STAGE),
        'the message does not name the SDK project:\n' + msg)
      ok(msg.includes('go-cli'),
        'the message does not name the target:\n' + msg)

      deepStrictEqual(Object.keys(files), [],
        'the refusal came too late — the in-tree pass had already written')
    })


    // A target NAME as the path — the plausible typo, since that is where an
    // in-tree target lands. It is also the collision the external pass would
    // win, silently replacing what the in-tree pass wrote there.
    test('a path inside the SDK project is refused', async () => {
      const { msg } = await refuse(['go', 'go-cli'],
        { 'go-cli': 'go' })

      ok(msg.includes(Path.resolve(STAGE, 'go')),
        'the message does not name the destination:\n' + msg)
    })


    // The other direction: a destination that CONTAINS the SDK project, which
    // is what one `..` too many produces. Nothing above is inside the guard's
    // "inside the project" test, and generation would write a package over
    // the directory holding the project itself.
    test('a path containing the SDK project is refused', async () => {
      const { msg } = await refuse(['go', 'go-cli'],
        { 'go-cli': '..' })

      ok(msg.includes('contains the SDK project'),
        'unexpected refusal reason:\n' + msg)
    })


    // Two targets, one folder: the second pass overwrites the first, in
    // target-name order, and the operator sees two "generated ok" lines.
    test('two targets claiming the same folder are refused', async () => {
      const { msg } = await refuse(['ts', 'go', 'go-cli'],
        { 'go-cli': OUT, go: OUT })

      ok(msg.includes('go') && msg.includes('go-cli'),
        'the message does not name both targets:\n' + msg)
    })


    // The one that matters most in practice: a path that LOOKS right and is
    // someone else's repo. Overwrite-not-merge means generation would replace
    // its package.json, README and LICENSE in place.
    test('a destination holding unrelated content is refused', async () => {
      const { msg, files } = await refuse(['go', 'go-cli'],
        { 'go-cli': OUT },
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


    test('`output.create: false` does not bypass guards for an existing destination',
      async () => {
        const { msg } = await refuse(['go', 'go-cli'],
          { 'go-cli': OUT },
          {
            extra: "main: kit: target: 'go-cli': output: create: false",
            seed: { [OUT + '/README.md']: '# Existing repository\n' },
          })

        ok(msg.includes('adopt'),
          'an existing optional checkout bypassed the ownership guard:\n' + msg)
      })


    // ...and the escape hatch, which is a model DECLARATION rather than a
    // flag on the command line: the destination is a property of the project.
    test('`output: adopt` writes into a destination holding other content',
      async () => {
        const { outside } = await generate(['go', 'go-cli'],
          'go-cli',
          'main: kit: target: \'go-cli\': output: adopt: true',
          { seed: { [OUT + '/README.md']: '# Seeded by the repo host\n' } })

        ok(null != outside['go.mod'],
          'adopt did not let generation proceed')
      })


    // A destination this generator has written before carries jostraca's
    // bookkeeping tree, and that is the ownership marker: every destination
    // that has been generated into before is in exactly this state, so the
    // guard must not stop them.
    test('a destination carrying the generator\'s own marker is accepted',
      async () => {
        const { outside } = await generate(['go', 'go-cli'],
          'go-cli', '',
          {
            seed: {
              [OUT + '/go.mod']: 'module example.com/demo-cli\n',
              [OUT + '/.jostraca/jostraca.meta.log']: '{}\n',
            }
          })

        ok(null != outside['go.mod'],
          'a destination generated into before was refused')
      })


    // A freshly created repo holds only `.git`, and that is precisely the
    // destination a FIRST generation is aimed at.
    test('an empty destination is accepted', async () => {
      const { outside } = await generate(['go', 'go-cli'],
        'go-cli', '',
        { seed: { [OUT + '/.git/HEAD']: 'ref: refs/heads/main\n' } })

      ok(null != outside['go.mod'],
        'an empty git repo was refused')
    })

  })

})
