
import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { Aontu } from 'aontu'
import { Jostraca, Project, Folder, File, names } from 'jostraca'
import { memfs } from 'memfs'

import { ReadmeErrors, ReadmeExplanation, ReadmeTop, SdkGen, applyFacts, cmp } from '../dist/sdkgen.js'

import { makeProject, targetRef, target_add, SCAFFOLD, ROOT } from './actionharness'
import { STAGE, SCAFFOLD as SDK_SCAFFOLD, makeModel, makeRoot, layeredFs, makeLog, aliasModel, stageAlias } from './generateharness'


function scaffoldCmpFiles(target: string): string[] {
  const root = Path.join(SCAFFOLD, 'src', 'cmp', target)
  const out: string[] = []

  const walk = (dir: string, rel: string) => {
    for (const ent of Fs.readdirSync(dir, { withFileTypes: true })) {
      const childRel = '' === rel ? ent.name : rel + '/' + ent.name
      if (ent.isDirectory()) {
        walk(Path.join(dir, ent.name), childRel)
      }
      else {
        out.push(childRel)
      }
    }
  }

  walk(root, '')
  return out.sort()
}


async function addAlias(ref: string, alias: string) {
  const project = makeProject({})
  await target_add([targetRef(ref) + '~' + alias], project.actx)
  return project
}


