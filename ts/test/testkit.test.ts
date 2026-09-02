// THE TEST KIT, over the CHECKED-IN FIXTURE PACKAGE.
//
// See §14 and §15 of docs/design/sdkgen-packages.md.
//
// WHAT IS DIFFERENT ABOUT THIS SUITE
//
// Every other action suite runs against memfs and a fixture synthesized at
// runtime. That is the right trade for testing the add pipeline, and it has
// one thing it structurally cannot do: RUN what it installed. `requirePath`
// does a real Node `require` against `<root>/.sdk/dist/cmp/...`, so a project
// that exists only in a memfs volume can be added to and never generated
// from.
//
// So this suite stages a consumer on real disk, installs
// `test/fixture/acme-widgets` through the real `package add`, compiles its
// components the way a consumer's own build does, and generates. The package
// is a hand-written tree rather than a copy of the bundled scaffold, which is
// the only way to find out whether the published contract is enough to write
// a package against.

import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'

import {
  stageConsumer, generateInto, manifestParity, PLACEHOLDERS, volumeKey,
} from '../dist/testkit.js'

import { checkPackage } from '../dist/action/check.js'


// From the PACKAGE ROOT, not from `__dirname`: this file runs compiled out of
// `dist-test/`, and the fixture is a source tree that is never compiled or
// copied there — it is input to the add pipeline, not to tsc.
const FIXTURE = Path.resolve(__dirname, '..', 'test', 'fixture', 'acme-widgets')
const PKGNAME = '@acme/sdkgen-widgets'

// This package's own root — what a staged consumer links `@voxgig/sdkgen` to,
// and therefore what teardown must never delete.
const SDKGEN = Path.resolve(__dirname, '..')


// A small API, and deliberately one with an INACTIVE entity in it: `active`
// filtering is a whole-pipeline property, and a package's own components are
// exactly as able to get it wrong as a bundled target was.
const API = `
main: kit: info: { title: 'Demo', version: '1.0.0', auth: false }
main: kit: config: headers: { 'content-type': 'application/json' }

main: kit: entity: planet: {
  alias: field: {}
  name: "planet"
  id: { field: "id", name: "id" }
  field: {
    id:    { name: "id",    kind: "field", type: "\`$STRING\`", required: true }
    title: { name: "title", kind: "field", type: "\`$STRING\`", required: true }
  }
  fields: [
    { name: "id",    req: true, type: "\`$STRING\`" }
    { name: "title", req: true, type: "\`$STRING\`" }
  ]
  op: { list: { name: "list", points: [ {
    args: {}, method: "GET", orig: "/planet", segments: [{ lit: "planet" }]
    transform: { req: "\`reqdata\`", res: "\`body\`" } } ] } }
}

main: kit: entity: hidden: {
  alias: field: {}
  name: "hidden"
  active: false
  field: { id: { name: "id", kind: "field", type: "\`$STRING\`", required: true } }
  fields: [ { name: "id", req: true, type: "\`$STRING\`" } ]
  op: { list: { name: "list", points: [ {
    args: {}, method: "GET", orig: "/hidden", segments: [{ lit: "hidden" }]
    transform: { req: "\`reqdata\`", res: "\`body\`" } } ] } }
}
`


// Compile the consumer's model the way its own `generate` does: the base
// schemas by package name (which is what the staged `node_modules` links
// exist for), then the indexes the adds have been writing into.
function consumerModel(sdk: string): any {
  const src = [
    '@"@voxgig/apidef/model/apidef.aon"',
    '@"@voxgig/sdkgen/model/sdkgen.aon"',
    '@"target/target-index.aon"',
    '@"feature/feature-index.aon"',
    "name: 'demo'",
    API,
  ].join('\n')

  const path = Path.join(sdk, 'model', 'generate-test.aon')
  Fs.writeFileSync(path, src)

  const errs: any[] = []
  const model = new Aontu().generate(src, { path, errs })

  strictEqual(errs.length, 0,
    'consumer model did not compile: ' +
    errs.map((e: any) => `[${e.why}] ${e.msg}`).join(' | '))

  return model
}


