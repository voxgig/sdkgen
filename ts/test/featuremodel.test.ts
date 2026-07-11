
// Model + template consistency for the shipped feature set.
//
// Guards three things that must stay in lockstep or a generated SDK breaks:
//   1. every feature's model unifies through aontu without error,
//   2. the feature-index registers every model file,
//   3. each template's implemented pipeline hooks exactly match the hooks
//      its model marks `active` (a drift here means a hook silently never
//      fires, or fires with no implementation).

import { test, describe } from 'node:test'
import { strictEqual, ok, deepStrictEqual } from 'node:assert'

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'

import { loadFeature, loadBase } from './featureharness'


const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')
const FEATURE_MODEL = Path.join(SDK, 'model', 'feature')
const FEATURE_TM = Path.join(SDK, 'tm', 'ts', 'src', 'feature')

// The enterprise features added on top of the core log/test pair.
const ENTERPRISE = [
  'retry', 'timeout', 'ratelimit', 'cache', 'idempotency', 'paging',
  'streaming', 'proxy', 'telemetry', 'metrics', 'debug', 'audit',
  'clienttrack', 'rbac', 'netsim',
]

const HOOK_NAMES = [
  'PostConstruct', 'PostConstructEntity', 'SetData', 'GetData', 'SetMatch',
  'GetMatch', 'PrePoint', 'PreSpec', 'PreRequest', 'PreResponse', 'PreResult',
  'PreDone', 'PreUnexpected',
]


function compileFeatureModel(): any {
  const p = Path.join(FEATURE_MODEL, 'feature-index.aontu')
  const src = readFileSync(p, 'utf8')
  const errs: any[] = []
  const model: any = new Aontu().generate(src, { path: p, errs })
  return { model, errs }
}


describe('feature-model', () => {

  test('the whole feature index compiles without errors', () => {
    const { model, errs } = compileFeatureModel()
    strictEqual(errs.length, 0,
      'feature model errors: ' + errs.map((e: any) => `[${e.why}] ${e.msg}`).join(' | '))
    ok(model?.main?.kit?.feature, 'feature map present')
  })

  test('every enterprise feature is registered and inactive by default', () => {
    const { model } = compileFeatureModel()
    const feature = model.main.kit.feature
    for (const name of ENTERPRISE) {
      ok(null != feature[name], `feature ${name} missing from model`)
      strictEqual(feature[name].config.options.active, false,
        `feature ${name} must be inactive by default`)
      ok('string' === typeof feature[name].title && feature[name].title.length > 0,
        `feature ${name} needs a title`)
    }
  })

  test('Config generator comma-separates the feature maps', () => {
    // With two or more features, the generated Config's FEATURE_CLASS map and
    // `feature = {}` config map must be comma-separated or the SDK will not
    // compile. This was latent while only a single feature shipped.
    const cfg = readFileSync(
      Path.resolve(SDK, 'src', 'cmp', 'ts', 'Config_ts.ts'), 'utf8')
    ok(/Feature,`/.test(cfg),
      '#FeatureClasses must emit a trailing comma per entry')
    ok(/formatJson\(f\.config[^`]*\},`/.test(cfg),
      '#FeatureConfigs must emit a trailing comma per entry')
  })

  test('feature-index.aontu includes every model file', () => {
    const indexSrc = readFileSync(Path.join(FEATURE_MODEL, 'feature-index.aontu'), 'utf8')
    const files = readdirSync(FEATURE_MODEL)
      .filter((f) => f.endsWith('.aontu') && 'feature-index.aontu' !== f)
      .map((f) => f.replace(/\.aontu$/, ''))
    for (const name of files) {
      ok(indexSrc.includes(`"${name}.aontu"`), `feature-index missing @"${name}.aontu"`)
    }
  })
})


describe('feature-template-consistency', () => {

  const { model } = compileFeatureModel()
  const Base = loadBase()
  const baseHooks = new Set(Object.getOwnPropertyNames(Base.prototype))

  for (const name of ENTERPRISE) {

    test(`${name}: template class matches its model`, () => {
      // Template exists, is named <Name>Feature, extends BaseFeature.
      const cls = loadFeature(name)
      ok('function' === typeof cls, `${name} class not exported`)
      const inst = new cls()
      ok(inst instanceof Base, `${name} must extend BaseFeature`)
      strictEqual(inst.name, name, `${name}.name mismatch`)
      ok('string' === typeof inst.version, `${name}.version missing`)

      // Implemented pipeline hooks (own prototype methods, minus what the
      // base defines) must equal the model's active hooks.
      const implemented = Object.getOwnPropertyNames(cls.prototype)
        .filter((m) => HOOK_NAMES.indexOf(m) >= 0)
        .sort()

      const hookModel = model.main.kit.feature[name].hook || {}
      const declared = Object.keys(hookModel)
        .filter((k) => hookModel[k] && true === hookModel[k].active)
        .sort()

      deepStrictEqual(implemented, declared,
        `${name}: implemented hooks ${JSON.stringify(implemented)} != declared active ${JSON.stringify(declared)}`)
    })
  }

  test('template directory has exactly the indexed features (plus base/log/test)', () => {
    const dirs = readdirSync(FEATURE_TM, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
    const expected = ENTERPRISE.concat(['base', 'log', 'test']).sort()
    deepStrictEqual(dirs, expected)
  })
})


// Every language target must ship the same feature set. ts/js keep features
// under src/feature/<name>/<Name>Feature.<ext>; the other languages keep a
// flat feature/ package (e.g. tm/go/feature/retry_feature.go) plus
// src/feature/<name>/ copy-target dirs for `feature add`.
describe('feature-language-parity', () => {

  const TM = Path.join(SDK, 'tm')

  function cap(n: string): string {
    return n.charAt(0).toUpperCase() + n.slice(1)
  }

  const IMPL: Record<string, (n: string) => string> = {
    ts: (n) => Path.join('ts', 'src', 'feature', n, cap(n) + 'Feature.ts'),
    js: (n) => Path.join('js', 'src', 'feature', n, cap(n) + 'Feature.js'),
    go: (n) => Path.join('go', 'feature', n + '_feature.go'),
    py: (n) => Path.join('py', 'feature', n + '_feature.py'),
    php: (n) => Path.join('php', 'feature', cap(n) + 'Feature.php'),
    rb: (n) => Path.join('rb', 'feature', n + '_feature.rb'),
    lua: (n) => Path.join('lua', 'feature', n + '_feature.lua'),
  }

  // Languages whose features are copied per-feature by `feature add` need a
  // src/feature/<name>/ dir to copy (flat-feature languages use .gitkeep).
  const ADD_TARGETS = ['ts', 'js', 'go', 'py', 'php', 'rb', 'lua', 'go-cli', 'go-mcp']

  for (const [lang, impl] of Object.entries(IMPL)) {
    test(`${lang}: every enterprise feature is implemented`, () => {
      for (const name of ENTERPRISE) {
        const p = Path.join(TM, impl(name))
        ok(existsSync(p), `missing ${lang} implementation: ${p}`)
      }
    })
  }

  test('every target has a feature-add copy dir per feature', () => {
    for (const t of ADD_TARGETS) {
      for (const name of ENTERPRISE) {
        const dir = Path.join(TM, t, 'src', 'feature', name)
        ok(existsSync(dir), `missing feature-add dir: tm/${t}/src/feature/${name}`)
      }
    }
  })
})