describe('aliased target add', () => {

  test('the model file lands under the ALIAS name', async () => {
    const project = await addAlias('go', 'go2')
    const files = project.files()

    ok(files.includes('model/target/go2.aontu'),
      'no model/target/go2.aontu; got: ' +
      files.filter((f) => f.startsWith('model/target/')).join(', '))
    ok(!files.includes('model/target/go.aontu'),
      'the origin-named model file was written as well')
  })


  test('the index names a file that EXISTS', async () => {
    const project = await addAlias('go', 'go2')
    const index = project.fs.readFileSync(
      ROOT + '/model/target/target-index.aontu', 'utf8')

    ok(index.includes('@"./go2.aontu"'), 'index does not name the alias')

    for (const m of String(index).matchAll(/@"(?:\.\/)?([^"]+)"/g)) {
      ok(project.files().includes('model/target/' + m[1]),
        'target-index.aontu includes ' + m[1] + ', which was never written')
    }
  })


  test('the copied model DECLARES the alias', async () => {
    const project = await addAlias('go', 'go2')
    const src = project.fs.readFileSync(ROOT + '/model/target/go2.aontu', 'utf8')

    ok(/main:\s*kit:\s*target:\s*go2:/.test(src),
      'model does not declare `main: kit: target: go2:`')
    ok(!/main:\s*kit:\s*target:\s*go:/.test(src),
      'model still declares the ORIGIN target')
  })


  test('the per-target feature-deps slot moves with it', async () => {
    // Every shipped target model carries
    // `main: kit: feature: &: target: <t>: deps: &: { kind: ... }`. It
    // belongs to the installed target, so it has to be keyed by the alias.
    const project = await addAlias('go', 'go2')
    const src = project.fs.readFileSync(ROOT + '/model/target/go2.aontu', 'utf8')

    ok(/feature:\s*&:\s*target:\s*go2:/.test(src),
      'the feature-deps slot still names the origin target')
  })


  test('a QUOTED target key is rewritten too', async () => {
    const project = await addAlias('go-cli', 'cli2')
    const src = project.fs.readFileSync(ROOT + '/model/target/cli2.aontu', 'utf8')

    ok(/target:\s*'cli2':/.test(src),
      'quoted target key not rewritten: ' +
      String(src).split('\n').filter((l) => l.includes('target:')).slice(0, 3).join(' | '))
    ok(!/target:\s*'go-cli':/.test(src),
      'model still declares the origin target')
  })


  test('an alias needing QUOTES gets them, whatever the origin used', async () => {
    // aontu rejects a bare key containing a hyphen ("unexpected
    // character(s): -"), so preserving the origin's unquoted style for
    // `go~go-alt` produced a model that could not compile at all — the
    // failure the alias repair exists to remove, reintroduced from the other
    // side.
    const project = await addAlias('go', 'go-alt')
    const src = project.fs.readFileSync(
      ROOT + '/model/target/go-alt.aontu', 'utf8')

    ok(/target:\s*'go-alt':/.test(src),
      'hyphenated alias key was not quoted: ' +
      String(src).split('\n').filter((l) => l.includes('target:')).slice(0, 3).join(' | '))

    const errs: any[] = []
    new Aontu().generate(src, {
      path: Path.join(SCAFFOLD, 'model', 'target', 'go-alt.aontu'), errs,
    })
    strictEqual(errs.length, 0, 'hyphenated alias model did not compile: ' +
      errs.map((e: any) => e.msg || String(e)).join(' | '))
  })


  test('an existing aliased model is PRESERVED on resync', async () => {
    const project = makeProject({})
    await target_add([targetRef('go') + '~go2'], project.actx)

    const edited = project.fs.readFileSync(
      ROOT + '/model/target/go2.aontu', 'utf8') +
      "\nmain: kit: target: go2: module: path: 'example.com/second/go2'\n"
    project.fs.writeFileSync(ROOT + '/model/target/go2.aontu', edited)

    await target_add([targetRef('go') + '~go2'], project.actx)

    const after = project.fs.readFileSync(
      ROOT + '/model/target/go2.aontu', 'utf8')
    strictEqual(after, edited,
      'the resync reverted the project\'s edits to its aliased target model')
  })


  test('the components and templates DO resync for an alias', async () => {
    // Only the model file is project-owned. The vendored component and
    // template trees are toolchain-owned for an alias exactly as for any
    // other target, so a resync in overwrite mode still refreshes them.
    const project = makeProject({ copies: 'overwrite' })
    await target_add([targetRef('go') + '~go2'], project.actx)

    project.fs.writeFileSync(
      ROOT + '/src/cmp/go2/Main_go2.ts', '// clobbered\n')

    await target_add([targetRef('go') + '~go2'], project.actx)

    const after = project.fs.readFileSync(
      ROOT + '/src/cmp/go2/Main_go2.ts', 'utf8')
    ok('// clobbered\n' !== after,
      'a resync did not refresh the aliased component tree')
    ok(after.includes("from './Package_go2'"),
      'the refreshed component lost its alias rewrites')
  })


  test('the target keeps its own VALUES', async () => {
    // The rewrite matches on `target: <name>:` rather than on the bare name,
    // so a value that happens to equal the target name (`ext: go`) survives.
    const project = await addAlias('go', 'go2')
    const src = project.fs.readFileSync(ROOT + '/model/target/go2.aontu', 'utf8')

    ok(/ext:\s*go\b/.test(src) && !/ext:\s*go2\b/.test(src),
      'the alias rewrite corrupted `ext`')
  })


  test('every component is renamed to the alias suffix', async () => {
    const project = await addAlias('go', 'go2')

    const got = project.files()
      .filter((f) => f.startsWith('src/cmp/go2/'))
      .map((f) => f.slice('src/cmp/go2/'.length))
      .sort()

    const want = scaffoldCmpFiles('go')
      .map((f) => f.replace(/_go(\.[^.]+)$/, '_go2$1'))
      .sort()

    deepStrictEqual(got, want, 'aliased cmp tree does not match the origin tree')

    ok(got.includes('Main_go2.ts'),
      'no Main_go2.ts — the `cmp/<t>/Main_<t>` dispatch cannot resolve')
    ok(!got.some((f) => /_go\.(ts|json)$/.test(f)),
      'a component kept the origin suffix')
  })


  test('the fragment folder is preserved, and its files are NOT renamed', async () => {
    const project = await addAlias('go', 'go2')
    const frags = project.files()
      .filter((f) => f.startsWith('src/cmp/go2/fragment/'))

    ok(0 < frags.length, 'the fragment folder was not copied')
    ok(frags.some((f) => f.endsWith('Main.fragment.go')),
      'fragment files were renamed: ' + frags.join(', '))
  })


  test('sibling imports point at the aliased files', async () => {
    const project = await addAlias('go', 'go2')
    const main = project.fs.readFileSync(
      ROOT + '/src/cmp/go2/Main_go2.ts', 'utf8')

    ok(main.includes("from './Package_go2'"),
      'sibling import not rewritten: ' +
      String(main).split('\n').filter((l) => l.includes('import')).join(' | '))
    ok(!/_go['"]/.test(main), 'an origin-suffixed import survived')
  })


  test('the import QUOTE STYLE is preserved', async () => {
    // Regression: rewriting through jostraca's `replace` map canonicalises
    // each key into a regex group NAME, and `_go'` / `_go"` reduce to the
    // same one — so the double-quote entry won and every single-quoted
    // import came out as `from './Package_go2"`, which does not parse.
    const project = await addAlias('go', 'go2')
    const main = project.fs.readFileSync(
      ROOT + '/src/cmp/go2/Main_go2.ts', 'utf8')

    ok(!/'[^'\n]*_go2"/.test(main), 'an import quote was flipped to "')
    ok(!/"[^"\n]*_go2'/.test(main), "an import quote was flipped to '")
  })


  test('the fragment path points into the ALIAS folder', async () => {
    // The fragments are copied to the alias's folder. Left alone, the origin
    // path either misses or — if the origin target is ALSO installed —
    // silently reads that target's fragments.
    const project = await addAlias('go', 'go2')
    const main = project.fs.readFileSync(
      ROOT + '/src/cmp/go2/Main_go2.ts', 'utf8')

    ok(main.includes('src/cmp/go2/fragment/'),
      'fragment path not rewritten to the alias folder')
    ok(!main.includes('src/cmp/go/fragment/'),
      'fragment path still reads the origin folder')
  })


  test('a file EXTENSION matching the target name is untouched', async () => {
    const project = await addAlias('go', 'go2')
    const main = project.fs.readFileSync(
      ROOT + '/src/cmp/go2/Main_go2.ts', 'utf8')

    ok(main.includes('Main.fragment.go'),
      'the `.go` extension in the fragment filename was rewritten')
    ok(!main.includes('Main.fragment.go2'),
      'the fragment filename gained the alias suffix')
  })


  test('the template tree lands under the alias', async () => {
    const project = await addAlias('go', 'go2')
    const tm = project.files().filter((f) => f.startsWith('tm/go2/'))

    ok(0 < tm.length, 'no tm/go2 tree')
    ok(!project.files().some((f) => f.startsWith('tm/go/')),
      'the origin template tree was written as well')
  })


  test('the aliased model COMPILES, and declares the alias', async () => {
    // The end-to-end version of the claims above: a shipped target model is
    // self-contained (readTargetFeature parses each one standalone), so the
    // aliased copy must still compile and must define main.kit.target.<alias>
    // and nothing under the origin name.
    const project = await addAlias('go', 'go2')
    const src = project.fs.readFileSync(ROOT + '/model/target/go2.aontu', 'utf8')

    const errs: any[] = []
    const model = new Aontu().generate(src, {
      path: Path.join(SCAFFOLD, 'model', 'target', 'go2.aontu'), errs,
    })

    strictEqual(errs.length, 0, 'aliased model did not compile: ' +
      errs.map((e: any) => e.msg || String(e)).join(' | '))

    const targets = model?.main?.kit?.target || {}
    ok(null != targets.go2, 'compiled model has no `go2` target')
    ok(null == targets.go, 'compiled model still carries the origin `go` target')

    strictEqual(targets.go2.ext, 'go', 'the alias lost its `ext`')
  })


  test('an unaliased add still writes the origin names', async () => {
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)
    const files = project.files()

    ok(files.includes('model/target/go.aontu'), 'no model/target/go.aontu')
    ok(files.includes('src/cmp/go/Main_go.ts'), 'no src/cmp/go/Main_go.ts')
  })
})