describe('testkit over the fixture package', () => {

  // ONE staged consumer for the whole suite. Staging links node_modules and
  // transpiles components, so a fresh one per test would pay that repeatedly
  // for a project none of these tests mutate after setup.
  let consumer: any
  let files: Record<string, string> = {}
  let leaks: string[] = []

  before(async () => {
    consumer = stageConsumer({ recordLog: true })
    await consumer.addPackage(FIXTURE)
    consumer.compile()

    const out = await generateInto(consumer, { model: consumerModel(consumer.sdk) })
    files = out.files
    leaks = out.leaks
  })

  after(() => {
    if (null != consumer) consumer.cleanup()
  })


  test('package add installs every kind the manifest provides', () => {
    const installed = consumer.files()

    for (const path of [
      'model/target/wtest.aon',
      'model/feature/wfeat.aon',
      'model/docs/wcat.aon',
      'src/cmp/wtest/Main_wtest.ts',
      'src/cmp/docs/wcat/Main_wcat.ts',
      'tm/wtest/README.md',
    ]) {
      ok(installed.includes(path), 'not installed: ' + path +
        '\ngot:\n  ' + installed.join('\n  '))
    }
  })


  // THE UPGRADE PATH FOR A NEW KIND. This consumer's `model/sdk.aontu` was
  // written with only the target and feature indexes — the state of every
  // project scaffolded before `docs` existed. Installing a docs item has to
  // create that kind's index rather than assume it.
  test('a kind the project predates gets its index created', () => {
    ok(consumer.files().includes('model/docs/docs-index.aon'),
      'no docs index was created')

    const index = Fs.readFileSync(
      Path.join(consumer.sdk, 'model', 'docs', 'docs-index.aon'), 'utf8')
    ok(index.includes('@"wcat.aon"'), 'docs index: ' + index)
  })


  test('every installed item records the package as provenance', () => {
    for (const rel of [
      'model/target/wtest.aon',
      'model/feature/wfeat.aon',
      'model/docs/wcat.aon',
    ]) {
      const src = Fs.readFileSync(Path.join(consumer.sdk, rel), 'utf8')
      ok(src.includes("package: '" + PKGNAME + "'"),
        rel + ' carries no package provenance:\n' + src)
    }
  })


  // The package's own components RAN — the half a memfs project cannot reach.
  // Asserted on content, not on existence: a component that emitted a
  // constant would pass an existence check while proving nothing about
  // whether it saw the model.
  test('the package\'s components run and see the model', () => {
    const client = files['wtest/src/client.wt']
    ok(null != client,
      'no client file generated; got:\n  ' + Object.keys(files).join('\n  '))

    ok(client.includes('sdk demo'), 'the API name did not reach it: ' + client)
    ok(client.includes('entities planet'), 'the entity did not reach it: ' + client)
    ok(client.includes('wfeat'), 'the feature did not reach it: ' + client)

    ok(null != files['wtest/entity/planet.wt'], 'no per-entity file')
    ok(files['wtest/entity/planet.wt'].includes('fields id title'),
      'the entity file did not describe the entity: ' +
      files['wtest/entity/planet.wt'])
  })


  // The same property the bundled targets are now held to, for an EXTERNAL
  // one. A package author reading the authoring guide has to end up here by
  // default, so the fixture models the correct access and this pins it.
  test('an inactive entity reaches no external target either', () => {
    const named = Object.keys(files).filter((p) => /hidden/i.test(p))
    deepStrictEqual(named, [],
      'the inactive entity generated files: ' + named.join(', '))
  })


  test('no placeholder survives into generated output', () => {
    deepStrictEqual(leaks, [],
      'placeholder leak — a replace map did not reach these files.\n' +
      'tokens scanned: ' + PLACEHOLDERS.join(', '))
  })


  // `package check` is what a package author runs before publishing, so the
  // fixture has to pass it — otherwise the fixture is teaching a shape the
  // checker rejects.
  test('package check reports no errors on the fixture', () => {
    const report: any = checkPackage(FIXTURE, {
      fs: () => Fs,
      log: consumer.log,
      folder: consumer.sdk,
    } as any)

    const errors = report.findings.filter((f: any) => 'error' === f.level)
    deepStrictEqual(errors.map((f: any) => f.point + ': ' + f.note), [],
      'the fixture package does not pass its own checker')
  })


  test('the manifest\'s declared parity tier is readable', () => {
    deepStrictEqual(manifestParity(FIXTURE), { wtest: 'UNCOVERED' })
  })
})


// THE VOLUME-KEY RULE, TESTED WITH WINDOWS SHAPES ON EVERY PLATFORM.
//
// memfs stores `/a/b`, never `C:/a/b`. Keying a generation result therefore
// means comparing a drive-less, forward-slashed volume key against a real
// filesystem root — and getting that wrong does not fail loudly by itself:
// `Path.relative` between the two resolves the drive-less path against the CWD
// and returns a confidently wrong answer. That cost two Windows CI runs.
//
// These inputs are Windows-shaped strings, which is the point: the rule is
// written to be the same function on every platform (it replaces backslashes
// unconditionally rather than consulting `Path.sep`) precisely so a Linux
// machine can prove it.
describe('testkit: volume keys', () => {

  test('drops the drive letter and normalises separators', () => {
    strictEqual(
      volumeKey('C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\sdkgen-consumer-x'),
      '/Users/RUNNER~1/AppData/Local/Temp/sdkgen-consumer-x')

    strictEqual(volumeKey('D:\\a\\b'), '/a/b')
    strictEqual(volumeKey('d:/a/b'), '/a/b')
  })

  test('leaves a POSIX path untouched', () => {
    // The no-op case has to stay a no-op, or the platforms that were green
    // become the ones that break.
    strictEqual(volumeKey('/tmp/sdkgen-consumer-x'), '/tmp/sdkgen-consumer-x')
    strictEqual(volumeKey('/var/folders/ab/cd/T/x'), '/var/folders/ab/cd/T/x')
  })

  test('a root and a volume key for the same place now agree', () => {
    // The exact comparison that failed: root as Windows spells it, path as
    // memfs stored it.
    const root = 'C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\sdkgen-consumer-UsnHPV'
    const path = '/Users/RUNNER~1/AppData/Local/Temp/sdkgen-consumer-UsnHPV/wtest/entity/planet.wt'

    ok(volumeKey(path).startsWith(volumeKey(root) + '/'),
      'the volume key is not under the root key:\n  ' +
      volumeKey(root) + '\n  ' + volumeKey(path))

    strictEqual(volumeKey(path).slice(volumeKey(root).length + 1),
      'wtest/entity/planet.wt')
  })
})


