// Feature source only reaches a project when the model asks for it.
//
// WHAT WENT WRONG
//
// `target add` copied a target's whole template tree with one exclusion,
// `/src\/feature/`, and then copied back the features the model declared.
// Two targets keep feature source at `src/feature/<name>/`. The other
// seventeen keep it at `feature/`, `pkg/feature/`, `lib/feature/`,
// `Sources/ProjectNameSDK/feature/` — paths that exclusion never matched. So
// every shipped feature was copied into every project regardless of the
// model: 272 stray source files for a project declaring no features at all.
// The gate looked like it worked because for those targets
// `src/feature/<name>/` exists as a `.gitkeep` placeholder — it was gating
// empty directories.
//
// A second leak, independent of layout: the feature list came from a plain
// `Object.keys(model.main.kit.feature)`, so `retry: { active: false }` still
// shipped every retry source file. That one hit ts and js too.
//
// WHAT THIS SUITE PINS
//
// The discovery rules (featureOf / findFeatureSources), that discovery finds
// real source for every target that has any, and — the test that would have
// caught the bug — that `target add` with a zero-feature model puts NO
// unselected feature source in the project, for every target that declares
// itself trimmable.
//
// Output goes to memfs; reads fall through to the real scaffold.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'

import {
  featureOf, findFeatureSources, availableFeatures, srcFeatureExcludes,
} from '../dist/sdkgen.js'
import { SCAFFOLD, PROJECT, KIT, addTarget } from './actionharness'


// Every target the scaffold ships.
function allTargets(): string[] {
  return Fs.readdirSync(Path.join(SCAFFOLD, 'model', 'target'))
    .filter((f: string) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
    .map((f: string) => f.replace(/\.aontu$/, ''))
    .sort()
}


// A target's own `feature` declaration, read the way target_add reads it.
function targetFeature(name: string): any {
  const path = Path.join(SCAFFOLD, 'model', 'target', name + '.aontu')
  const errs: any[] = []
  const model = new Aontu().generate(Fs.readFileSync(path, 'utf8'), { path, errs })
  strictEqual(errs.length, 0, name + ': target model did not compile')
  return model?.main?.[KIT]?.target?.[name]?.feature ?? {}
}


describe('featureOf', () => {

  test('maps a file name back to its feature, per language convention', () => {
    // go, py, rb, lua, perl
    strictEqual(featureOf('retry_feature.go', false), 'retry')
    // csharp, java, kotlin, scala, swift, php
    strictEqual(featureOf('RetryFeature.cs', false), 'retry')
    // rust, c, cpp, zig, elixir
    strictEqual(featureOf('retry.rs', false), 'retry')
    // ts, js, dart — the whole feature is a directory
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
      dart: 'lib/feature/retry',
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


// The generate-time half of the same guard, for the ts/js layout. Root
// renders a Feature component per ACTIVE feature, but Main copies the whole
// tm tree afterwards — which used to put a deactivated feature's source
// straight back, silently undoing the filter.
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

    // Pinned, not muted: this is the remaining work, and a target joining
    // or leaving the list is a decision that should be reviewed.
    //   clojure, lean, ocaml — every feature lives in ONE module
    //           (features.clj / SdkFeatures.lean / sdk_features.ml); there
    //           is no per-feature file to leave out until that module is
    //           generated from the model. (haskell was the fourth, until it
    //           moved to @voxgig/sdkgen-haskell.)
    //   scala — the cross-feature tests live inside the single test entry
    //           point, sdktest/SdkTestMain.scala.
    //   zig   — root.zig @imports every feature module, and build.zig names
    //           test/feature_test.zig explicitly.
    deepStrictEqual(untrimmable,
      ['clojure', 'lean', 'ocaml', 'scala', 'zig'],
      'the set of targets that cannot trim feature source changed')
  })


  // THE REGRESSION TEST. A model that declares no features gets no feature
  // source beyond the two every SDK needs: `base` (the foundation every
  // feature builds on) and `test` (SDK.test() depends on it).
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

      // And the selected ones DID arrive, so this is not passing by
      // copying nothing at all.
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

    for (const target of ['ts', 'go', 'dart', 'py']) {
      const written = await addTarget(target, feature)
      const joined = written.join('\n')

      ok(!/(^|\/)retry([_.\/]|$)/m.test(joined.replace(/[^\n]*\/(model|src\/cmp)\/[^\n]*/g, '')),
        target + ': inactive feature retry was copied anyway')

      ok(/cache/.test(joined), target + ': active feature cache was not copied')

      // The model file follows the source: an inactive feature is not
      // written into model/feature either.
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
    // Feature identifiers as each language spells them.
    const spellings = (name: string) => {
      const Name = name[0].toUpperCase() + name.slice(1)
      return [
        name + '_feature', 'feature_' + name, Name + 'Feature',
        'New' + Name + 'Feature', 'feature/' + name, 'feature::' + name,
      ]
    }

    // Pinned, not muted — each one audited, not merely quiet.
    //   c/core/sdk.h — declares a constructor prototype per feature. C is
    //     happy to declare a function that is never defined; the only caller
    //     was tests/feature_test.c, which trimming drops.
    //   py/test/test_feature.py — names features only as test CLASS names
    //     (`TestRetryFeature`) and as strings passed to the harness. It
    //     imports no feature module and constructs no feature class; every
    //     block is `pytest.mark.skipif(not has_feature(...))`.
    const PINNED = [
      /^tm\/c\/core\/sdk\.h$/,
      /^tm\/py\/test\/test_feature\.py$/,
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
        // Feature source naturally names its own feature.
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
