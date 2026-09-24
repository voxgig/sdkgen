
import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, match } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import {
  definitionNames,
  definitionPathAny,
  migrateIncludes,
} from '../dist/helpers/definition.js'
import { appendIndexEntries } from '../dist/action/action.js'
import { edition_add } from '../dist/action/edition.js'
import { doctor } from '../dist/action/doctor.js'
import { checkPackage } from '../dist/action/check.js'
import { readTargetFeature } from '../dist/action/target.js'
import { ROOT, makeProject } from './actionharness'


function tmpdir(): string {
  return Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-legacy-'))
}


function silentLog(): any {
  const noop = () => { }
  const log: any = {
    info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  }
  log.child = () => log
  return log
}


// A package from before the rename: `<name>.aon`, with a `.aon` include. The
// shared file it includes ships as `.aontu` unless `sharedExt` says otherwise.
function legacyPackage(opts: {
  include?: string, anchor?: boolean, sharedExt?: string,
} = {}): string {
  const dir = tmpdir()
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'edition'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'model', 'shared'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'src', 'cmp', 'edition', 'summary'), { recursive: true })

  Fs.writeFileSync(Path.join(sdk, 'model', 'shared', 'base' + (opts.sharedExt ?? '.aontu')),
    "main: kit: doc: edition: summary: title: 'From the shared base'\n")

  Fs.writeFileSync(Path.join(sdk, 'model', 'edition', 'summary.aon'),
    (opts.include ?? '@"../shared/base.aon"') + '\n' +
    '# history: this item once included @"./old.aon"\n' +
    'main: kit: doc: edition: summary: {\n' +
    "  note: 'text naming @\"./kept.aon\" is not an include'\n" +
    (false === opts.anchor ? '' : "  base: 'BASE'\n") +
    '}\n')

  Fs.writeFileSync(
    Path.join(sdk, 'src', 'cmp', 'edition', 'summary', 'Main_summary.ts'),
    "import { cmp } from '@voxgig/sdkgen'\n" +
    'const Main = cmp(function Main() { })\n' +
    'export { Main }\n')

  Fs.writeFileSync(Path.join(dir, 'sdkgen-package.json'), JSON.stringify({
    sdkgen: { package: 1 },
    name: '@acme/legacy-docs',
    version: '1.0.0',
    provides: { edition: ['summary'] },
  }, null, 2))

  return dir
}


function points(report: any, level: string): string[] {
  return report.findings
    .filter((f: any) => level === f.level)
    .map((f: any) => f.point)
}


describe('migrateIncludes', () => {

  test('renames a .aon include, in either quote, with or without a gap', () => {
    strictEqual(migrateIncludes('@"./a.aon"'), '@"./a.aontu"')
    strictEqual(migrateIncludes("@'./a.aon'"), "@'./a.aontu'")
    strictEqual(migrateIncludes('@ "./a.aon"'), '@ "./a.aontu"')
    strictEqual(migrateIncludes('x: @"../b/c.aon"'), 'x: @"../b/c.aontu"')
  })

  test('renames a package include', () => {
    strictEqual(
      migrateIncludes('@"@voxgig/docgen/model/docgen.aon"\nmain: {}\n'),
      '@"@voxgig/docgen/model/docgen.aontu"\nmain: {}\n')
  })

  test('renames an include whose path carries an escape', () => {
    strictEqual(migrateIncludes("@'C:\\\\p\\\\a.aon'"), "@'C:\\\\p\\\\a.aontu'")
  })

  test('leaves .aontu, and other extensions, alone', () => {
    for (const src of ['@"./a.aontu"', '@"./a.json"', '@"./a.aonx"', '@"./aon"']) {
      strictEqual(migrateIncludes(src), src)
    }
  })

  test('never touches a .aon that is text, not an include', () => {
    const src = [
      "a: '@\"./in-single.aon\"'",
      'b: "@\'./in-double.aon\'"',
      'c: `@"./in-backtick.aon"`',
      '# @"./in-hash-comment.aon"',
      '// @"./in-slash-comment.aon"',
      '/* @"./in-block-comment.aon" */',
      'd: @"./real.aon"',
    ].join('\n')

    strictEqual(migrateIncludes(src), src.replace('real.aon', 'real.aontu'))
  })

})