// CLEANUP MUST NOT REACH THROUGH ITS OWN LINKS.
//
// A staged consumer holds `node_modules/@voxgig/*` entries pointing at this
// checkout — a symlink on POSIX, a directory JUNCTION on Windows — and
// teardown then runs a recursive remove over the staged tree.
//
// Node's recursive `rmSync` does not follow such a link (measured: it removes
// the link itself), so this is not the repo-deleting hazard it first looks
// like. It is pinned anyway, because the property is one line of someone
// else's implementation away from changing and the blast radius is a
// developer's working tree.
//
// Only the POSIX half runs here. `unlinkSync` removes a symlink and refuses a
// junction with EPERM; `rmdirSync` is the reverse, which is why the
// implementation tries both — but the junction branch has never executed on
// Windows, and this comment says so rather than implying otherwise.
describe('testkit: staging teardown', () => {

  test('removes the staged tree and leaves the checkout untouched', () => {
    const canary = Path.join(SDKGEN, 'package.json')
    const before = {
      entries: Fs.readdirSync(SDKGEN).length,
      canary: Fs.statSync(canary).size,
      trees: Fs.readdirSync(Path.join(SDKGEN, 'project', '.sdk', 'tm')).length,
    }

    const staged = stageConsumer()
    const link = Path.join(
      staged.sdk, 'node_modules', '@voxgig', 'sdkgen')

    // The precondition that makes this test mean anything: teardown really is
    // about to recurse over a tree containing a live link into the checkout.
    ok(Fs.lstatSync(link).isSymbolicLink(),
      'the sdkgen entry is not a link, so this proves nothing about following one')
    strictEqual(Fs.realpathSync(link), Fs.realpathSync(SDKGEN),
      'the link does not point at this checkout')

    staged.cleanup()

    ok(!Fs.existsSync(staged.root), 'the staged tree was not removed')

    strictEqual(Fs.readdirSync(SDKGEN).length, before.entries,
      'entries disappeared from the package root — cleanup followed a link')
    strictEqual(Fs.statSync(canary).size, before.canary,
      'package.json changed size — cleanup reached into the checkout')
    strictEqual(
      Fs.readdirSync(Path.join(SDKGEN, 'project', '.sdk', 'tm')).length,
      before.trees,
      'template trees disappeared — cleanup followed a link')
  })
})


// THE OVERLAY BRANCH, which needs a bundled target present to overlay onto.
//
// Kept in its own consumer because installing `ts` pulls the whole bundled
// scaffold's feature set into the fan-out, and the suite above wants a
// project containing nothing but the package under test.
describe('testkit: a package feature overlaying a bundled target', () => {

  let consumer: any

  before(async () => {
    consumer = stageConsumer({ recordLog: true })
    await consumer.add('target', consumer.bundledRef('target', 'ts'))
    await consumer.addPackage(FIXTURE)
  })

  after(() => {
    if (null != consumer) consumer.cleanup()
  })


  // `wfeat` reaches `ts` through the package's OWN `tm/ts` overlay, because
  // the bundled ts target's tree knows nothing about it and an external
  // package cannot edit the scaffold.
  test('the feature\'s source lands in the bundled target\'s tree', () => {
    const installed = consumer.files()
    ok(installed.includes('tm/ts/src/feature/wfeat/wfeat.ts'),
      'the overlay did not reach ts:\n  ' +
      installed.filter((f: string) => f.startsWith('tm/ts/src/feature')).join('\n  '))
  })


  // ...and reaches `wtest` through the target's own tree, because the same
  // package ships both and there is nothing to overlay onto. Two branches of
  // `action/feature.ts`, one fixture.
  test('and in its own target\'s tree, by the other branch', () => {
    ok(consumer.files().includes('tm/wtest/feature/wfeat.wt'),
      'the feature source is missing from its own target')
  })


  // No `feature-source-shadowed` warning: both trees provide `wfeat` for
  // exactly one target each. That warning firing here would mean the resolver
  // had decided the package was fighting with itself.
  test('and neither is reported as shadowing the other', () => {
    const shadowed = consumer.log.lines
      .filter((l: any) => 'feature-source-shadowed' === l.point)
      .filter((l: any) => 'wfeat' === l.feature)

    deepStrictEqual(shadowed, [],
      'wfeat was reported as shadowed by its own package')
  })
})