// An alias writes its origin's wording, and names its variables by its origin's rules.
describe('aliased target documents', () => {

  const quiet: any = { info() {}, debug() {}, warn() {}, error() {}, trace() {}, fatal() {} }
  quiet.child = () => quiet

  const model = () => applyFacts({
    name: 'demo',
    const: { name: 'demo', Name: 'Demo' },
    main: { kit: {
      target: { go: { name: 'go' }, go2: { name: 'go2', origname: 'go' } },
      entity: {
        // `func` is reserved in go but not in ts.
        func: {
          active: true, name: 'func', fields: { id: { n: 'id' } },
          op: { load: { active: true, points: [{ params: [{ n: 'id', t: '$STRING' }] }] } },
        },
      },
      feature: {
        test: { active: true, name: 'test', title: 'Test mode (offline)', config: { options: { active: false } } },
      },
    } },
  })

  async function render(comp: any, target: string): Promise<string> {
    const { fs, vol } = memfs({})
    await Jostraca().generate({ fs: () => fs, folder: '/x', model: model(), log: quiet }, () => {
      Project({ folder: 'p' }, () => Folder({ name: 'd' }, () => File({ name: 'out.md' }, () => {
        comp({ target: { name: target } })
      })))
    })
    const json: any = vol.toJSON()
    return json[Object.keys(json).find((k) => k.endsWith('out.md'))!]
  }

  test('go~go2 error handling and entity state equal go\'s', async () => {
    for (const comp of [ReadmeErrors, ReadmeExplanation]) {
      const go = await render(comp, 'go')
      strictEqual(await render(comp, 'go2'), go)
      ok(go.includes('```go\n'))
      ok(!go.includes('```ts'))
    }
    ok((await render(ReadmeErrors, 'go2')).includes('func_, err := '))
  })
})


