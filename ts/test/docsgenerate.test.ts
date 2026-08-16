// GENERATING a docs item. Design §20.3.
//
// The kind installs (docs.test.ts); this is the other half — does an
// installed item actually EMIT, and in both trees?
//
// Everything here runs the real `SdkGen.generate` against memfs with a
// project whose docs components are written by the test, because that is what
// a docs package supplies: sdkgen ships the kind and the call, and the
// package ships the emitter.
//
// The two passes are structurally different and both are tested:
//
//   in-tree      — a second `generate()` over the SAME root, so a project
//                  scaffolded before the docs kind existed needs no change to
//                  its frozen Root.ts;
//   out-of-tree  — its own pass rooted at `output: path`, because jostraca
//                  refuses a `..` folder segment and the output root is per
//                  generate() CALL.

import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects, match } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { memfs } from 'memfs'
import { cmp, Project } from 'jostraca'

import { SdkGen } from '../dist/sdkgen.js'
import { layeredFs, makeLog } from './generateharness'


// A project on DISK: the docs emitter is `require`d by path, so it has to be
// a real module. Everything it writes goes to memfs.
//
// `proj` is the SDK repo root and `dir` its PARENT, so an out-of-tree
// destination can be a sibling — which is what one really is, and what the
// "inside the SDK project" refusal exists to distinguish it from.
let dir = ''
let proj = ''
let cwd = ''

before(() => {
  cwd = process.cwd()
  dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-docsgen-'))
  proj = Path.join(dir, 'project')
  Fs.mkdirSync(Path.join(proj, '.sdk'), { recursive: true })
})

after(() => {
  process.chdir(cwd)
  Fs.rmSync(dir, { recursive: true, force: true })
})


// The emitter a docs package would ship: `cmp/docs/<n>/Main_<n>`, exporting
// `Main`. It writes one file naming what it was given, so a test can prove
// both that it ran and that it saw the model.
function writeEmitter(name: string, body?: string) {
  // The COMPILED location: components are reached as
  // `<project>/.sdk/dist/cmp/...` (see utility.resolvePath), which is where a
  // consumer's `npm run build` puts them.
  const cmpdir = Path.join(proj, '.sdk', 'dist', 'cmp', 'docs', name)
  Fs.mkdirSync(cmpdir, { recursive: true })

  // jostraca by ABSOLUTE path: the fixture project is a bare temp directory
  // with no node_modules, and a real docs package would resolve it through
  // its own install.
  const jostraca = JSON.stringify(require.resolve('jostraca'))

  Fs.writeFileSync(Path.join(cmpdir, 'Main_' + name + '.js'), `
const { cmp, File, Content } = require(${jostraca})

const Main = cmp(function Main(props) {
  const { model, docs } = props
  ${body ?? ''}
  File({ name: 'index.md' }, () => {
    Content('# ' + (docs.title || docs.name) + '\\n' +
      'item: ' + docs.name + '\\n' +
      'api: ' + (model.name || '') + '\\n' +
      'targets: ' + Object.keys(model.main.kit.target || {}).sort().join(',') + '\\n')
  })
})

exports.Main = Main
`)
}


function makeModel(docs: Record<string, any>, targets: string[] = ['ts']): any {
  const target: any = {}
  for (const t of targets) {
    target[t] = { name: t, active: true }
  }

  return {
    name: 'demo',
    const: { name: 'demo' },
    main: {
      kit: {
        target,
        feature: {},
        entity: {},
        docs,
      },
    },
  }
}


// The consumer's own Root: it renders the SDK targets and knows nothing about
// docs — which is the whole point. A project scaffolded before the docs kind
// existed has exactly this.
const ConsumerRoot = cmp(function Root(_props: any) {
  Project({}, () => { })
})


// memfs keys with forward slashes; `Path.join` on Windows produces
// backslashes, and the runner's temp dir arrives as an 8.3 short name
// (`RUNNER~1`) that does not match the long form either. So paths are
// compared NORMALISED and by TAIL — the same rule the in-tree assertions
// already followed, and the second time in this workstream a test has been
// written as though `Path.join` and a filesystem key were the same string.
function ends(out: Record<string, string>, tail: string): boolean {
  return Object.keys(out).some(
    (p: string) => p.split('\\').join('/').endsWith(tail))
}


