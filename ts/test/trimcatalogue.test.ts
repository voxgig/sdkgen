// WHICH NAMES COUNT AS FEATURE SOURCE, when `target add` decides what to trim.
//
// WHAT WENT WRONG
//
// The catalogue was the SOURCE folder's own `model/feature/` listing, which
// is right only while every target ships in the same package as every
// feature. An external target package declares no feature models of its own —
// it has no reason to — so `findFeatureSources` was handed an empty
// catalogue, discovered nothing, dropped nothing, and the consumer received
// that target's source for EVERY feature regardless of what its model
// selected.
//
// Measured on a target copied from the bundled `go`: the bundled one keeps
// two feature source files, the external one kept all eighteen. That is the
// failure helpers/featureSource was written to end — 272 stray files in one
// repo — arriving again by the one route it did not cover.

import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { featureCatalogue } from '../dist/action/target.js'
import {
  SCAFFOLD, makeProject, targetRef, target_add,
} from './actionharness'


// An external package providing ONE target, copied from the bundled `go` — so
// it ships source for every bundled feature while declaring no feature models
// of its own. That is what a real language package looks like: it implements
// the standard feature set, it does not redefine it.
function externalTargetPackage(): string {
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-trim-'))
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'target'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'src', 'cmp'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'tm'), { recursive: true })

  Fs.cpSync(Path.join(SCAFFOLD, 'src', 'cmp', 'go'),
    Path.join(sdk, 'src', 'cmp', 'iotgo'), { recursive: true })
  Fs.cpSync(Path.join(SCAFFOLD, 'tm', 'go'),
    Path.join(sdk, 'tm', 'iotgo'), { recursive: true })

  Fs.writeFileSync(Path.join(sdk, 'model', 'target', 'iotgo.aontu'),
    Fs.readFileSync(Path.join(SCAFFOLD, 'model', 'target', 'go.aontu'), 'utf8')
      .replace(/target: go:/g, 'target: iotgo:'))

  // Components are dispatched by convention, so their names have to match the
  // target — the same rename an aliased install performs.
  const cmpdir = Path.join(sdk, 'src', 'cmp', 'iotgo')
  for (const f of Fs.readdirSync(cmpdir)) {
    if (f.endsWith('_go.ts')) {
      Fs.renameSync(Path.join(cmpdir, f),
        Path.join(cmpdir, f.replace(/_go\.ts$/, '_iotgo.ts')))
    }
  }

  return dir
}


// The feature source files a target add left in the project.
function featureSource(project: any): string[] {
  return project.files()
    .filter((f: string) => f.includes('/feature/') && f.endsWith('_feature.go'))
    .map((f: string) => (f.split('/').pop() as string).replace('_feature.go', ''))
    .sort()
}


describe('feature trim catalogue', () => {

  test('an EXTERNAL target trims exactly as the bundled one does', async () => {
    const pkg = externalTargetPackage()
    try {
      const external = makeProject({})
      await target_add([Path.join(pkg, 'iotgo')], external.actx)

      const bundled = makeProject({})
      await target_add([targetRef('go')], bundled.actx)

      deepStrictEqual(featureSource(external), featureSource(bundled),
        'an external target kept different feature source than the ' +
        'identical bundled one — its catalogue was resolved from the wrong ' +
        'place, so nothing was trimmed')

      // And the trim really happened, rather than both keeping everything.
      ok(featureSource(bundled).length < 5,
        'the bundled target stopped trimming: ' + featureSource(bundled).join(', '))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a SELECTED feature survives in an external target', async () => {
    // The other half: trimming must not remove what the model asked for.
    const pkg = externalTargetPackage()
    try {
      const project = makeProject({
        feature: { retry: { name: 'retry', active: true } },
      })
      await target_add([Path.join(pkg, 'iotgo')], project.actx)

      ok(featureSource(project).includes('retry'),
        'a selected feature was trimmed out: ' + featureSource(project).join(', '))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('the catalogue unions bundled, source and model features', () => {
    const ctx = {
      fs: () => Fs,
      folder: Path.resolve(__dirname, '..'),
      model: { main: { kit: { feature: { homegrown: { name: 'homegrown' } } } } },
    }

    const names = featureCatalogue(ctx, SCAFFOLD)

    ok(names.includes('retry'), "the source package's own features are missing")
    ok(names.includes('homegrown'),
      'a feature the consumer model already has is missing — an EXTERNAL ' +
      "feature's source could never become trimmable")
  })
})
