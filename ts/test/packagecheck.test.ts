// `package check` — the author-side battery. Design §14.
//
// WHAT THIS SUITE IS REALLY TESTING
//
// A validator is only worth its noise if every check DISCRIMINATES: it must
// fire on the defect it names and stay quiet on the shipped scaffold, which
// exercises 27 targets and 17 features of legitimate variety. So each test
// below takes one clean package, breaks exactly one thing, and asserts both
// halves — the finding appears, and the check that would be a false positive
// does not.
//
// The bundled `ts/project` is the anchor: it is itself an sdkgen package, so
// the battery runs on it here, and any rule that cannot survive the shipped
// scaffold is a rule that would have cried wolf at every author.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, throws } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { checkPackage } from '../dist/action/check.js'
import { needsModel } from '../dist/action/dispatch.js'


const SCAFFOLD = Path.resolve(__dirname, '..', 'project', '.sdk')


function silentLog(): any {
  const noop = () => { }
  const log: any = {
    info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  }
  log.child = () => log
  return log
}


function actx(folder: string = '.'): any {
  return {
    fs: () => Fs,
    log: silentLog(),
    folder,
    model: { main: {} },
    url: '',
    opts: {},
    jostraca: null,
  }
}


// A package that is CORRECT, so that each test can break one thing.
//
// The target is the bundled `go` renamed — a real target, model, components
// and templates — because a hand-written stub would pass checks the real
// thing fails and vice versa.
function makePackage(edit?: (dir: string) => void): string {
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-check-'))
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'target'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })

  Fs.cpSync(Path.join(SCAFFOLD, 'src', 'cmp', 'go'),
    Path.join(sdk, 'src', 'cmp', 'iotgo'), { recursive: true })
  Fs.cpSync(Path.join(SCAFFOLD, 'tm', 'go'),
    Path.join(sdk, 'tm', 'iotgo'), { recursive: true })

  // The target model, renamed the way an author must rename it: EVERY
  // `target: go:` key, not only the first.
  Fs.writeFileSync(Path.join(sdk, 'model', 'target', 'iotgo.aontu'),
    Fs.readFileSync(Path.join(SCAFFOLD, 'model', 'target', 'go.aontu'), 'utf8')
      .replace(/target: go:/g, 'target: iotgo:'))

  Fs.cpSync(Path.join(SCAFFOLD, 'model', 'feature', 'retry.aontu'),
    Path.join(sdk, 'model', 'feature', 'retry.aontu'))

  Fs.writeFileSync(Path.join(dir, 'sdkgen-package.json'),
    JSON.stringify({
      sdkgen: { package: 1 },
      name: '@acme/sdkgen-iot',
      version: '1.4.0',
      provides: { target: ['iotgo'], feature: ['retry'] },
    }, null, 2))

  if (null != edit) {
    edit(dir)
  }

  return dir
}


// Run the battery over a package built by `edit`, then clean up.
function check(edit?: (dir: string) => void): any {
  const dir = makePackage(edit)
  try {
    return checkPackage(dir, actx())
  }
  finally {
    Fs.rmSync(dir, { recursive: true, force: true })
  }
}


function points(report: any, level?: string): string[] {
  return report.findings
    .filter((f: any) => null == level || level === f.level)
    .map((f: any) => f.point)
}


function noted(report: any, point: string): string {
  return report.findings
    .filter((f: any) => point === f.point)
    .map((f: any) => f.note).join('\n')
}


function modelFile(dir: string, kind: string, name: string): string {
  return Path.join(dir, '.sdk', 'model', kind, name + '.aontu')
}


function editModel(
  dir: string, kind: string, name: string, edit: (src: string) => string,
) {
  const file = modelFile(dir, kind, name)
  Fs.writeFileSync(file, edit(String(Fs.readFileSync(file, 'utf8'))))
}


function writeManifest(dir: string, manifest: any) {
  Fs.writeFileSync(Path.join(dir, 'sdkgen-package.json'),
    JSON.stringify(manifest, null, 2))
}


describe('package check — the shipped scaffold', () => {

  test('the bundled package passes its own battery', () => {
    // ts/project IS an sdkgen package, which is what keeps the bundled and
    // external paths on the same code. If the battery cannot pass it, either
    // the scaffold is broken or a check is over-strict — and an over-strict
    // check would fire on every author's package too.
    const report = checkPackage('project', actx())

    deepStrictEqual(
      report.findings.filter((f: any) => 'error' === f.level).map(
        (f: any) => f.point + ': ' + f.note),
      [],
      'the bundled scaffold fails package check')

    strictEqual(report.ok, true)
  })


  test('no warning either, over 27 targets and 17 features', () => {
    // Warnings are the false-positive surface: `feature-source-unrecognised`
    // walks every feature directory of every target, where the shared
    // machinery lives (`feature_options.go`, `mod.rs`, `support.rs`,
    // `BaseFeature.cs`). One noisy rule and the battery gets ignored.
    const report = checkPackage('project', actx())

    deepStrictEqual(
      report.findings.map((f: any) => f.level + ' ' + f.point + ': ' + f.note),
      [])
  })

})


