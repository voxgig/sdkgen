// `docs add` — the third kind. Design §20.
//
// WHAT THIS SUITE IS FOR
//
// The docs kind ships with NO items: sdkgen supplies the mechanism and
// packages supply the destinations (`@voxgig/docgen` first). So the only way
// to exercise it here is against a fixture package — which is exactly what an
// external author's package looks like, and is therefore the right thing to
// test against rather than a convenience.
//
// The invariant under test throughout is the one in CLAUDE.md: anything an
// add WRITES, doctor must COMPARE. A kind whose trees nothing walks would let
// the next add silently revert a project's edit.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { docs_add } from '../dist/action/docs.js'
import { doctor } from '../dist/action/doctor.js'
import { package_add } from '../dist/action/package.js'
import { checkPackage } from '../dist/action/check.js'
import { ROOT, makeProject, recordLog } from './actionharness'


// A package providing one docs item. The components are stubs: what is under
// test is the KIND's mechanism — resolution, provenance, trees, index, drift
// — not what a documentation emitter emits, which is docgen's business.
function makePackage(opts: {
  manifest?: any, tm?: boolean, name?: string,
} = {}): string {
  const name = opts.name ?? 'apidocs'
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-docs-'))
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'docs'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'src', 'cmp', 'docs', name), { recursive: true })

  Fs.writeFileSync(Path.join(sdk, 'model', 'docs', name + '.aontu'),
    `main: kit: docs: ${name}: {\n` +
    `  title: 'API docs'\n` +
    `  base: 'BASE'\n` +
    `}\n`)

  // Dispatched by the convention `cmp/docs/<n>/Main_<n>`, so the file name
  // carries the item name — which is what an alias has to rewrite.
  Fs.writeFileSync(
    Path.join(sdk, 'src', 'cmp', 'docs', name, 'Main_' + name + '.ts'),
    "import { cmp } from '@voxgig/sdkgen'\n" +
    'const Main = cmp(function Main() { })\n' +
    'export { Main }\n')

  if (false !== opts.tm) {
    Fs.mkdirSync(Path.join(sdk, 'tm', 'docs', name), { recursive: true })
    Fs.writeFileSync(Path.join(sdk, 'tm', 'docs', name, 'site.md'),
      '# ProjectName docs\n')
  }

  Fs.writeFileSync(Path.join(dir, 'sdkgen-package.json'),
    JSON.stringify(opts.manifest ?? {
      sdkgen: { package: 1 },
      name: '@acme/sdkgen-docs',
      version: '1.0.0',
      provides: { docs: [name] },
    }, null, 2))

  return dir
}


function docsRef(pkg: string, name = 'apidocs'): string {
  return Path.join(pkg, name)
}


function read(project: any, rel: string): string {
  return String(project.fs.readFileSync(ROOT + '/' + rel, 'utf8'))
}


