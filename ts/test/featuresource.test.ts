
import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'

import {
  featureOf, findFeatureSources, availableFeatures, srcFeatureExcludes,
  inactiveFeatureExcludes, pluginExcludes,
} from '../dist/sdkgen.js'
import { SCAFFOLD, PROJECT, KIT, addTarget } from './actionharness'


function allTargets(): string[] {
  return Fs.readdirSync(Path.join(SCAFFOLD, 'model', 'target'))
    .filter((f: string) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
    .map((f: string) => f.replace(/\.aontu$/, ''))
    .sort()
}


function targetFeature(name: string): any {
  const path = Path.join(SCAFFOLD, 'model', 'target', name + '.aontu')
  const errs: any[] = []
  const model = new Aontu().generate(Fs.readFileSync(path, 'utf8'), { path, errs })
  strictEqual(errs.length, 0, name + ': target model did not compile')
  return model?.main?.[KIT]?.target?.[name]?.feature ?? {}
}


describe('featureOf', () => {

  test('maps a file name back to its feature, per language convention', () => {
    strictEqual(featureOf('retry_feature.go', false), 'retry')
    strictEqual(featureOf('RetryFeature.cs', false), 'retry')
    strictEqual(featureOf('retry.rs', false), 'retry')
    strictEqual(featureOf('retry', true), 'retry')
  })


  test('leaves the shared machinery inside a feature directory alone', () => {
    // `_feature` is a PREFIX here, not a suffix — these are option readers
    // and module indexes, not features, and dropping them breaks the build.
    strictEqual(featureOf('feature_options.go', false), 'feature_options')
    strictEqual(featureOf('FeatureOptions.cs', false), 'featureoptions')
    strictEqual(featureOf('mod.rs', false), 'mod')
    strictEqual(featureOf('support.rs', false), 'support')
    strictEqual(featureOf('__init__.py', false), '__init__')
    strictEqual(featureOf('README.md', false), 'readme')
  })
})


describe('findFeatureSources', () => {

  const available = availableFeatures(Fs, SCAFFOLD)


  test('the scaffold catalogues the shipped features', () => {
    ok(10 < available.length,
      'expected the shipped feature catalogue, got ' + available.length)
    ok(available.includes('retry'), 'catalogue is missing retry')
    ok(!available.includes('feature-index'), 'the index is not a feature')
  })


  // The bug in one assertion: before the fix this found nothing outside ts
  // and js, because it was only ever looking at `src/feature/<name>`.
  test('finds per-feature source in every layout the scaffold uses', () => {
    const expected: Record<string, string> = {
      go: 'feature/retry_feature.go',
      rust: 'feature/retry.rs',
      py: 'pkg/feature/retry_feature.py',
      swift: 'Sources/ProjectNameSDK/feature/RetryFeature.swift',
      elixir: 'lib/projectname/feature/retry.ex',
      csharp: 'feature/RetryFeature.cs',
      ts: 'src/feature/retry',
    }

    for (const [target, path] of Object.entries(expected)) {
      const found = findFeatureSources(Fs, Path.join(SCAFFOLD, 'tm', target), available)
      const retry = found.filter((s: any) => 'retry' === s.name).map((s: any) => s.path)

      ok(retry.includes(path),
        target + ': retry source not found at ' + path + ' (found: ' + retry.join(', ') + ')')
    }
  })


  test('never claims a shared file as feature source', () => {
    for (const target of allTargets()) {
      const found = findFeatureSources(Fs, Path.join(SCAFFOLD, 'tm', target), available)

      for (const source of found) {
        const base = Path.basename(source.path)
        ok(!/^(mod|support|options|__init__|README)\b/i.test(base),
          target + ': shared file ' + source.path + ' claimed as feature ' + source.name)
        ok(!/feature[_.]?options/i.test(base),
          target + ': option reader ' + source.path + ' claimed as feature ' + source.name)
      }
    }
  })
})


describe('srcFeatureExcludes', () => {

  const model = {
    main: {
      [KIT]: {
        feature: {
          retry: { name: 'retry', active: false },
          cache: { name: 'cache', active: true },
        },
      },
    },
  }

  const excludes = srcFeatureExcludes(model)


  test('excludes a declared but inactive feature', () => {
    ok(excludes.some((r: RegExp) => r.test('tm/ts/src/feature/retry/RetryFeature.ts')),
      'inactive feature retry is not excluded')
  })


  test('leaves active features and base alone', () => {
    for (const path of [
      'tm/ts/src/feature/cache/CacheFeature.ts',
      'tm/ts/src/feature/base/BaseFeature.ts',
      'tm/ts/src/feature/README.md',
    ]) {
      ok(!excludes.some((r: RegExp) => r.test(path)), path + ' was excluded')
    }
  })


  test('a model with no features excludes nothing', () => {
    strictEqual(srcFeatureExcludes({ main: { [KIT]: {} } }).length, 0)
  })
})


describe('inactiveFeatureExcludes', () => {

  // The helper reads `tm/<target>` from the working directory, as Copy does.
  let cwd = ''
  before(() => {
    cwd = process.cwd()
    process.chdir(SCAFFOLD)
  })
  after(() => {
    if ('' !== cwd) process.chdir(cwd)
  })

  const ctx = (feature: Record<string, any>) =>
    ({ fs: () => Fs, model: { main: { [KIT]: { feature } } } })
  const target = (name: string) => ({ name, feature: targetFeature(name) })
  const OFF = {
    secrets: { name: 'secrets', active: false },
    test: { name: 'test', active: true },
  }
  const hit = (excludes: RegExp[], path: string) => excludes.some((re) => re.test(path))


  test('a declared feature that is off loses its source and its tests', () => {
    const available = availableFeatures(Fs, SCAFFOLD)
    const kept: string[] = []
    const lost: string[] = []

    for (const name of allTargets()) {
      if (false === targetFeature(name).trim) continue

      const excludes = inactiveFeatureExcludes(ctx(OFF), target(name))
      for (const s of findFeatureSources(Fs, Path.join(SCAFFOLD, 'tm', name), available)) {
        const path = s.path + (s.folder ? '/x' : '')
        if ('secrets' === s.name && !hit(excludes, path)) kept.push(name + ': ' + s.path)
        if ('test' === s.name && hit(excludes, path)) lost.push(name + ': ' + s.path)
      }
    }

    deepStrictEqual(kept, [], 'secrets source shipped although the model switches it off')
    deepStrictEqual(lost, [], 'test feature source trimmed although it is active')
  })


  test('a Copy of a subtree gets paths relative to it', () => {
    const py = inactiveFeatureExcludes(ctx(OFF), target('py'), 'tm/py/pkg')
    ok(hit(py, 'feature/secrets_feature.py'))
    ok(hit(py, 'feature/secrets/voxgig_sekreto/sekreto.py'))
    ok(!hit(py, 'feature/test_feature.py'))

    const swift = inactiveFeatureExcludes(ctx(OFF), target('swift'),
      'tm/swift/Tests/ProjectNameSDKTests')
    ok(hit(swift, 'feature/secrets/SecretsFeatureTest.swift'))
    ok(hit(swift, 'FeatureTest.swift'), 'the cross-feature suite stayed')
  })


  test('the cross-feature suite goes only when something is trimmed', () => {
    ok(hit(inactiveFeatureExcludes(ctx(OFF), target('go')), 'test/feature_test.go'))
    deepStrictEqual(inactiveFeatureExcludes(ctx({
      ...OFF, secrets: { name: 'secrets', active: true },
    }), target('go')), [])
    deepStrictEqual(inactiveFeatureExcludes(ctx({}), target('go')), [])
  })


  test('a target that cannot trim keeps every feature', () => {
    for (const name of ['clojure', 'scala', 'zig']) {
      deepStrictEqual(inactiveFeatureExcludes(ctx(OFF), target(name)), [], name)
    }
  })
})


describe('pluginExcludes', () => {

  const model = (active: boolean) => ({ main: { [KIT]: { feature: { secrets: {
    name: 'secrets', active, plugin: {
      vault: { active: true, path: ['feature/secrets/plugins/hashicorp.rs'] },
      aws: { active: false, path: ['feature/secrets/plugins/aws.rs'] },
    },
  } } } } })
  const hit = (excludes: RegExp[], path: string) => excludes.some((re) => re.test(path))


  test('an active feature keeps its active groups', () => {
    const excludes = pluginExcludes(model(true))
    ok(!hit(excludes, 'feature/secrets/plugins/hashicorp.rs'))
    ok(hit(excludes, 'feature/secrets/plugins/aws.rs'))
  })


  test('a feature that is off loses every group', () => {
    const excludes = pluginExcludes(model(false))
    ok(hit(excludes, 'feature/secrets/plugins/hashicorp.rs'))
    ok(hit(excludes, 'feature/secrets/plugins/aws.rs'))
  })
})


describe('target add feature trimming', () => {

  // Corpus guard. A target either trims its feature source to the model, or
  // says why it cannot — silence is not an option, because the default is to
  // trim and a target whose templates are not ready for that produces a
  // project that does not compile.
  test('every target declares whether it can be trimmed', () => {
    const untrimmable: string[] = []

    for (const target of allTargets()) {
      const feature = targetFeature(target)

      if (false === feature.trim) {
        untrimmable.push(target)
        continue
      }

      // A fullset path that does not exist excludes nothing — a silent
      // no-op that only shows up as a broken build downstream.
      for (const path of (feature.fullset ?? [])) {
        ok(Fs.existsSync(Path.join(SCAFFOLD, 'tm', target, path)),
          target + ': feature.fullset names ' + path + ', which does not exist')
      }
    }

    deepStrictEqual(untrimmable,
      ['clojure', 'scala', 'zig'],
      'the set of targets that cannot trim feature source changed')
  })


  test('a zero-feature model gets no unselected feature source', async () => {
    const available = availableFeatures(Fs, SCAFFOLD)
    const selected = new Set(['base', 'test'])

    for (const target of allTargets()) {
      if (false === targetFeature(target).trim) continue

      const written = await addTarget(target, {})

      // Map each written path back through the same discovery the action
      // used, so this asserts on the real output rather than on a guess
      // about where the source would have landed.
      const tmroot = 'tm/' + target + '/'
      const sources = findFeatureSources(Fs, Path.join(SCAFFOLD, 'tm', target), available)

      const stray = sources
        .filter((s: any) => !selected.has(s.name))
        .filter((s: any) => written.some((p: string) =>
          p === tmroot + s.path || p.startsWith(tmroot + s.path + '/')))

      deepStrictEqual(stray.map((s: any) => s.path), [],
        target + ': copied source for features the model never declared')

      const kept = sources.filter((s: any) => 'test' === s.name)
      if (0 < kept.length) {
        ok(written.some((p: string) =>
          p === tmroot + kept[0].path || p.startsWith(tmroot + kept[0].path + '/')),
          target + ': the test feature source is missing')
      }
    }
  })


  // The second leak: `active` was never consulted, so a feature the model
  // had switched off still shipped its source. This one hit ts and js too,
  // where the layout gate did work.
  test('a declared but inactive feature gets no source', async () => {
    const feature = {
      retry: { name: 'retry', active: false },
      cache: { name: 'cache', active: true },
    }

    for (const target of ['ts', 'go', 'py']) {
      const written = await addTarget(target, feature)
      const joined = written.join('\n')

      ok(!/(^|\/)retry([_.\/]|$)/m.test(joined.replace(/[^\n]*\/(model|src\/cmp)\/[^\n]*/g, '')),
        target + ': inactive feature retry was copied anyway')

      ok(/cache/.test(joined), target + ': active feature cache was not copied')

      ok(!written.includes('model/feature/retry.aontu'),
        target + ': inactive feature retry was added to the model')
      ok(written.includes('model/feature/cache.aontu'),
        target + ': active feature cache was not added to the model')
    }
  })


  // The cross-feature suite travels with the features it exercises: gone
  // when the set is trimmed, kept when it is complete. A target that keeps
  // it after trimming does not compile — that file constructs every shipped
  // feature type by name.
  test('the cross-feature suite follows the feature set', async () => {
    const available = availableFeatures(Fs, SCAFFOLD)
    const full: Record<string, any> = {}
    for (const name of available) {
      full[name] = { name, active: true }
    }

    for (const target of allTargets()) {
      const fullset = targetFeature(target).fullset ?? []
      if (0 === fullset.length) continue

      const trimmed = new Set(await addTarget(target, {}))
      const complete = new Set(await addTarget(target, full))

      for (const path of fullset) {
        const written = 'tm/' + target + '/' + path
        ok(!trimmed.has(written),
          target + ': ' + path + ' survived a trimmed feature set')
        ok(complete.has(written),
          target + ': ' + path + ' was dropped despite the full feature set')
      }
    }
  })


  // The coupling that makes trimming dangerous: a template left behind that
  // still names a feature whose source is gone. Everything the scaffold
  // ships is scanned, so a new template that hardcodes a feature is caught
  // here rather than by a downstream compiler.
  test('nothing left behind names a dropped feature', async () => {
    const spellings = (name: string) => {
      const Name = name[0].toUpperCase() + name.slice(1)
      return [
        name + '_feature', 'feature_' + name, Name + 'Feature',
        'New' + Name + 'Feature', 'feature/' + name, 'feature::' + name,
      ]
    }

    const PINNED = [
      /^tm\/c\/core\/sdk\.h$/,
      /^tm\/py\/test\/test_feature\.py$/,
      /^tm\/ocaml\/sdk_features\.ml$/,
      /^tm\/ocaml\/test\/harness\.ml$/,
    ]

    const available = availableFeatures(Fs, SCAFFOLD)
    const selected = new Set(['base', 'test'])
    const dropped = available.filter((n: string) => !selected.has(n))
    const offenders: string[] = []

    for (const target of allTargets()) {
      if (false === targetFeature(target).trim) continue

      const written = await addTarget(target, {})
      const sources = findFeatureSources(Fs, Path.join(SCAFFOLD, 'tm', target), available)
      const sourcePaths = sources.map((s: any) => 'tm/' + target + '/' + s.path)

      for (const path of written) {
        if (!path.startsWith('tm/' + target + '/')) continue
        if (PINNED.some((re) => re.test(path))) continue
        if (sourcePaths.some((p: string) => path === p || path.startsWith(p + '/'))) continue

        // `path` is already scaffold-relative (`tm/<target>/...`); the copy
        // rewrites content but not names, so the source is the thing to read.
        const scaffoldPath = Path.join(SCAFFOLD, path)
        if (!Fs.existsSync(scaffoldPath)) continue

        const text = Fs.readFileSync(scaffoldPath, 'utf8')
        const named = dropped.filter((name: string) =>
          spellings(name).some((s: string) => text.includes(s)))

        if (0 < named.length) {
          offenders.push(path + ' -> ' + named.join(', '))
        }
      }
    }

    // Reported together: fixing these one failure at a time hides how many
    // targets a new coupling actually affects.
    deepStrictEqual(offenders, [],
      'templates left behind still name a trimmed feature:\n  ' +
      offenders.join('\n  '))
  })


  // Trimming must not turn into deleting. A project that selects everything
  // gets exactly what the scaffold ships, cross-feature test suite included.
  test('a full feature set copies the template tree intact', async () => {
    const available = availableFeatures(Fs, SCAFFOLD)
    const feature: Record<string, any> = {}
    for (const name of available) {
      feature[name] = { name, active: true }
    }

    for (const target of ['go', 'rust', 'ts', 'swift']) {
      const written = new Set(await addTarget(target, feature))
      const tmroot = Path.join(SCAFFOLD, 'tm', target)

      const missing: string[] = []
      const walk = (rel: string) => {
        const abs = '' === rel ? tmroot : Path.join(tmroot, rel)
        for (const entry of Fs.readdirSync(abs)) {
          const entryrel = '' === rel ? entry : rel + '/' + entry
          if (Fs.statSync(Path.join(tmroot, entryrel)).isDirectory()) {
            walk(entryrel)
          }
          else if (!written.has('tm/' + target + '/' + entryrel)) {
            missing.push(entryrel)
          }
        }
      }
      walk('')

      deepStrictEqual(missing, [],
        target + ': template files dropped despite the full feature set')
    }
  })
})