describe('package check — a well-formed package', () => {

  test('a correct package has nothing to report', () => {
    const report = check()

    deepStrictEqual(report.findings.map((f: any) => f.point + ': ' + f.note), [])
    strictEqual(report.ok, true)
  })


  test('an unresolvable ref says where it looked', () => {
    throws(() => checkPackage('@acme/nope', actx()),
      /Package not found[\s\S]*node_modules[\s\S]*nope/)
  })


  test('`package check` is the one verb that runs without a project model', () => {
    // An author runs it in their package root, where there is no
    // `model/sdk.aontu` — and every other verb must keep failing without one.
    strictEqual(needsModel(['package', 'check']), false)
    strictEqual(needsModel(['package', 'add', '@acme/sdkgen-iot']), true)
    strictEqual(needsModel(['target', 'add', 'go']), true)
    strictEqual(needsModel(['doctor']), true)
  })

})


describe('package check — the model rules', () => {

  test('a slash comment is reported by LINE, once', () => {
    const report = check((dir) =>
      editModel(dir, 'target', 'iotgo', (src) =>
        src.replace('main: kit: target: iotgo: {',
          '// a consumer cannot parse this\nmain: kit: target: iotgo: {')))

    ok(points(report).includes('model-slash-comment'), points(report).join(','))
    ok(/: \d+: `\/\/ a consumer cannot parse this`/.test(
      noted(report, 'model-slash-comment')), noted(report, 'model-slash-comment'))

    // The parse failure IS the slash comment. Reporting both reads as two
    // problems and buries the line number in aontu's phrasing.
    ok(!points(report).includes('model-parse'), points(report).join(','))
    strictEqual(report.ok, false)
  })


  test('a line-comment token declared as a STRING is not a comment', () => {
    // The false positive that makes this check unshippable if got wrong:
    // every C-family target declares its own line-comment token, and the
    // shipped models use both quoting styles (`"//"` in go).
    const report = check()

    ok(/comment: line: ["']\/\/["']/.test(String(Fs.readFileSync(
      Path.join(SCAFFOLD, 'model', 'target', 'go.aontu'), 'utf8'))),
      'fixture assumption: go declares a // line-comment token')

    ok(!points(report).includes('model-slash-comment'))
  })


  test('a missing provenance anchor is an error', () => {
    const report = check((dir) =>
      editModel(dir, 'feature', 'retry', (src) =>
        src.replace("base: 'BASE'", '')))

    ok(points(report).includes('model-anchor-missing'), points(report).join(','))
    ok(/package update/.test(noted(report, 'model-anchor-missing')))
  })


  test('a key the base schema requires and the file omits', () => {
    // `ext` compiles fine on its own — it only fails once the consumer
    // unifies the whole model, which is the failure this moves forward.
    const report = check((dir) =>
      editModel(dir, 'target', 'iotgo', (src) =>
        src.replace(/^\s*ext:.*$/m, '')))

    ok(points(report).includes('model-schema'), points(report).join(','))
    ok(/ext/.test(noted(report, 'model-schema')), noted(report, 'model-schema'))
  })


  test('a feature missing its schema-required title', () => {
    const report = check((dir) =>
      editModel(dir, 'feature', 'retry', (src) =>
        src.replace(/^\s*title:.*$/m, '')))

    ok(points(report).includes('model-schema'), points(report).join(','))
    ok(/title/.test(noted(report, 'model-schema')), noted(report, 'model-schema'))
  })


  test('a definition declaring a name other than its own', () => {
    // The mistake an author makes copying a bundled target: the file is
    // renamed, the key inside it is not. It compiles, it unifies, and it
    // installs an item the consumer's model never sees.
    const report = check((dir) =>
      editModel(dir, 'target', 'iotgo', (src) =>
        src.replace(/target: iotgo:/g, 'target: go:')))

    ok(points(report).includes('model-key-missing'), points(report).join(','))
    ok(/main: kit: target: iotgo:/.test(noted(report, 'model-key-missing')))
  })


  test('a target that pins a publication value the project owns', () => {
    const report = check((dir) =>
      editModel(dir, 'target', 'iotgo', (src) =>
        // NOT the probe's own value: aontu unifies two equal scalars happily,
        // so a package pinning exactly what the probe sets is the one case
        // this technique cannot see.
        src.replace('main: kit: target: iotgo: {',
          "main: kit: target: iotgo: {\n  publish: registry: package: '@acme/pinned-by-the-package'")))

    ok(points(report).includes('target-publish-pinned'), points(report).join(','))
    ok(/cannot override/.test(noted(report, 'target-publish-pinned')))
  })


  test('per-target deps under the slot nothing reads', () => {
    // `feature.<f>.target.<t>.deps` is schema-legal — every target model
    // declares that slot — so aontu reports nothing and the dependency simply
    // never reaches the generated manifest.
    const report = check((dir) =>
      editModel(dir, 'feature', 'retry', (src) =>
        src.replace('main: kit: feature: retry: {',
          "main: kit: feature: retry: {\n  target: iotgo: deps: 'gobreaker': " +
          "{ active: true, version: 'v1' }")))

    ok(points(report).includes('feature-deps-misplaced'), points(report).join(','))
    ok(/deps: iotgo:/.test(noted(report, 'feature-deps-misplaced')),
      noted(report, 'feature-deps-misplaced'))

    // A warning: what is there works, it just does nothing.
    strictEqual(report.ok, true)
  })


  test('the deps SLOT every target model declares is not a finding', () => {
    // `main: kit: feature: &: target: <t>: deps: &: {…}` declares the type of
    // a slot. Reading it as a misplaced dependency would fire on every
    // package that ships a target.
    const report = check()

    ok(!points(report).includes('feature-deps-misplaced'))
  })

})