describe('docs add', () => {

  test('installs the definition, the components and the templates', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await docs_add([docsRef(pkg)], project.actx)

      const files = project.files()

      ok(files.includes('model/docs/apidocs.aontu'), files.join(','))
      ok(files.includes('src/cmp/docs/apidocs/Main_apidocs.ts'), files.join(','))
      ok(files.includes('tm/docs/apidocs/site.md'), files.join(','))

      // The index, or the model never compiles the new item in at all.
      ok(read(project, 'model/docs/docs-index.aontu').includes('@"apidocs.aontu"'))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('the trees are NESTED under the kind', async () => {
    // `src/cmp/docs/<n>`, not `src/cmp/<n>` — so a docs item and a target may
    // share a name without sharing a directory. A docs item called `go` must
    // not land on top of the go target's components.
    const pkg = makePackage({ name: 'go' })
    try {
      const project = makeProject()
      await docs_add([docsRef(pkg, 'go')], project.actx)

      const files = project.files()

      ok(files.includes('src/cmp/docs/go/Main_go.ts'), files.join(','))
      ok(!files.some((f: string) => f.startsWith('src/cmp/go/')),
        'a docs item landed in the target component tree: ' + files.join(','))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('records where it came from', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await docs_add([docsRef(pkg)], project.actx)

      const src = read(project, 'model/docs/apidocs.aontu')

      ok(src.includes("base: '"), 'no provenance stamp:\n' + src)
      ok(!src.includes("base: 'BASE'"), 'the anchor was not replaced:\n' + src)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a package with NO template tree installs fine', async () => {
    // A docs item whose every emitted byte depends on the API — a catalogue
    // entry, a config file — ships no `tm`. That is declared optional in the
    // registry, so it must not be an error here or in manifest validation.
    const pkg = makePackage({ tm: false })
    try {
      const project = makeProject()
      await docs_add([docsRef(pkg)], project.actx)

      const files = project.files()

      ok(files.includes('src/cmp/docs/apidocs/Main_apidocs.ts'))
      ok(!files.some((f: string) => f.startsWith('tm/docs/')),
        'templates appeared from nowhere: ' + files.join(','))

      const report = checkPackage(pkg, project.actx)
      strictEqual(report.errors, 0,
        report.findings.map((f: any) => f.note).join('\n'))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('an ALIAS renames the item, its trees and its components', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await docs_add([docsRef(pkg) + '~portal'], project.actx)

      const files = project.files()

      ok(files.includes('model/docs/portal.aontu'), files.join(','))
      // Dispatch is by convention, so the component file has to move with the
      // name or nothing loads it.
      ok(files.includes('src/cmp/docs/portal/Main_portal.ts'), files.join(','))
      ok(files.includes('tm/docs/portal/site.md'), files.join(','))

      const src = read(project, 'model/docs/portal.aontu')
      ok(src.includes('docs: portal:'), 'the model key was not rewritten:\n' + src)
      ok(src.includes("origname: 'apidocs'"), 'no origname recorded:\n' + src)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a ref that resolves to nothing says where it looked', async () => {
    const project = makeProject()
    await rejects(
      () => docs_add(['@acme/nope/apidocs'], project.actx),
      /Docs folder not found/)
  })

})


describe('docs and the whole-package verbs', () => {

  test('`package add` installs a docs item', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await package_add([pkg], project.actx)

      const files = project.files()
      ok(files.includes('model/docs/apidocs.aontu'), files.join(','))
      ok(files.includes('src/cmp/docs/apidocs/Main_apidocs.ts'), files.join(','))

      const src = read(project, 'model/docs/apidocs.aontu')
      ok(src.includes("package: '@acme/sdkgen-docs'"),
        'no package provenance:\n' + src)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a manifest claiming a docs item it does not ship is refused', async () => {
    const pkg = makePackage({
      manifest: {
        sdkgen: { package: 1 },
        name: '@acme/sdkgen-docs',
        provides: { docs: ['apidocs', 'ghost'] },
      },
    })
    try {
      const project = makeProject()
      await rejects(() => package_add([pkg], project.actx),
        /does not match the package[\s\S]*ghost/)

      // Nothing installed: validation runs before the loop writes anything.
      ok(!project.files().some((f: string) => f.startsWith('model/docs/')),
        'a refused package still wrote files')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('`package check` validates a docs package', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      const report = checkPackage(pkg, project.actx)

      strictEqual(report.errors, 0,
        report.findings.map((f: any) => f.note).join('\n'))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a docs definition with no anchor is an error', async () => {
    const pkg = makePackage()
    try {
      const file = Path.join(pkg, '.sdk', 'model', 'docs', 'apidocs.aontu')
      Fs.writeFileSync(file,
        String(Fs.readFileSync(file, 'utf8')).replace("  base: 'BASE'\n", ''))

      const project = makeProject()
      const report = checkPackage(pkg, project.actx)

      ok(report.findings.some((f: any) => 'model-anchor-missing' === f.point),
        report.findings.map((f: any) => f.point).join(','))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })

})


describe('doctor sees docs', () => {

  // ANYTHING AN ADD WRITES, DOCTOR MUST COMPARE (CLAUDE.md). A kind whose
  // trees nothing walks lets the next add silently revert a project's edit,
  // which is the failure the whole drift check exists to prevent.

  async function installed(pkg: string) {
    const project = makeProject()
    await docs_add([docsRef(pkg)], project.actx)
    return project
  }

  test('a clean install reports no drift', async () => {
    const pkg = makePackage()
    try {
      const project = await installed(pkg)
      const res: any = await doctor(project.actx)

      deepStrictEqual(
        [...res.report.forked, ...res.report.edited,
        ...res.report.stale, ...res.report.missing],
        [])
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a FORKED component is reported', async () => {
    const pkg = makePackage()
    try {
      const project = await installed(pkg)

      project.fs.writeFileSync(
        ROOT + '/src/cmp/docs/apidocs/Main_apidocs.ts',
        '// a project edit that the next `docs add` would revert\n')

      const res: any = await doctor(project.actx)

      ok(res.report.forked.includes('src/cmp/docs/apidocs/Main_apidocs.ts'),
        JSON.stringify(res.report))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('an EDITED template master is reported', async () => {
    const pkg = makePackage()
    try {
      const project = await installed(pkg)

      project.fs.writeFileSync(ROOT + '/tm/docs/apidocs/site.md', '# edited\n')

      const res: any = await doctor(project.actx)

      ok(res.report.edited.includes('tm/docs/apidocs/site.md'),
        JSON.stringify(res.report))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a MISSING file is reported', async () => {
    const pkg = makePackage()
    try {
      const project = await installed(pkg)

      project.fs.unlinkSync(ROOT + '/src/cmp/docs/apidocs/Main_apidocs.ts')

      const res: any = await doctor(project.actx)

      ok(res.report.missing.includes('src/cmp/docs/apidocs/Main_apidocs.ts'),
        JSON.stringify(res.report))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a template tree the SOURCE does not ship is not missing', async () => {
    // The optional tree again, from doctor's side: `docs add` did not copy
    // it, so the project is right not to have it, and reporting it would make
    // every catalogue-shaped docs package permanently red.
    const pkg = makePackage({ tm: false })
    try {
      const project = await installed(pkg)
      const res: any = await doctor(project.actx)

      deepStrictEqual(res.report.missing, [])
      strictEqual(res.report.ok, true, JSON.stringify(res.report))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })

})
