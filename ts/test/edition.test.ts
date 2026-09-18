
import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { edition_add } from '../dist/action/edition.js'
import { doctor } from '../dist/action/doctor.js'
import { package_add } from '../dist/action/package.js'
import { checkPackage } from '../dist/action/check.js'
import { ROOT, makeProject, recordLog } from './actionharness'


function makePackage(opts: {
  manifest?: any, tm?: boolean, name?: string,
} = {}): string {
  const name = opts.name ?? 'summary'
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-edition-'))
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'edition'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'src', 'cmp', 'edition', name), { recursive: true })

  Fs.writeFileSync(Path.join(sdk, 'model', 'edition', name + '.aon'),
    `main: kit: doc: edition: ${name}: {\n` +
    `  title: 'API edition'\n` +
    `  base: 'BASE'\n` +
    `}\n`)

  // Dispatched by the convention `cmp/edition/<n>/Main_<n>`, so the file name
  // carries the item name — which is what an alias has to rewrite.
  Fs.writeFileSync(
    Path.join(sdk, 'src', 'cmp', 'edition', name, 'Main_' + name + '.ts'),
    "import { cmp } from '@voxgig/sdkgen'\n" +
    'const Main = cmp(function Main() { })\n' +
    'export { Main }\n')

  if (false !== opts.tm) {
    Fs.mkdirSync(Path.join(sdk, 'tm', 'edition', name), { recursive: true })
    Fs.writeFileSync(Path.join(sdk, 'tm', 'edition', name, 'site.md'),
      '# ProjectName edition\n')
  }

  Fs.writeFileSync(Path.join(dir, 'sdkgen-package.json'),
    JSON.stringify(opts.manifest ?? {
      sdkgen: { package: 1 },
      name: '@acme/sdkgen-edition',
      version: '1.0.0',
      provides: { edition: [name] },
    }, null, 2))

  return dir
}


function editionRef(pkg: string, name = 'summary'): string {
  return Path.join(pkg, name)
}


function read(project: any, rel: string): string {
  return String(project.fs.readFileSync(ROOT + '/' + rel, 'utf8'))
}


