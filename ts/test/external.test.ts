
import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'

import { SdkGen, fact, registerComponent } from '../dist/sdkgen.js'

import { makeModel, makeRoot, layeredFs, makeLog, STAGE, SCAFFOLD } from './generateharness'


const OUT = '/elsewhere/acme-cli'

const OUT2 = '/elsewhere/acme-sdk'

const REL = '../elsewhere/rel-cli'


// The in-tree walk from a target back to the project's `.sdk` or
// `.env.local`: `../.sdk`, `"..", ".sdk"`, or `push("..")` then `push(".sdk")`.
const IN_TREE_BACK = /\.\.(?:\/|["'],\s*["']|["']\);\s*\w+\.push\(["'])\.(?:sdk|env\.local)\b/


const norm = (path: string) =>
  path.split(Path.sep).join('/').replace(/^[A-Za-z]:/, '')


type GenOpts = {
  seed?: Record<string, string>
  dryrun?: boolean
  extra?: string
  sink?: any[]
  external?: Record<string, any>
  root?: any
}


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
    external: opts.external,
  })

  const model = makeModel(targets, undefined,
    Object.entries(paths)
      .map(([name, path]) =>
        `main: kit: target: '${name}': output: path: '${path}'`)
      .join('\n') + '\n' + (opts.extra || ''))

  return {
    model,
    run: () => sdkgen.generate({ model, root: opts.root ?? makeRoot() }),

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


function files(vol: any): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(vol.toJSON() as Record<string, string>)) {
    out[norm(path)] = content
  }
  return out
}


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


  test('its files land at the output path, not in the SDK repo', async () => {
    const { inside, outside } = await generate(['go', 'go-cli'], 'go-cli')

    ok(0 < Object.keys(outside).length, 'nothing was written to the output path')

    ok(null != outside['go.mod'],
      'no go.mod at the output root — files landed under a subfolder:\n  ' +
      Object.keys(outside).join('\n  '))

    const strays = Object.keys(inside).filter((p) => p.startsWith('go-cli/'))
    deepStrictEqual(strays, [],
      'the external target ALSO generated into the SDK repo — the in-tree ' +
      'pass still saw it')
  })


  test('a target that names its own repository points its manifest and install text there', async () => {
    const { outside } = await generate(['ts'], 'ts', "main: kit: target: ts: output: repo: 'acme/demo-ts'")
    const pkg = JSON.parse(outside['package.json'])
    for (const url of [pkg.repository?.url ?? pkg.repository, pkg.homepage, pkg.bugs?.url ?? pkg.bugs]) {
      ok(String(url).includes('github.com/acme/demo-ts'), JSON.stringify(url))
    }
    ok(outside['README.md'].includes('github.com/acme/demo-ts'), 'the install text names the SDK repository')
  })


  test('a relocated rockspec builds from the root of its own repository', async () => {
    const { outside } = await generate(['lua'], 'lua', "main: kit: target: lua: output: repo: 'acme/demo-lua'")
    const spec = outside['demo.rockspec']
    ok(spec.includes('url = "git+https://github.com/acme/demo-lua.git"'), spec)
    ok(/^  dir = "demo-lua"$/m.test(spec), spec)
  })


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

    const readme = outside['README.md']
    if (null != readme) {
      ok(!readme.includes('# Demo SDK'),
        'the SDK repo README was written into the external target:\n' +
        readme.split('\n').slice(0, 3).join('\n'))
      ok(readme !== inside['README.md'],
        'the external target got a byte-identical copy of the SDK README')
    }

    for (const name of ['AGENTS.md', 'CLAUDE.md']) {
      const out = outside[name]
      if (null != out && null != inside[name]) {
        ok(out !== inside[name],
          'the SDK repo ' + name + ' followed the external target out: ' +
          rootFiles.join(', '))
      }
    }
  })


  // The SDK repository's files are not beside a package in another repository.
  test('no document written out of tree links above the destination', async () => {
    const { outside } = await generate(['ts', 'go'], 'ts')
    const up: string[] = []
    for (const [file, text] of Object.entries(outside).filter(([f]) => f.endsWith('.md'))) {
      for (const m of String(text).matchAll(/\]\(([^)#\s]+)[^)]*\)/g)) {
        if (/^[a-z]+:/i.test(m[1])) continue
        const to = Path.posix.normalize(Path.posix.join(Path.posix.dirname(file), m[1]))
        if (to.startsWith('../')) up.push(file + ' -> ' + m[1])
      }
    }
    ok(null != outside['README.md'], 'nothing was written out of tree')
    deepStrictEqual(up, [])
  })


  // A run override is for this run: the SDK repository's committed files
  // describe the model's layout either way.
  test('an override changes no document or release file in tree', async () => {
    const plain = setup(['ts', 'go'], {})
    await plain.run()
    const moved = setup(['ts', 'go'], {}, { external: { ts: { path: OUT2, sdkrel: '../sdk' } } })
    await moved.run()

    // A null entry is a directory, which git does not hold.
    const committed = (all: Record<string, string>) => Object.fromEntries(Object.entries(all)
      .filter(([file, text]) => null != text && !file.startsWith('ts/') && !file.startsWith('.sdk/log/')))
    const before = committed(under(plain.files(), norm(STAGE)))
    const after = under(moved.files(), norm(STAGE))
    for (const file of ['README.md', 'AGENTS.md', 'Makefile']) {
      ok(null != before[file], file + ' is not written without the override')
    }
    deepStrictEqual(committed(after), before, 'a committed file differs under the override')
    deepStrictEqual(Object.keys(after).filter((file) => file.startsWith('ts/')), [])
    ok(null != under(moved.files(), OUT2)['package.json'], 'ts was not written out of tree')
  })


  // A project's own component writes its target's files as a built-in does.
  test('an override keeps a registered component out of the tree', async () => {
    const file = Path.join(STAGE, '.sdk', 'dist', 'cmp', 'ts', 'Extra_ts.js')
    Fs.writeFileSync(file, "const { File, Content } = require('jostraca')\n" +
      "module.exports.Extra = () => File({ name: 'EXTRA.md' }, () => Content('extra'))\n")
    try {
      const plain = setup(['ts'], {}, { root: makeRoot([registerComponent('Extra')]) })
      await plain.run()
      ok(null != under(plain.files(), norm(STAGE))['ts/EXTRA.md'], 'the registered component did not run')

      const moved = setup(['ts'], {}, {
        root: makeRoot([registerComponent('Extra')]),
        external: { ts: { path: OUT2, sdkrel: '../sdk' } },
      })
      await moved.run()
      deepStrictEqual(Object.keys(under(moved.files(), norm(STAGE)))
        .filter((path) => path.startsWith('ts/')), [])
    }
    finally {
      Fs.rmSync(file, { force: true })
    }
  })


  test('relocating the only SDK prunes nothing and names the stale folder', async () => {
    const { fs, vol } = memfs({})
    const sink: any[] = []
    const warnings: any[] = []
    const run = (external?: any) => SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(sink, warnings), external,
    }).generate({ model: makeModel(['ts']), root: makeRoot() })

    await run()
    const first = Object.keys(under(files(vol), norm(STAGE)))
    ok(first.includes('ts/package.json') && first.includes('Makefile'), first.join('\n'))

    await run({ ts: { path: OUT2, sdkrel: '../sdk' } })
    const second = Object.keys(under(files(vol), norm(STAGE)))
    deepStrictEqual(first.filter((file) => !second.includes(file)), [], 'a file was pruned')
    deepStrictEqual(sink.filter((e: any) => 'generate-prune' === e?.point), [])
    const stale = warnings.filter((w: any) => 'generate-external-stale' === w?.point)
    strictEqual(stale.length, 1, JSON.stringify(stale))
    ok(String(stale[0].note).startsWith('ts/'), stale[0].note)
  })


  test('an absent destination with create: false is skipped with one warning', async () => {
    const warnings: any[] = []
    const { fs } = memfs({})
    const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog([], warnings) })
    await sdkgen.generate({
      model: makeModel(['go', 'go-cli'], undefined,
        `main: kit: target: 'go-cli': output: { path: '${OUT}', create: false, sdkrel: '../sdk' }`),
      root: makeRoot(),
    })
    const skipped = warnings.filter((w: any) => 'generate-external-skip' === w?.point)
    strictEqual(skipped.length, 1, JSON.stringify(warnings.map((w: any) => w?.point)))
  })


  test('the other targets still generate normally', async () => {
    const { inside } = await generate(['ts', 'go', 'go-cli'], 'go-cli')

    for (const t of ['ts', 'go']) {
      ok(Object.keys(inside).some((p) => p.startsWith(t + '/')),
        t + ' generated nothing — the external partition dropped it')
    }
  })


  test('two external targets each generate into their own repo', async () => {
    const { inside, all } = await generate(['ts', 'go', 'go-cli'],
      { 'go-cli': OUT, go: OUT2 })

    const cli = under(all, OUT)
    const sdk = under(all, OUT2)

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


  // The root README and AGENTS.md describe the whole project, so they name a
  // target generated into another repository; the documents about the
  // packages this repository publishes do not.
  describe('root documents', () => {

    const REPO = "main: kit: target: 'go-cli': output: repo: 'acme/demo-cli'"

    const LINKED = '[Go CLI](https://github.com/acme/demo-cli)'

    const inTree = (inside: Record<string, string>, name: string) =>
      Object.keys(inside).filter((p) => name === p || p.startsWith(name + '/'))


    test('name a declared out-of-tree target, linked to its own repository', async () => {
      const { inside } = await generate(['ts', 'go', 'go-cli'], 'go-cli', REPO)
      const readme = inside['README.md']
      const agents = inside['AGENTS.md']

      ok(readme.includes('> TypeScript, Go SDKs, and the ' + LINKED + ' — all generated from one'), readme)
      ok(readme.includes('| **' + LINKED + '** | generated into its own repository |'), readme)
      ok(agents.includes('**Targets** (3):'), agents)
      ok(agents.includes('| `go-cli` | ' + LINKED + ', generated into its own repository | — |'), agents)

      for (const doc of ['README.md', 'AGENTS.md']) {
        ok(!inside[doc].includes('go-cli/'), doc + ' names an in-tree go-cli folder')
      }
    })


    test('name it without a link when the model names no repository', async () => {
      const { inside } = await generate(['ts', 'go', 'go-cli'], 'go-cli')
      const readme = inside['README.md']
      const agents = inside['AGENTS.md']

      ok(readme.includes('> TypeScript, Go SDKs, and the Go CLI — all generated from one'), readme)
      ok(readme.includes('| **Go CLI** | generated into its own repository |'), readme)
      ok(agents.includes('| `go-cli` | Go CLI, generated into its own repository | — |'), agents)
      ok(!(readme + agents).includes('[Go CLI]('), 'a link with no repository to link')
    })


    test('name it while this run skips it, and never once it is inactive', async () => {
      const skipped = await generate(['ts', 'go', 'go-cli'], 'go-cli',
        REPO + "\nmain: kit: target: 'go-cli': output: create: false")
      deepStrictEqual(Object.keys(skipped.outside), [], 'the absent destination was generated into')
      ok(skipped.inside['README.md'].includes('| **' + LINKED + '** |'), skipped.inside['README.md'])
      ok(skipped.inside['AGENTS.md'].includes('| `go-cli` | ' + LINKED), skipped.inside['AGENTS.md'])

      const off = await generate(['ts', 'go', 'go-cli'], 'go-cli',
        REPO + "\nmain: kit: target: 'go-cli': active: false")
      for (const doc of ['README.md', 'AGENTS.md']) {
        ok(!/go-cli|Go CLI/.test(off.inside[doc]), doc + ' names an inactive target')
      }
    })


    test('keep SECURITY.md and the release files to the packages this repository publishes', async () => {
      const both = await generate(['ts', 'go'], {})
      ok(both.inside['SECURITY.md'].includes('repository (npm and the Go module).'), both.inside['SECURITY.md'])
      ok(/^TARGETS := .*\bgo\b/m.test(both.inside['Makefile']), 'control: go is not released in tree')

      const { inside } = await generate(['ts', 'go'], 'go', "main: kit: target: go: output: repo: 'acme/demo-go'")
      ok(inside['README.md'].includes('| **[Go SDK](https://github.com/acme/demo-go)** | generated into its own repository |'),
        inside['README.md'])
      ok(inside['SECURITY.md'].includes('repository (npm).'), inside['SECURITY.md'])
      ok(!inside['SECURITY.md'].includes('Go module'), inside['SECURITY.md'])
      ok(/^TARGETS := ts$/m.test(inside['Makefile']), 'the release Makefile acts on go')
      ok(!/\bGo\b/.test(inside['CHANGELOG.md']), inside['CHANGELOG.md'])
    })


    test('read the same under a run override, which moves only the target\'s own files', async () => {
      const plain = setup(['ts', 'go', 'go-cli'], { 'go-cli': OUT }, { extra: REPO })
      await plain.run()
      const moved = setup(['ts', 'go', 'go-cli'], { 'go-cli': OUT },
        { extra: REPO, external: { 'go-cli': { path: OUT2, sdkrel: '../sdk' } } })
      await moved.run()

      const committed = (all: Record<string, string>) => Object.fromEntries(Object.entries(under(all, norm(STAGE)))
        .filter(([file, text]) => null != text && !file.startsWith('.sdk/log/')))
      const before = committed(plain.files())
      ok(before['README.md'].includes(LINKED), 'the out-of-tree target is not named without the override')
      deepStrictEqual(committed(moved.files()), before, 'a committed file differs under the override')
      ok(null != under(moved.files(), OUT2)['go.mod'], 'go-cli was not written where the override says')
      deepStrictEqual(under(moved.files(), OUT), {}, 'go-cli was written to its declared path as well')
      deepStrictEqual(inTree(under(moved.files(), norm(STAGE)), 'go-cli'), [])
    })


    test('leave no per-target file and no folder in tree', async () => {
      const { inside, outside } = await generate(['ts', 'go', 'go-cli'], 'go-cli', REPO)
      ok(null != outside['go.mod'], 'go-cli was not generated out of tree')
      deepStrictEqual(inTree(inside, 'go-cli'), [])
      ok(0 < inTree(inside, 'go').length, 'control: go wrote nothing in tree')
    })
  })


  describe('path back to the SDK project', () => {

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


    test('a sibling destination derives cleanly', async () => {
      const sink: any[] = []
      const gen = setup(['go', 'go-cli'], { 'go-cli': REL },
        { sink })
      await gen.run()

      const warn = sink.find((e: any) => 'external-sdkrel-derived' === e.point)
      strictEqual(warn, undefined,
        'a destination one level from the SDK project should derive cleanly')
    })


    // Outside its documents, a target generated out of tree is the target
    // generated in tree, but for the path back, which every reader of the
    // project's `.sdk` and `.env.local` takes from the run.
    test('every SDK target reads the project through its declared path back', async () => {
      const all = Fs.readdirSync(Path.join(SCAFFOLD, 'model', 'target'))
        .filter((f: string) => f.endsWith('.aontu') && !f.includes('-index'))
        .map((f: string) => f.replace(/\.aontu$/, ''))
      const kit = makeModel(all).main.kit
      const sdks = all.filter((t: string) => 'sdk' === fact(kit.target[t], 'surface'))
      ok(15 < sdks.length, 'expected every bundled SDK target: ' + sdks.join(', '))

      // The ts README example test reads whichever README the placement writes.
      const code = (tree: Record<string, string>) => Object.keys(tree)
        .filter((path: string) => !path.endsWith('.md') && 'test/ReadmeExample.test.ts' !== path).sort()

      for (const t of sdks) {
        const tree = under((await generate([t], {})).inside, t)
        const away = (await generate([t], t,
          `main: kit: target: '${t}': output: sdkrel: '../../zzproj'`)).outside

        deepStrictEqual(code(away), code(tree), t + ': out of tree writes other files')
        // A target out of tree is not the tree's one npm package, its release
        // tag follows the tag fact, and its rockspec builds from the root of
        // the clone.
        const placed = (text: string) => text.replace(/^TAG := .*$/m, 'TAG :=')
          .replace(/^  dir = ".*"$/m, '  dir =')
        const differ = code(tree).filter((path: string) =>
          placed(away[path].split('../../zzproj').join('..')) !== placed(tree[path]))
        deepStrictEqual(differ, [], t + ': these differ from the in-tree files by more than the path back')
        ok(code(away).some((path: string) => away[path].includes('zzproj')),
          t + ': no file names the declared path back')
        deepStrictEqual(code(away).filter((path: string) => IN_TREE_BACK.test(away[path])), [],
          t + ': these still walk back to the project as they do in tree')
      }
    })


    // The live tests read `.env.local` from the project, so the how-to says
    // where that is from the README's own directory.
    test('a how-to puts .env.local where the live tests read it', async () => {
      for (const t of ['ts', 'go', 'rust']) {
        const tree = under((await generate([t], {})).inside, t)
        const away = (await generate([t], t,
          `main: kit: target: '${t}': output: sdkrel: '../../zzproj'`)).outside

        ok(tree['README.md'].includes('Create a `.env.local` file at the project root:'),
          t + ': in tree the file is not at the project root')
        ok(away['README.md'].includes('Create a `.env.local` file in the SDK project that ' +
          'generates this package, `../../zzproj/` from this directory:'),
          t + ': out of tree the README does not name the path back')
      }
    })


    // Out of tree the reader of a target's README stands in its directory.
    test('a relocated target\'s documents enter no folder of the SDK repository', async () => {
      for (const t of ['ts', 'go', 'c']) {
        const away = (await generate([t], t,
          `main: kit: target: '${t}': output: sdkrel: '../../zzproj'`)).outside
        const entered = Object.keys(away).flatMap((path: string) => away[path].split('\n')
          .filter((line: string) => new RegExp('\\bcd ' + t + '\\b|(?<![\\w/.-])' + t + '/core\\b').test(line))
          .map((line: string) => path + ': ' + line))
        deepStrictEqual(entered, [], t + ': a relocated tree enters ' + t + '/')
      }
    })


    test('a relocated ts runs the quick start of its own README', async () => {
      const read = "const readmePath = Path.join(__dirname, '..', "
      const tree = under((await generate(['ts'], {})).inside, 'ts')
      ok(tree['test/ReadmeExample.test.ts'].includes(read + "'../README.md')"),
        'in tree the test does not read the root README')
      const away = (await generate(['ts'], 'ts',
        "main: kit: target: ts: output: sdkrel: '../../zzproj'")).outside
      ok(away['test/ReadmeExample.test.ts'].includes(read + "'README.md')"),
        'out of tree the test does not read its own README')
      ok(away['test/ReadmeExample.test.ts'].includes("'Tutorial: your first API call'"),
        'out of tree the test does not read the tutorial')
    })


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


    // The enclosing case is refused by DEFAULT even when a path override
    // produced it. Overriding a path is one decision; writing over the
    // directory holding the project is a second, worse one, and the refusal
    // has to say what to do about it.
    test('an override that encloses the project is refused without the opt-in',
      async () => {
        const { msg } = await refuse(['go', 'go-cli'], { 'go-cli': OUT },
          { external: { 'go-cli': { path: '..' } } })

        ok(msg.includes('contains the SDK project'),
          'unexpected refusal reason:\n' + msg)
        ok(msg.includes('enclosing: true'),
          'the refusal does not say how to allow it:\n' + msg)
      })


    test('`output: root` together with `output: path` is refused', async () => {
      const { msg, files } = await refuse(['go', 'go-cli'], { 'go-cli': OUT },
        { extra: "main: kit: target: 'go-cli': output: root: true" })

      ok(msg.includes('`output: path` and `output: root: true`'),
        'unexpected refusal reason:\n' + msg)
      ok(msg.includes('go-cli'), 'the message does not name the target:\n' + msg)

      deepStrictEqual(Object.keys(files), [],
        'the refusal came too late — the in-tree pass had already written')
    })


    // An override is for this run, and relocates a root target like any other.
    test('an override relocates a target the model generates at the root', async () => {
      const gen = setup(['go', 'go-cli'], {}, {
        external: { 'go-cli': { path: OUT2 } },
        extra: "main: kit: target: 'go-cli': output: root: true",
      })
      await gen.run()

      ok(0 < Object.keys(under(gen.files(), OUT2)).length,
        'nothing landed at the overridden path')
    })


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


    test('an empty destination is accepted', async () => {
      const { outside } = await generate(['go', 'go-cli'],
        'go-cli', '',
        { seed: { [OUT + '/.git/HEAD']: 'ref: refs/heads/main\n' } })

      ok(null != outside['go.mod'],
        'an empty git repo was refused')
    })

  })

  describe('output overridden at generate time', () => {

    test('the override decides the destination, not the model', async () => {
      const gen = setup(['go', 'go-cli'], { 'go-cli': OUT },
        { external: { 'go-cli': { path: OUT2 } } })
      await gen.run()

      const all = gen.files()
      ok(0 < Object.keys(under(all, OUT2)).length,
        'nothing landed at the overridden path: ' + Object.keys(all).join(', '))
      deepStrictEqual(under(all, OUT), {},
        'the model path was written as well as the override')
    })


    test('the override does not write back into the model', async () => {
      const gen = setup(['go', 'go-cli'], { 'go-cli': OUT },
        { external: { 'go-cli': { path: OUT2, sdkrel: '.sdksrc/x' } } })

      await gen.run()

      const output = (gen.model as any).main.kit.target['go-cli'].output
      strictEqual(output.path, OUT,
        'the override overwrote the model\'s output path')
      ok(null == output.sdkrel || '' === output.sdkrel,
        'the override wrote an sdkrel into the model: ' + output.sdkrel)
    })


    test('`enclosing` permits writing into a folder that holds the project',
      async () => {
        const gen = setup(['go', 'go-cli'], { 'go-cli': OUT },
          { external: { 'go-cli': { path: '..', enclosing: true } } })

        const res = await gen.run()
        strictEqual(res.ok, true, 'generation did not report ok')

        const parent = norm(Path.resolve(STAGE, '..'))
        const landed = Object.keys(gen.files())
          .filter((f) => f.startsWith(parent + '/') && !f.includes('/.jostraca/'))

        ok(0 < landed.length, 'nothing landed in the enclosing folder')
      })


    test('an enclosing run does not remove the project it generates from',
      async () => {
        const gen = setup(['go', 'go-cli'], { 'go-cli': OUT },
          { external: { 'go-cli': { path: '..', enclosing: true } } })
        await gen.run()

        ok(0 < Object.keys(under(gen.files(), norm(STAGE))).length,
          'the SDK project was emptied by generating into its parent')
      })


    test('an enclosing layout does not warn about the derived path back',
      async () => {
        const sink: any[] = []
        const gen = setup(['go', 'go-cli'], { 'go-cli': OUT },
          { external: { 'go-cli': { path: '../..', enclosing: true } }, sink })
        await gen.run()

        const warn = sink.find((e: any) => 'external-sdkrel-derived' === e.point)
        strictEqual(warn, undefined,
          'warned about a path back that descends: ' + JSON.stringify(warn))
      })


    test('the override can set the path back to the SDK project', async () => {
      const sink: any[] = []
      const gen = setup(['go', 'go-cli'], { 'go-cli': OUT },
        { external: { 'go-cli': { sdkrel: '.sdksrc/acme-sdk' } }, sink })
      await gen.run()

      strictEqual(sink.find((e: any) => 'external-sdkrel-derived' === e.point),
        undefined,
        'an overridden path back was derived — and warned about — anyway')
    })


    describe('SDKGEN_EXTERNAL', () => {

      let saved: string | undefined

      before(() => { saved = process.env.SDKGEN_EXTERNAL })
      after(() => {
        if (undefined === saved) delete process.env.SDKGEN_EXTERNAL
        else process.env.SDKGEN_EXTERNAL = saved
      })

      test('the environment overrides the destination', async () => {
        process.env.SDKGEN_EXTERNAL = JSON.stringify({ 'go-cli': { path: OUT2 } })

        const gen = setup(['go', 'go-cli'], { 'go-cli': OUT })
        await gen.run()

        ok(0 < Object.keys(under(gen.files(), OUT2)).length,
          'SDKGEN_EXTERNAL did not move the destination')
      })


      test('the environment wins over the build option', async () => {
        process.env.SDKGEN_EXTERNAL = JSON.stringify({ 'go-cli': { path: OUT2 } })

        const gen = setup(['go', 'go-cli'], { 'go-cli': OUT },
          { external: { 'go-cli': { path: '/elsewhere/ignored' } } })
        await gen.run()

        ok(0 < Object.keys(under(gen.files(), OUT2)).length,
          'the build option won over the environment')
      })


      test('the override is logged', async () => {
        process.env.SDKGEN_EXTERNAL = JSON.stringify({ 'go-cli': { path: OUT2 } })

        const sink: any[] = []
        const gen = setup(['go', 'go-cli'], { 'go-cli': OUT }, { sink })
        await gen.run()

        const entry = sink.find((e: any) => 'external-override' === e.point)
        ok(null != entry, 'the override was applied without a log entry')
        ok(String(entry.items).includes('go-cli'),
          'the log entry does not name the item: ' + JSON.stringify(entry))
      })


      // A malformed variable must not fall through to the model's path: that
      // would publish a green run that generated somewhere else entirely.
      test('malformed JSON is refused, naming the variable', async () => {
        process.env.SDKGEN_EXTERNAL = '{not json'

        const gen = setup(['go', 'go-cli'], { 'go-cli': OUT })

        let err: any = null
        try { await gen.run() } catch (e: any) { err = e }

        ok(null != err, 'a malformed SDKGEN_EXTERNAL was accepted')
        ok(String(err.message).includes('SDKGEN_EXTERNAL'),
          'the error does not name the variable: ' + err.message)
      })


      test('a name that is not a target is refused, naming it', async () => {
        process.env.SDKGEN_EXTERNAL = JSON.stringify({ 'go-clii': { path: OUT2 } })

        const gen = setup(['go', 'go-cli'], { 'go-cli': OUT })

        let err: any = null
        try { await gen.run() } catch (e: any) { err = e }

        ok(null != err, 'an override naming no target was accepted')
        ok(/SDKGEN_EXTERNAL names go-clii, which is not a target of this model/.test(String(err.message)),
          err.message)
        ok(/go-cli/.test(String(err.message).split('\n')[1]), 'the error does not list the targets: ' + err.message)
      })


      test('a JSON array is refused', async () => {
        process.env.SDKGEN_EXTERNAL = '[{"path":"/elsewhere/x"}]'

        const gen = setup(['go', 'go-cli'], { 'go-cli': OUT })

        let err: any = null
        try { await gen.run() } catch (e: any) { err = e }

        ok(null != err, 'a JSON array was accepted')
        ok(String(err.message).includes('OBJECT'),
          'the error does not say what was expected: ' + err.message)
      })
    })
  })
})