async function generate(model: any): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})

  process.chdir(Path.join(proj, '.sdk'))

  const sdkgen = SdkGen({
    fs: layeredFs(fs),
    // The SDK REPO root, as a consumer's build passes it ('..' from `.sdk`).
    folder: proj,
    root: '',
    pino: makeLog(),
  })

  const res = await sdkgen.generate({ model, root: ConsumerRoot })
  strictEqual(res.ok, true, 'generation did not report ok')

  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(vol.toJSON())) {
    if (path.includes('/.jostraca/')) continue
    out[path] = String(content)
  }
  return out
}


describe('docs generation — in tree', () => {

  test('an installed docs item emits into its own folder', async () => {
    writeEmitter('apidocs')

    const out = await generate(makeModel({
      apidocs: { name: 'apidocs', title: 'API docs', active: true },
    }))

    const file = Object.keys(out).find((p) => p.endsWith('/apidocs/index.md'))

    ok(null != file, 'nothing was emitted: ' + Object.keys(out).join(','))
    match(String(out[file as string]), /item: apidocs/)
  })


  test('the emitter sees the TARGET collection', async () => {
    // The reason docs is a kind and not a target: its input is the target
    // collection. If that were not reaching the emitter, every docs item
    // would be generating in the dark.
    writeEmitter('apidocs')

    const out = await generate(makeModel(
      { apidocs: { name: 'apidocs', active: true } },
      ['ts', 'go', 'py']))

    const file = Object.keys(out).find((p) => p.endsWith('/apidocs/index.md'))

    match(String(out[file as string]), /targets: go,py,ts/)
  })


  test('an INACTIVE item generates nothing', async () => {
    writeEmitter('apidocs')

    const out = await generate(makeModel({
      apidocs: { name: 'apidocs', active: false },
    }))

    ok(!Object.keys(out).some((p) => p.includes('/apidocs/')),
      'an inactive docs item generated: ' + Object.keys(out).join(','))
  })


  test('a project with no docs items generates as before', async () => {
    const out = await generate(makeModel({}))

    ok(!Object.keys(out).some((p) => p.includes('index.md')),
      Object.keys(out).join(','))
  })


  test('two items each get their own folder', async () => {
    writeEmitter('apidocs')
    writeEmitter('portal')

    const out = await generate(makeModel({
      apidocs: { name: 'apidocs', active: true },
      portal: { name: 'portal', active: true },
    }))

    ok(Object.keys(out).some((p) => p.endsWith('/apidocs/index.md')),
      Object.keys(out).join(','))
    ok(Object.keys(out).some((p) => p.endsWith('/portal/index.md')),
      Object.keys(out).join(','))
  })

})


describe('docs generation — out of tree', () => {

  test('an item with `output: path` generates THERE, not in the SDK repo', async () => {
    // Out of tree is the normal case for a docs site: it usually has its own
    // repo, and in-tree it would collide with the SDK repo's own README.
    writeEmitter('site')

    const dest = Path.join(dir, 'sibling-site')

    const out = await generate(makeModel({
      site: { name: 'site', active: true, output: { path: dest } },
    }))

    ok(!ends(out, '/project/site/index.md'),
      'the item also generated in-tree: ' + Object.keys(out).join(','))

    ok(ends(out, '/sibling-site/index.md'),
      'nothing at the destination: ' + Object.keys(out).join(','))
  })


  test('a destination inside the SDK project is refused', async () => {
    writeEmitter('site')

    await rejects(
      () => generate(makeModel({
        site: {
          name: 'site', active: true,
          output: { path: Path.join(proj, 'inside') },
        },
      })),
      /External output path is inside the SDK project[\s\S]*Docs "site"/)
  })


  test('a destination claimed by a TARGET is refused', async () => {
    // The claim map spans kinds: `docs` and `target` are separate namespaces,
    // so two items may share a name — and pointing both at one folder would
    // silently have them overwrite each other, in whatever order the passes
    // run.
    writeEmitter('site')

    const dest = Path.join(dir, 'contested')

    const model = makeModel({
      site: { name: 'site', active: true, output: { path: dest } },
    })

    model.main.kit.target.seneca = {
      name: 'seneca', active: true, output: { path: dest },
    }

    await rejects(() => generate(model),
      /already claimed by (target|docs) "(seneca|site)"/)
  })


  test('an INACTIVE out-of-tree item is not a hazard', async () => {
    // Switching an item off must not require keeping its now-unused path
    // valid — the same rule out-of-tree targets follow.
    writeEmitter('site')

    const out = await generate(makeModel({
      site: {
        name: 'site', active: false,
        output: { path: Path.join(proj, 'would-be-illegal') },
      },
    }))

    ok(!ends(out, 'would-be-illegal/index.md'),
      Object.keys(out).join(','))
  })

})