// Only the root README, which needs no target's own components.
const TopOnly = cmp(function TopOnly(props: any) {
  const { model, ctx$ } = props
  model.const = { name: model.name }
  names(model.const, model.name)
  names(model, model.name)
  ctx$.model = model
  ctx$.stdrep = {}
  Project({}, () => ReadmeTop({}))
})


// What a generate run writes, keyed relative to the stage, less the records
// whose timestamps differ from run to run.
async function generated(targets: string[], extra = '', root = makeRoot()): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog([]) })
  await sdkgen.generate({ model: makeModel(targets, undefined, extra), root })
  const out: Record<string, string> = {}
  for (const [path, text] of Object.entries(vol.toJSON() as Record<string, string>)) {
    const file = Path.relative(STAGE, path).split(Path.sep).join('/')
    if (!file.startsWith('.jostraca/') && !file.startsWith('.sdk/log/')) out[file] = text
  }
  return out
}


// What `<origin>~<alias>` alone generates. Components read their templates
// relative to the working directory, so the alias's are copied into one.
async function generatedAlias(origin: string, alias: string): Promise<Record<string, string>> {
  const staged = stageAlias(origin, alias)
  const work = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-alias-'))
  const cwd = process.cwd()
  try {
    Fs.cpSync(Path.join(SDK_SCAFFOLD, 'tm', origin), Path.join(work, 'tm', alias), { recursive: true })
    process.chdir(work)
    return await generated([], staged.model)
  }
  finally {
    process.chdir(cwd)
    staged.remove()
    Fs.rmSync(work, { recursive: true, force: true })
  }
}