describe('package check — the manifest', () => {

  test('a claim with nothing behind it', () => {
    const report = check((dir) => writeManifest(dir, {
      sdkgen: { package: 1 },
      name: '@acme/sdkgen-iot',
      provides: { target: ['iotgo', 'ghost'], feature: ['retry'] },
    }))

    ok(points(report, 'error').includes('manifest-item-missing'),
      points(report).join(','))
    strictEqual(report.ok, false)
  })


  test('something on disk nobody claims is a warning, not an error', () => {
    const report = check((dir) => writeManifest(dir, {
      sdkgen: { package: 1 },
      name: '@acme/sdkgen-iot',
      provides: { target: ['iotgo'] },
    }))

    ok(points(report, 'warn').includes('manifest-item-unclaimed'),
      points(report).join(','))
    strictEqual(report.ok, true)
  })


  test('no manifest is a warning, and the battery still runs', () => {
    // An author who has not written the manifest yet is precisely who needs
    // the rest of the checks.
    const report = check((dir) => {
      Fs.rmSync(Path.join(dir, 'sdkgen-package.json'))
      editModel(dir, 'feature', 'retry', (src) => src.replace("base: 'BASE'", ''))
    })

    ok(points(report, 'warn').includes('manifest-absent'), points(report).join(','))
    ok(points(report, 'error').includes('model-anchor-missing'),
      points(report).join(','))
  })


  test('a manifest that is not JSON', () => {
    const report = check((dir) =>
      Fs.writeFileSync(Path.join(dir, 'sdkgen-package.json'), '{ nope'))

    deepStrictEqual(points(report), ['manifest-unreadable'])
    strictEqual(report.ok, false)
  })

})


describe('package check — feature source', () => {

  test('declared coverage with nothing behind it', () => {
    const report = check((dir) => writeManifest(dir, {
      sdkgen: { package: 1 },
      name: '@acme/sdkgen-iot',
      provides: { target: ['iotgo'], feature: ['retry'] },
      targetsSupported: { retry: ['iotgo', 'rb'] },
    }))

    // `iotgo` HAS retry source (it is the bundled go tree); `rb` is not in
    // the package at all, so the claim is unbacked.
    const note = noted(report, 'feature-source-undelivered')
    ok(/rb/.test(note), note)
    ok(!/iotgo/.test(note), note)
  })


  test('a feature-shaped file no catalogue knows', () => {
    const report = check((dir) =>
      Fs.writeFileSync(
        Path.join(dir, '.sdk', 'tm', 'iotgo', 'feature', 'mystery_feature.go'),
        'package feature\n'))

    ok(points(report).includes('feature-source-unrecognised'),
      points(report).join(','))
    ok(/mystery/.test(noted(report, 'feature-source-unrecognised')))
  })


  test('`base` is never a stray, and neither is shared machinery', () => {
    // `base` is the foundation every feature extends and has no model file,
    // so it is in no catalogue — and `feature_options.go` is machinery whose
    // derived name is a feature nobody declares either. Both live in the
    // bundled go tree this fixture copies.
    const report = check()

    ok(Fs.existsSync(Path.join(SCAFFOLD, 'tm', 'go', 'feature', 'base_feature.go')),
      'fixture assumption: go ships base_feature.go')

    ok(!points(report).includes('feature-source-unrecognised'),
      noted(report, 'feature-source-unrecognised'))
  })


  test('source for a feature the package does NOT provide is not a stray', () => {
    // A package shipping a copy of a bundled target ships source for every
    // bundled feature. Those are known to the CONSUMER's catalogue, not to
    // the package's own — reading only the package's would fire on all of
    // them.
    const dir = makePackage()
    try {
      // The fixture provides `retry` and nothing else...
      ok(!Fs.existsSync(Path.join(dir, '.sdk', 'model', 'feature', 'log.aontu')),
        'fixture assumption: the package does not provide log')

      // ...and its copied `go` tree ships log source regardless.
      ok(Fs.existsSync(
        Path.join(SCAFFOLD, 'tm', 'go', 'feature', 'log_feature.go')),
        'fixture assumption: go ships log source')

      const report = checkPackage(dir, actx())

      ok(!points(report).includes('feature-source-unrecognised'),
        noted(report, 'feature-source-unrecognised'))
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })

})
