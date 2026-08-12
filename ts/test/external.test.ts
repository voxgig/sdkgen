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

import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Path from 'node:path'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen.js'

import { makeModel, makeRoot, layeredFs, makeLog, STAGE, SCAFFOLD } from './generateharness'


// Somewhere that is emphatically not under STAGE, so "did it land outside?"
// is unambiguous.
const OUT = '/elsewhere/acme-provider'


// Generate `targets`, with `external` pointed at OUT, and split the resulting
// volume into what landed in the SDK repo and what landed outside it.
async function generate(targets: string[], external: string, extra = '') {
  const { fs, vol } = memfs({})

  const sdkgen = SdkGen({
    fs: layeredFs(fs),
    folder: STAGE,
    root: '',
    pino: makeLog(),
  })

  const res = await sdkgen.generate({
    model: makeModel(targets, undefined,
      `main: kit: target: '${external}': output: path: '${OUT}'\n` + extra),
    root: makeRoot(),
  })
  strictEqual(res.ok, true, 'generation did not report ok')

  const inside: Record<string, string> = {}
  const outside: Record<string, string> = {}

  for (const [path, content] of Object.entries(vol.toJSON() as Record<string, string>)) {
    const norm = path.split(Path.sep).join('/')
    if (norm.includes('/.jostraca/')) continue

    if (norm.startsWith(OUT + '/')) {
      outside[norm.slice(OUT.length + 1)] = content
    }
    else {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (!rel.startsWith('..')) inside[rel] = content
    }
  }

  return { inside, outside }
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

})