describe('edition add', () => {

  test('bare names and aliases use docgen project/.sdk', async () => {
    const pkg = makePackage({ manifest: {
      sdkgen: { package: 1 }, name: '@voxgig/docgen', version: '1.0.0',
      provides: { edition: ['summary'] },
    } })
    try {
      for (const alias of ['', '~partner']) {
        const project = makeProject()
        const base = 'node_modules/@voxgig/docgen/project'
        const copy = (dir: string, rel = '') => {
          for (const entry of Fs.readdirSync(dir, { withFileTypes: true })) {
            const file = Path.join(dir, entry.name)
            const next = Path.join(rel, entry.name)
            if (entry.isDirectory()) copy(file, next)
            else project.vol.fromJSON({ [next]: Fs.readFileSync(file, 'utf8') }, ROOT + '/' + base)
          }
        }
        copy(pkg)
        await edition_add(['summary' + alias], project.actx)
        const name = alias ? 'partner' : 'summary'
        const definition = read(project, 'model/edition/' + name + '.aon')
        ok(definition.includes("base: '" + base + "/.sdk'"), definition)
        ok(definition.includes("package: '@voxgig/docgen'"), definition)
        ok(project.files().includes('tm/edition/' + name + '/site.md'))
      }
    } finally { Fs.rmSync(pkg, { recursive: true, force: true }) }
  })

  test('a bare edition fails if the docgen scaffold is absent', async () => {
    const project = makeProject()
    await rejects(() => edition_add(['summary'], project.actx),
      /Edition folder not found[\s\S]*docgen[/\\]project[/\\]\.sdk/)
  })


  test('installs the definition, the components and the templates', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await edition_add([editionRef(pkg)], project.actx)

      const files = project.files()

      ok(files.includes('model/edition/summary.aon'), files.join(','))
      ok(files.includes('src/cmp/edition/summary/Main_summary.ts'), files.join(','))
      ok(files.includes('tm/edition/summary/site.md'), files.join(','))

      ok(read(project, 'model/edition/edition-index.aon').includes('@"./summary.aon"'))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('the trees are NESTED under the kind', async () => {
    // `src/cmp/edition/<n>`, not `src/cmp/<n>` — so a edition item and a target may
    // share a name without sharing a directory. A edition item called `go` must
    // not land on top of the go target's components.
    const pkg = makePackage({ name: 'go' })
    try {
      const project = makeProject()
      await edition_add([editionRef(pkg, 'go')], project.actx)

      const files = project.files()

      ok(files.includes('src/cmp/edition/go/Main_go.ts'), files.join(','))
      ok(!files.some((f: string) => f.startsWith('src/cmp/go/')),
        'a edition item landed in the target component tree: ' + files.join(','))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('records where it came from', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await edition_add([editionRef(pkg)], project.actx)

      const src = read(project, 'model/edition/summary.aon')

      ok(src.includes("base: '"), 'no provenance stamp:\n' + src)
      ok(!src.includes("base: 'BASE'"), 'the anchor was not replaced:\n' + src)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a package with NO template tree installs fine', async () => {
    // A edition item whose every emitted byte depends on the API — a catalogue
    // entry, a config file — ships no `tm`. That is declared optional in the
    // registry, so it must not be an error here or in manifest validation.
    const pkg = makePackage({ tm: false })
    try {
      const project = makeProject()
      await edition_add([editionRef(pkg)], project.actx)

      const files = project.files()

      ok(files.includes('src/cmp/edition/summary/Main_summary.ts'))
      ok(!files.some((f: string) => f.startsWith('tm/edition/')),
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
      await edition_add([editionRef(pkg) + '~portal'], project.actx)

      const files = project.files()

      ok(files.includes('model/edition/portal.aon'), files.join(','))
      // Dispatch is by convention, so the component file has to move with the
      // name or nothing loads it.
      ok(files.includes('src/cmp/edition/portal/Main_portal.ts'), files.join(','))
      ok(files.includes('tm/edition/portal/site.md'), files.join(','))

      const src = read(project, 'model/edition/portal.aon')
      ok(src.includes('edition: portal:'), 'the model key was not rewritten:\n' + src)
      ok(src.includes("origname: 'summary'"), 'no origname recorded:\n' + src)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a ref that resolves to nothing says where it looked', async () => {
    const project = makeProject()
    await rejects(
      () => edition_add(['@acme/nope/summary'], project.actx),
      /Edition folder not found/)
  })

})


describe('edition and the whole-package verbs', () => {

  test('`package add` installs a edition item', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await package_add([pkg], project.actx)

      const files = project.files()
      ok(files.includes('model/edition/summary.aon'), files.join(','))
      ok(files.includes('src/cmp/edition/summary/Main_summary.ts'), files.join(','))

      const src = read(project, 'model/edition/summary.aon')
      ok(src.includes("package: '@acme/sdkgen-edition'"),
        'no package provenance:\n' + src)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a manifest claiming a edition item it does not ship is refused', async () => {
    const pkg = makePackage({
      manifest: {
        sdkgen: { package: 1 },
        name: '@acme/sdkgen-edition',
        provides: { edition: ['summary', 'ghost'] },
      },
    })
    try {
      const project = makeProject()
      await rejects(() => package_add([pkg], project.actx),
        /does not match the package[\s\S]*ghost/)

      // Nothing installed: validation runs before the loop writes anything.
      ok(!project.files().some((f: string) => f.startsWith('model/edition/')),
        'a refused package still wrote files')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('`package check` validates a edition package', async () => {
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


  test('a edition definition with no anchor is an error', async () => {
    const pkg = makePackage()
    try {
      const file = Path.join(pkg, '.sdk', 'model', 'edition', 'summary.aon')
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


describe('doctor sees edition', () => {

  // ANYTHING AN ADD WRITES, DOCTOR MUST COMPARE (CLAUDE.md). A kind whose
  // trees nothing walks lets the next add silently revert a project's edit,
  // which is the failure the whole drift check exists to prevent.

  async function installed(pkg: string) {
    const project = makeProject()
    await edition_add([editionRef(pkg)], project.actx)
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
        ROOT + '/src/cmp/edition/summary/Main_summary.ts',
        '// a project edit that the next `edition add` would revert\n')

      const res: any = await doctor(project.actx)

      ok(res.report.forked.includes('src/cmp/edition/summary/Main_summary.ts'),
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

      project.fs.writeFileSync(ROOT + '/tm/edition/summary/site.md', '# edited\n')

      const res: any = await doctor(project.actx)

      ok(res.report.edited.includes('tm/edition/summary/site.md'),
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

      project.fs.unlinkSync(ROOT + '/src/cmp/edition/summary/Main_summary.ts')

      const res: any = await doctor(project.actx)

      ok(res.report.missing.includes('src/cmp/edition/summary/Main_summary.ts'),
        JSON.stringify(res.report))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a template tree the SOURCE does not ship is not missing', async () => {
    // The optional tree again, from doctor's side: `edition add` did not copy
    // it, so the project is right not to have it, and reporting it would make
    // every catalogue-shaped edition package permanently red.
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


describe('edition and the project model', () => {


  test('the project model gains the edition include', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await edition_add([editionRef(pkg)], project.actx)

      const sdk = String(project.fs.readFileSync(
        ROOT + '/model/sdk.aon', 'utf8'))

      ok(sdk.includes('@"./edition/edition-index.aon"'),
        'the edition index is included by nothing:\n' + sdk)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a BARE pre-0.65 include is not duplicated', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      const url = ROOT + '/model/sdk.aon'
      project.fs.writeFileSync(url,
        String(project.fs.readFileSync(url, 'utf8')) +
        '@"edition/edition-index.aon"\n')

      await edition_add([editionRef(pkg)], project.actx)

      const sdk = String(project.fs.readFileSync(url, 'utf8'))
      strictEqual(
        (sdk.match(/@"(?:\.\/)?edition\/edition-index\.aon"/g) || []).length, 1,
        'the include was appended alongside the bare one:\n' + sdk)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('the include is added ONCE', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await edition_add([editionRef(pkg)], project.actx)
      await edition_add([editionRef(pkg)], project.actx)

      const sdk = String(project.fs.readFileSync(
        ROOT + '/model/sdk.aon', 'utf8'))

      strictEqual(
        sdk.split('@"./edition/edition-index.aon"').length - 1, 1,
        'the include was appended twice:\n' + sdk)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a required tree that is missing installs NOTHING', async () => {
    // The write pass emits the definition and its index entry before it
    // copies the trees, so a failure partway left the project carrying a edition
    // item with no implementation — which the next model compile reads as
    // real.
    const pkg = makePackage()
    try {
      Fs.rmSync(Path.join(pkg, '.sdk', 'src', 'cmp', 'edition', 'summary'),
        { recursive: true, force: true })

      const project = makeProject()

      await rejects(() => edition_add([editionRef(pkg)], project.actx),
        /required tree not found/)

      deepStrictEqual(
        project.files().filter((f: string) => f.startsWith('model/edition/')),
        [],
        'a failed add left a edition item in the model')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a template retired upstream is pruned on resync', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await edition_add([editionRef(pkg)], project.actx)

      ok(project.files().includes('tm/edition/summary/site.md'))

      Fs.unlinkSync(Path.join(pkg, '.sdk', 'tm', 'edition', 'summary', 'site.md'))
      Fs.writeFileSync(
        Path.join(pkg, '.sdk', 'tm', 'edition', 'summary', 'index.md'), '# new\n')

      await edition_add([editionRef(pkg)], project.actx)

      const files = project.files()
      ok(files.includes('tm/edition/summary/index.md'), files.join(','))
      ok(!files.includes('tm/edition/summary/site.md'),
        'the retired template survived the resync: ' + files.join(','))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })

})


describe('edition resync by installed name', () => {
  for (const alias of ['', '~partner']) test('preserves package provenance '+(alias || 'without alias'), async () => {
    const pkg=makePackage(), name=alias ? 'partner' : 'summary'
    try {
      const project=makeProject()
      await edition_add([editionRef(pkg)+alias],project.actx)
      const before={...project.actx.model.main.kit.doc.edition[name]}
      Fs.writeFileSync(Path.join(pkg,'.sdk/tm/edition/summary/site.md'),'# Updated documentation\n')
      await edition_add([name],project.actx)
      strictEqual(project.actx.model.main.kit.doc.edition[name].base,before.base)
      strictEqual(project.actx.model.main.kit.doc.edition[name].package,before.package)
      ok(read(project,'tm/edition/'+name+'/site.md').includes('Updated documentation'))
    } finally { Fs.rmSync(pkg,{recursive:true,force:true}) }
  })
})
