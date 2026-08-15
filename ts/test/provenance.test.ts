// PROVENANCE: where a copied target or feature came from.
//
// WHY THIS EXISTS
//
// `feature add` needs each target's template tree, and `doctor` needs the
// scaffold a copy should be compared against. Both find it through the
// target model's `base` — and only three of the 27 shipped target models
// carried that line, so for the other 24, and for EVERY feature, both
// silently fell back to the bundled scaffold.
//
// That is right only while everything ships inside @voxgig/sdkgen. The moment
// a target or feature can come from somewhere else, a fallback to the bundled
// scaffold is a wrong answer rather than a missing one: doctor compares a copy
// against a scaffold it never came from, and the feature fan-out looks for
// source in a tree that does not have it.
//
// `base` alone is also not enough for an ALIAS, which is why `origname` is
// recorded beside it — see alias.test.ts.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { Aontu } from 'aontu'

import { provenanceReplace } from '../dist/helpers/stdrep.js'
import {
  SCAFFOLD, SCAFFOLD_BASE, ROOT, makeProject, targetRef, absoluteTargetRef,
  recordLog, target_add, feature_add,
} from './actionharness'


function provenanceOf(project: any, kind: string, name: string) {
  const src = project.fs.readFileSync(
    ROOT + '/model/' + kind + '/' + name + '.aontu', 'utf8')

  const out: Record<string, string> = {}
  for (const m of String(src).matchAll(
    /^\s*(base|origname|package):\s*'([^']*)'\s*$/gm)) {
    out[m[1]] = m[2]
  }
  return { src, keys: out }
}