describe('pre-rename definition files', () => {

  test('an item is found under either name, .aontu first', () => {
    const dir = tmpdir()
    try {
      const model = Path.join(dir, 'model', 'target')
      Fs.mkdirSync(model, { recursive: true })
      Fs.writeFileSync(Path.join(model, 'go.aon'), '')
      Fs.writeFileSync(Path.join(model, 'ts.aon'), '')
      Fs.writeFileSync(Path.join(model, 'ts.aontu'), '')

      strictEqual(definitionPathAny(Fs, dir, 'target', 'go'), Path.join(model, 'go.aon'))
      strictEqual(definitionPathAny(Fs, dir, 'target', 'ts'), Path.join(model, 'ts.aontu'))
      strictEqual(definitionPathAny(Fs, dir, 'target', 'py'), Path.join(model, 'py.aontu'))
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a pre-rename index is not an item', () => {
    const dir = tmpdir()
    try {
      const model = Path.join(dir, 'model', 'target')
      Fs.mkdirSync(model, { recursive: true })
      for (const f of ['target-index.aon', 'go.aon', 'ts.aontu']) {
        Fs.writeFileSync(Path.join(model, f), '')
      }

      deepStrictEqual(definitionNames(Fs, dir, 'target'), ['go', 'ts'])
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('an index entry naming .aon is renamed, and found by name', () => {
    strictEqual(appendIndexEntries('@"./go.aon"', ['ts']),
      '@"./go.aontu"\n@"./ts.aontu"')
    strictEqual(appendIndexEntries('@"./go.aon"', ['go']), '@"./go.aontu"')
  })

  test('a target model is read under its pre-rename name', () => {
    const dir = tmpdir()
    try {
      Fs.mkdirSync(Path.join(dir, 'model', 'target'), { recursive: true })
      Fs.writeFileSync(Path.join(dir, 'model', 'target', 'iot.aon'),
        "main: kit: target: iot: feature: { trim: false, fullset: ['retry'] }\n")

      const got = readTargetFeature(
        { log: silentLog(), fs: () => Fs }, dir, 'iot', 'iot')

      deepStrictEqual(got, { trim: false, fullset: ['retry'] })
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })

})


describe('an item from a package that still ships .aon', () => {

  function read(project: any, rel: string): string {
    return String(project.fs.readFileSync(ROOT + '/' + rel, 'utf8'))
  }

  test('installs as .aontu, with only its includes renamed', async () => {
    const pkg = legacyPackage()
    try {
      const project = makeProject()
      await edition_add([Path.join(pkg, 'summary')], project.actx)

      const files = project.files()
      ok(files.includes('model/edition/summary.aontu'), files.join(','))
      ok(!files.includes('model/edition/summary.aon'), files.join(','))

      const copy = read(project, 'model/edition/summary.aontu')
      ok(copy.startsWith('@"../shared/base.aontu"\n'), copy)
      ok(copy.includes('@"./old.aon"'), 'a comment was rewritten: ' + copy)
      ok(copy.includes('@"./kept.aon" is not'), 'a string was rewritten: ' + copy)
      ok(copy.includes("package: '@acme/legacy-docs'"), copy)

      ok(read(project, 'model/edition/edition-index.aontu')
        .includes('@"./summary.aontu"'))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })

  test('doctor compares the copy with the same rename, so it is clean', async () => {
    const pkg = legacyPackage()
    try {
      for (const ref of ['summary', 'summary~partner']) {
        const project = makeProject()
        await edition_add([Path.join(pkg, ref)], project.actx)

        const res: any = await doctor(project.actx)
        const r = res.report

        deepStrictEqual(
          [...r.forked, ...r.edited, ...r.stale, ...r.missing,
          ...r.aliasedDiff, ...r.resyncPending],
          [], ref + ': ' + JSON.stringify(r))
        strictEqual(r.ok, true, JSON.stringify(r))
      }
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })

  test('doctor still sees a real edit of the copy', async () => {
    const pkg = legacyPackage()
    try {
      const project = makeProject()
      await edition_add([Path.join(pkg, 'summary')], project.actx)

      const file = ROOT + '/model/edition/summary.aontu'
      project.fs.writeFileSync(file,
        read(project, 'model/edition/summary.aontu') + "extra: 'edited'\n")

      const res: any = await doctor(project.actx)
      ok(res.report.forked.includes('model/edition/summary.aontu'),
        JSON.stringify(res.report))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })

  test('package check compiles it as installed, and only warns', () => {
    const pkg = legacyPackage()
    try {
      const report = checkPackage(pkg, {
        fs: () => Fs, log: silentLog(), folder: '.', model: { main: {} },
      } as any)

      deepStrictEqual(points(report, 'error'), [], JSON.stringify(report.findings))
      deepStrictEqual(points(report, 'warn'), ['model-legacy-aon'],
        JSON.stringify(report.findings))
      strictEqual(report.ok, true)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })

  test('an include that exists only as .aon is a warning, not an error', () => {
    const pkg = legacyPackage({ sharedExt: '.aon' })
    try {
      const report = checkPackage(pkg, {
        fs: () => Fs, log: silentLog(), folder: '.', model: { main: {} },
      } as any)

      deepStrictEqual(points(report, 'error'), [], JSON.stringify(report.findings))
      deepStrictEqual(points(report, 'warn'),
        ['model-legacy-aon', 'model-legacy-unresolved'],
        JSON.stringify(report.findings))
      match(report.findings[1].note, /base\.aontu/)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })

  test('being legacy excuses nothing else', () => {
    const pkg = legacyPackage({ anchor: false })
    try {
      const report = checkPackage(pkg, {
        fs: () => Fs, log: silentLog(), folder: '.', model: { main: {} },
      } as any)

      ok(points(report, 'error').includes('model-anchor-missing'),
        JSON.stringify(report.findings))
      strictEqual(report.ok, false)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })

  test('an unresolved include in a .aontu item stays an error', () => {
    const pkg = legacyPackage()
    try {
      const model = Path.join(pkg, '.sdk', 'model', 'edition')
      Fs.renameSync(Path.join(model, 'summary.aon'), Path.join(model, 'summary.aontu'))
      Fs.writeFileSync(Path.join(model, 'summary.aontu'),
        Fs.readFileSync(Path.join(model, 'summary.aontu'), 'utf8')
          .replace('../shared/base.aon', '../shared/absent.aontu'))

      const report = checkPackage(pkg, {
        fs: () => Fs, log: silentLog(), folder: '.', model: { main: {} },
      } as any)

      deepStrictEqual(points(report, 'error'), ['model-parse'],
        JSON.stringify(report.findings))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })

})