// An alias is classed by its origin: the documents name the alias where they
// named the origin, and say nothing else differently.
describe('aliased targets in the generated documents', () => {

  // A target's templates are copied from `tm/<target>` under the working directory.
  let cwd = ''
  before(() => {
    cwd = process.cwd()
    process.chdir(SDK_SCAFFOLD)
  })
  after(() => {
    if ('' !== cwd) process.chdir(cwd)
  })

  test('go-cli~go-clj and go-mcp~go-mcq write what go-cli and go-mcp write', async () => {
    const base = await generated(['go', 'go-cli', 'go-mcp'])
    const staged = [stageAlias('go-cli', 'go-clj'), stageAlias('go-mcp', 'go-mcq')]
    try {
      const out = await generated(['go'], staged.map((s) => s.model).join('\n'))
      const back = (text: string) => text.split('go-clj').join('go-cli').split('go-mcq').join('go-mcp')
      const mapped: Record<string, string> =
        Object.fromEntries(Object.entries(out).map(([file, text]) => [back(file), back(text)]))

      deepStrictEqual(Object.keys(mapped).sort(), Object.keys(base).sort())
      for (const file of Object.keys(base)) {
        strictEqual(mapped[file], base[file], file + ' differs once the aliases are mapped back')
      }
      ok(out['README.md'].includes('## Use it from an AI agent (MCP)'), 'no MCP section for go-mcq')
      ok(out['README.md'].includes('cd go-mcq && go build'), 'the MCP section builds another directory')
    }
    finally {
      staged.forEach((s) => s.remove())
    }
  })

  // The add writes the origin's templates to `tm/<alias>`, which a generate
  // reads from its working directory.
  test('go~fz enters its own folder, never the origin\'s', async () => {
    const staged = stageAlias('go', 'fz')
    const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-alias-'))
    Fs.mkdirSync(Path.join(tmp, 'tm'))
    Fs.symlinkSync(Path.join(SDK_SCAFFOLD, 'tm', 'go'), Path.join(tmp, 'tm', 'fz'))
    const back = process.cwd()
    try {
      process.chdir(tmp)
      const out = await generated([], staged.model)
      const files = Object.keys(out).filter((file: string) => file.startsWith('fz/'))
      ok(0 < files.length, 'nothing generated for fz')
      ok(out['fz/README.md'].includes('cd fz && go test'), 'the how-to does not enter fz/')
      ok(out['fz/Makefile'].includes('\nTAG := fz/v$(VERSION)\n'), 'the Makefile tags another folder')
      ok(out['Makefile'].includes('$(MAKE) -C fz publish'), 'the root Makefile deploys fz elsewhere')
      const origin = files.flatMap((file: string) => out[file].split('\n')
        .filter((line: string) => /\bcd go\b|\.\.\/[\w.-]+\/go\b|\bgo\/v[$\dX]/.test(line))
        .map((line: string) => file + ': ' + line))
      deepStrictEqual(origin, [], 'these name the origin\'s folder')
    }
    finally {
      process.chdir(back)
      staged.remove()
      Fs.rmSync(tmp, { recursive: true, force: true })
    }
  })


  test('go~go2 sorts where go sorts in the root README packages table', async () => {
    const rows = async (targets: string[], extra = '') => {
      const readme = (await generated(targets, extra, TopOnly))['README.md']
      const table = readme.slice(readme.indexOf('## Packages'))
      return table.slice(0, table.indexOf('\n\n', table.indexOf('| ---'))).split('\n').slice(4)
    }
    const base = await rows(['ts', 'py', 'go', 'rb'])
    strictEqual(base.length, 4, 'the packages table does not list the four targets:\n' + base.join('\n'))
    deepStrictEqual((await rows(['ts', 'py', 'rb'], aliasModel('go', 'go2')))
      .map((row: string) => row.split('/go2').join('/go')), base)
  })

  test('ts~ts2 and js~js2 name their files as ts and js do', async () => {
    for (const [origin, alias] of [['ts', 'ts2'], ['js', 'js2']]) {
      const own = Object.keys(await generated([origin])).filter((file) => file.startsWith(origin + '/'))
      const aliased = Object.keys(await generatedAlias(origin, alias))
        .filter((file) => file.startsWith(alias + '/'))
      ok(aliased.some((file) => new RegExp('^' + alias + '/src/entity/[A-Za-z]+\\.' + origin + '$').test(file)),
        alias + ' writes no entity file named as a ' + origin + ' file')
      deepStrictEqual(aliased.map((file) => origin + file.slice(alias.length)).sort(), own.sort())
    }
  })

  test('go~go2 types its fields as go does', async () => {
    const go = await generated(['go'])
    const go2 = await generatedAlias('go', 'go2')
    const typed = (text: string) => text.split('\n').filter((line) => /^\| `[^`]+` \| `[^`]+` \|/.test(line))
    for (const doc of ['README.md', 'REFERENCE.md']) {
      ok(typed(go['go/' + doc]).some((row) => row.includes('`string`')), 'go ' + doc + ' types no field')
      deepStrictEqual(typed(go2['go2/' + doc]), typed(go['go/' + doc]), doc)
    }
  })
})