describe('provenance', () => {

  test('EVERY shipped model carries the anchor', () => {
    // The anchor is the only place the stamp can hang: a replace map can
    // rewrite text that is there, and there is nowhere else to put keys the
    // source does not have. A model without it records nothing, silently.
    const missing: string[] = []

    for (const kind of ['target', 'feature']) {
      const dir = Path.join(SCAFFOLD, 'model', kind)
      for (const f of Fs.readdirSync(dir).sort()) {
        if (!f.endsWith('.aontu') || f.includes('-index')) continue
        const src = Fs.readFileSync(Path.join(dir, f), 'utf8')
        if (!src.includes("base: 'BASE'")) {
          missing.push(kind + '/' + f)
        }
      }
    }

    deepStrictEqual(missing, [],
      'shipped model(s) with no provenance anchor — a copy of these records ' +
      'nothing, and doctor and the feature fan-out fall back to the bundled ' +
      'scaffold for them')
  })


  test('a target records where it came from', async () => {
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)

    const { keys, src } = provenanceOf(project, 'target', 'go')

    strictEqual(keys.base, SCAFFOLD_BASE, 'wrong or missing base')
    ok(!src.includes("'BASE'"), 'the raw anchor shipped into the project')

    // Not stamped when it does not apply.
    strictEqual(keys.origname, undefined, 'origname stamped for a plain add')

    // The bundled scaffold is itself an sdkgen package now, so every bundled
    // add records who provided it — which is what makes
    // `package update @voxgig/sdkgen` a meaningful operation rather than a
    // special case (design §2).
    strictEqual(keys.package, '@voxgig/sdkgen',
      'a bundled add did not record its package')
  })


  test('a source with NO manifest records no package', async () => {
    // A bare `.sdk`-shaped folder stays a legal source — it is what every
    // consumer fixture predating the manifest is — and simply records one
    // provenance line, exactly as it always did.
    const pkg = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-nomanifest-'))
    try {
      const sdk = Path.join(pkg, '.sdk')
      Fs.cpSync(Path.join(SCAFFOLD, 'model', 'target', 'go.aontu'),
        Path.join(sdk, 'model', 'target', 'go.aontu'))
      Fs.mkdirSync(Path.join(sdk, 'src', 'cmp', 'go'), { recursive: true })
      Fs.mkdirSync(Path.join(sdk, 'tm', 'go'), { recursive: true })

      const project = makeProject({})
      await target_add([Path.join(pkg, 'go')], project.actx)

      const { keys } = provenanceOf(project, 'target', 'go')

      ok(null != keys.base, 'no base recorded')
      strictEqual(keys.package, undefined,
        'a package name was invented for a source that declares none')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a MALFORMED manifest does not break the add', async () => {
    // The definition, the components and the templates are all present and
    // correct; refusing to install them because a JSON file beside them has a
    // trailing comma would be a worse outcome than installing them with one
    // provenance line missing. `package add` is where a manifest is required
    // and validated.
    const pkg = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-badmanifest-'))
    try {
      const sdk = Path.join(pkg, '.sdk')
      Fs.cpSync(Path.join(SCAFFOLD, 'model', 'target', 'go.aontu'),
        Path.join(sdk, 'model', 'target', 'go.aontu'))
      Fs.mkdirSync(Path.join(sdk, 'src', 'cmp', 'go'), { recursive: true })
      Fs.mkdirSync(Path.join(sdk, 'tm', 'go'), { recursive: true })
      Fs.writeFileSync(
        Path.join(pkg, 'sdkgen-package.json'), '{ "name": "@acme/x", }')

      const log = recordLog()
      const project = makeProject({ log })
      await target_add([Path.join(pkg, 'go')], project.actx)

      const { keys } = provenanceOf(project, 'target', 'go')
      strictEqual(keys.package, undefined)

      ok(log.lines.some((l: any) => 'package-manifest-unreadable' === l.point),
        'a broken manifest was ignored SILENTLY — the author gets no signal')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a FEATURE records where it came from', async () => {
    // New: a feature model recorded nothing at all, so `feature add` could
    // only ever mean the bundled scaffold.
    const project = makeProject({ target: { go: { name: 'go' } } })
    await target_add([targetRef('go')], project.actx)
    await feature_add(['retry'], project.actx)

    const { keys, src } = provenanceOf(project, 'feature', 'retry')

    strictEqual(keys.base, SCAFFOLD_BASE, 'wrong or missing base')
    ok(!src.includes("'BASE'"), 'the raw anchor shipped into the project')
  })


  test('an alias records the name it came from', async () => {
    const project = makeProject({})
    await target_add([targetRef('go') + '~go2'], project.actx)

    const { keys } = provenanceOf(project, 'target', 'go2')

    strictEqual(keys.base, SCAFFOLD_BASE)
    strictEqual(keys.origname, 'go',
      'no origname — doctor cannot find the tree an alias came from')
  })


  test('an out-of-tree source records its absolute path', async () => {
    const project = makeProject({})
    await target_add([absoluteTargetRef('go')], project.actx)

    const { keys } = provenanceOf(project, 'target', 'go')

    ok(Path.isAbsolute(keys.base),
      'an out-of-tree scaffold did not record an absolute base: ' + keys.base)
  })


  test('the stamped model still COMPILES', async () => {
    // The stamp rewrites one line into three, so it has to produce valid
    // aontu — and the values have to land where the schema declares them.
    const project = makeProject({})
    await target_add([targetRef('go') + '~go2'], project.actx)

    const { src } = provenanceOf(project, 'target', 'go2')
    const errs: any[] = []
    const model = new Aontu().generate(src, {
      path: Path.join(SCAFFOLD, 'model', 'target', 'go2.aontu'), errs,
    })

    strictEqual(errs.length, 0, 'stamped model did not compile: ' +
      errs.map((e: any) => e.msg || String(e)).join(' | '))
    strictEqual(model?.main?.kit?.target?.go2?.origname, 'go')
    strictEqual(model?.main?.kit?.target?.go2?.base, SCAFFOLD_BASE)
  })


  test('the base is `/`-normalised', async () => {
    // It is written into a COMMITTED file, so it must not depend on the OS
    // that ran the add — otherwise the same project resynced on Windows and
    // on Linux records two different values and each churns the other.
    const project = makeProject({})
    await target_add([targetRef('ts')], project.actx)

    const { keys } = provenanceOf(project, 'target', 'ts')
    ok(!keys.base.includes('\\'), 'base contains a backslash: ' + keys.base)
  })
})


describe('provenanceReplace', () => {

  test('emits only the keys that apply', () => {
    deepStrictEqual(provenanceReplace({ base: 'b/.sdk' }),
      { "base: 'BASE'": "base: 'b/.sdk'" })

    deepStrictEqual(
      provenanceReplace({ base: 'b/.sdk', origname: 'go', name: 'go' }),
      { "base: 'BASE'": "base: 'b/.sdk'" },
      'origname stamped when it equals the installed name')
  })


  test('adds origname for an alias, indented to match', () => {
    deepStrictEqual(
      provenanceReplace({ base: 'b/.sdk', origname: 'go', name: 'go2' }),
      { "base: 'BASE'": "base: 'b/.sdk'\n  origname: 'go'" })
  })


  test('adds package when the source declared one', () => {
    deepStrictEqual(
      provenanceReplace({ base: 'b/.sdk', package: '@acme/sdkgen-iot' }),
      { "base: 'BASE'": "base: 'b/.sdk'\n  package: '@acme/sdkgen-iot'" })
  })
})


// Review findings on #49, each pinned.
describe('provenance edge cases', () => {

  test('a quote in a path does not break the model', async () => {
    // A path may legally contain an apostrophe — `/home/o'connor/pkg` — and
    // concatenating one between single quotes closes the aontu string early,
    // leaving the copied model unparsable.
    const rep = provenanceReplace({ base: "/home/o'connor/pkg/.sdk" })
    const line = rep["base: 'BASE'"]

    const errs: any[] = []
    const model = new Aontu().generate(
      'main: kit: target: x: {\n  ' + line + '\n}\n',
      { path: '/t.aontu', errs })

    strictEqual(errs.length, 0,
      'a quoted path did not compile: ' +
      errs.map((e: any) => e.msg || String(e)).join(' | '))
    strictEqual(model?.main?.kit?.target?.x?.base, "/home/o'connor/pkg/.sdk",
      'the escaped value did not round-trip')
  })


  test('a bare feature name resolves against RECORDED provenance', async () => {
    // `target add` re-runs `feature add` with the model's own keys, not the
    // ref a feature was installed from. Without reading the recorded base, a
    // bare name falls back to the bundled scaffold — whose .sdk folder EXISTS,
    // so resolution succeeds and the copy then throws on a feature model that
    // is not there, breaking every subsequent `target add` in the project.
    const pkg = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-prov-'))
    try {
      const sdk = Path.join(pkg, '.sdk')
      Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })
      Fs.mkdirSync(Path.join(sdk, 'tm', 'ts', 'src', 'feature', 'ext'),
        { recursive: true })
      Fs.writeFileSync(Path.join(sdk, 'model', 'feature', 'ext.aontu'),
        '\nmain: kit: feature: ext: {\n  name: key()\n' +
        '  title: "x"\n  version: \'0.0.1\'\n  active: true\n' +
        "  base: 'BASE'\n  config: options: active: false\n  hook: {}\n}\n")
      Fs.writeFileSync(
        Path.join(sdk, 'tm', 'ts', 'src', 'feature', 'ext', 'E.ts'), 'export {}\n')

      const project = makeProject({ target: { ts: { name: 'ts' } } })
      await target_add([targetRef('ts')], project.actx)
      await feature_add([Path.join(pkg, 'ext')], project.actx)

      // Now the model knows about it, the way a reloaded project would.
      const base = (String(project.fs.readFileSync(
        ROOT + '/model/feature/ext.aontu', 'utf8'))
        .match(/^\s*base:\s*'([^']*)'/m) || [])[1]
      project.actx.model.main.kit.feature = {
        ext: { name: 'ext', active: true, base },
      }

      // The BARE name, as target_add would pass it.
      await feature_add(['ext'], project.actx)

      ok(project.files().includes('model/feature/ext.aontu'),
        'the bare name did not resolve to the recorded source')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a tilde in the package PATH is not an alias', async () => {
    // The Windows runner's temp directory is an 8.3 short name
    // (`C:\Users\RUNNER~1\...`), so every external-feature test ran with a
    // tilde in the path. A check that looked for `~` anywhere in the ref
    // rejected all of them as aliases — the same defect the resolver had,
    // reintroduced in the same commit that fixed it, because the ref was
    // being parsed in two places.
    const parent = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-tilde-'))
    try {
      const pkg = Path.join(parent, 'RUNNER~1', 'pkg')
      const sdk = Path.join(pkg, '.sdk')
      Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })
      Fs.mkdirSync(Path.join(sdk, 'tm', 'ts', 'src', 'feature', 'ext'),
        { recursive: true })
      Fs.writeFileSync(Path.join(sdk, 'model', 'feature', 'ext.aontu'),
        '\nmain: kit: feature: ext: {\n  name: key()\n' +
        '  title: "x"\n  version: \'0.0.1\'\n  active: true\n' +
        "  base: 'BASE'\n  config: options: active: false\n  hook: {}\n}\n")
      Fs.writeFileSync(
        Path.join(sdk, 'tm', 'ts', 'src', 'feature', 'ext', 'E.ts'),
        'export {}\n')

      const project = makeProject({ target: { ts: { name: 'ts' } } })
      await target_add([targetRef('ts')], project.actx)
      await feature_add([Path.join(pkg, 'ext')], project.actx)

      ok(project.files().includes('model/feature/ext.aontu'),
        'a package path containing a tilde was rejected as an alias')
    }
    finally {
      Fs.rmSync(parent, { recursive: true, force: true })
    }
  })


  test('feature aliasing is refused, not half-done', async () => {
    // The resolver understands `~` for any kind, but a feature's name is part
    // of the generated config key and the hook wiring in every target — and
    // the copied model would still declare the ORIGIN name.
    const project = makeProject({ target: { ts: { name: 'ts' } } })
    await target_add([targetRef('ts')], project.actx)

    await rejects(
      () => feature_add(['retry~breaker'], project.actx),
      /Feature aliasing is not supported/,
      'an aliased feature was accepted')
  })
})
