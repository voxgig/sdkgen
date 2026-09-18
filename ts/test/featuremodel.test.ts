

import { test, describe } from 'node:test'
import { strictEqual, ok, deepStrictEqual } from 'node:assert'

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'

import { loadFeature, loadBase } from './featureharness'

import { featureApplies } from '../dist/helpers/applicability'


const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')
const FEATURE_MODEL = Path.join(SDK, 'model', 'feature')
const FEATURE_TM = Path.join(SDK, 'tm', 'ts', 'src', 'feature')

const ENTERPRISE = [
  'retry', 'timeout', 'ratelimit', 'cache', 'cost', 'idempotency', 'paging',
  'streaming', 'proxy', 'telemetry', 'metrics', 'debug', 'audit',
  'clienttrack', 'rbac', 'netsim',
  // Gated by applicability (`needs: ['sekreto']`), so unlike every feature
  // above it, this one is NOT expected in every target — see the
  // feature-language-parity exemption below.
  'secrets',
  // Gated the same way, on `schema`: the feature validates against the
  // generated Schema module, so it applies only where the module AND this
  // feature's own source both exist.
  'validate',
]

const HOOK_NAMES = [
  'PostConstruct', 'PostConstructEntity', 'SetData', 'GetData', 'SetMatch',
  'GetMatch', 'PrePoint', 'PreSpec', 'PreRequest', 'PreResponse', 'PreResult',
  'PreDone', 'PreUnexpected',
]


function compileFeatureModel(): any {
  const p = Path.join(FEATURE_MODEL, 'feature-index.aon')
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
    const cfg = readFileSync(
      Path.resolve(SDK, 'src', 'cmp', 'ts', 'Config_ts.ts'), 'utf8')
    ok(/Feature,`/.test(cfg),
      '#FeatureClasses must emit a trailing comma per entry')
    ok(/formatJson\(configDef\.feature\[f\.name\][^`]*\},`/.test(cfg),
      '#FeatureConfigs must emit a trailing comma per entry, rendered from ' +
      'configDefinition\'s def (which carries the transport role)')
  })

  const TRANSPORT_ROLE: Record<string, string> = {
    test: 'base',
    cache: 'wrap', netsim: 'wrap', proxy: 'wrap', ratelimit: 'wrap',
    retry: 'wrap', timeout: 'wrap',
    cost: 'wrap',
    audit: 'none', clienttrack: 'none', debug: 'none', idempotency: 'none',
    log: 'none', metrics: 'none', paging: 'none', rbac: 'none',
    secrets: 'wrap',
    streaming: 'none', telemetry: 'none',
    validate: 'none',
  }

  test('every feature model declares its transport role', () => {
    // Compiled WITHOUT the base schema (compileFeatureModel unifies only the
    // feature index), so a passing role here is the model file's own explicit
    // line, not the schema's *'none' default leaking in.
    const { model } = compileFeatureModel()
    const feature = model.main.kit.feature

    deepStrictEqual(Object.keys(feature).sort(), Object.keys(TRANSPORT_ROLE).sort(),
      'a feature was added or removed without deciding its transport role - ' +
      'update TRANSPORT_ROLE in test/featuremodel.test.ts')

    for (const [name, role] of Object.entries(TRANSPORT_ROLE)) {
      strictEqual(feature[name].transport, role,
        `feature ${name} must declare transport: '${role}'`)
    }
  })

  test('feature-index.aon includes every model file', () => {
    const indexSrc = readFileSync(Path.join(FEATURE_MODEL, 'feature-index.aon'), 'utf8')
    const files = readdirSync(FEATURE_MODEL)
      .filter((f) => f.endsWith('.aon') && 'feature-index.aon' !== f)
      .map((f) => f.replace(/\.aon$/, ''))
    for (const name of files) {
      ok(indexSrc.includes(`"./${name}.aon"`), `feature-index missing @"./${name}.aon"`)
    }
  })
})


describe('feature-template-consistency', () => {

  const { model } = compileFeatureModel()
  const Base = loadBase()
  const baseHooks = new Set(Object.getOwnPropertyNames(Base.prototype))

  for (const name of ENTERPRISE) {

    test(`${name}: template class matches its model`, () => {
      const cls = loadFeature(name)
      ok('function' === typeof cls, `${name} class not exported`)
      const inst = new cls()
      ok(inst instanceof Base, `${name} must extend BaseFeature`)
      strictEqual(inst.name, name, `${name}.name mismatch`)
      ok('string' === typeof inst.version, `${name}.version missing`)

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


describe('feature-language-parity', () => {

  const TM = Path.join(SDK, 'tm')

  function cap(n: string): string {
    return n.charAt(0).toUpperCase() + n.slice(1)
  }

  const IMPL: Record<string, (n: string) => string> = {
    ts: (n) => Path.join('ts', 'src', 'feature', n, cap(n) + 'Feature.ts'),
    js: (n) => Path.join('js', 'src', 'feature', n, cap(n) + 'Feature.js'),
    go: (n) => Path.join('go', 'feature', n + '_feature.go'),
    // py nests its runtime packages under tm/py/pkg/ so the generated SDK
    // can put them inside the <name>_sdk package rather than at the
    // language root, where `feature`/`core`/`utility` are shadowable.
    py: (n) => Path.join('py', 'pkg', 'feature', n + '_feature.py'),
    php: (n) => Path.join('php', 'feature', cap(n) + 'Feature.php'),
    rb: (n) => Path.join('rb', 'feature', n + '_feature.rb'),
    lua: (n) => Path.join('lua', 'feature', n + '_feature.lua'),
    // Added language targets. Per-feature source files; naming follows each
    // language's convention (clojure/ocaml keep all features in
    // a single module — so they are covered
    // by the copy-dir + model checks below rather than a per-feature file).
    csharp: (n) => Path.join('csharp', 'feature', cap(n) + 'Feature.cs'),
    java: (n) => Path.join('java', 'feature', cap(n) + 'Feature.java'),
    kotlin: (n) => Path.join('kotlin', 'feature', cap(n) + 'Feature.kt'),
    scala: (n) => Path.join('scala', 'feature', cap(n) + 'Feature.scala'),
    swift: (n) =>
      Path.join('swift', 'Sources', 'ProjectNameSDK', 'feature', cap(n) + 'Feature.swift'),
    perl: (n) => Path.join('perl', 'feature', n + '_feature.pm'),
    rust: (n) => Path.join('rust', 'feature', n + '.rs'),
    c: (n) => Path.join('c', 'feature', n + '.c'),
    cpp: (n) => Path.join('cpp', 'feature', n + '.hpp'),
    zig: (n) => Path.join('zig', 'feature', n + '.zig'),
    elixir: (n) => Path.join('elixir', 'lib', 'projectname', 'feature', n + '.ex'),
  }

  const SDK_TARGETS = [
    'ts', 'js', 'go', 'py', 'php', 'rb', 'lua',
    'csharp', 'java', 'kotlin', 'scala', 'swift', 'rust', 'c', 'cpp',
    'zig', 'perl', 'clojure', 'elixir', 'ocaml',
  ]

  // Targets that CONSUME another target's SDK rather than being one
  // (go-cli/go-mcp wrap `go`, py-data wraps `py`). Same list as
  // parity.test.ts's NON_SDK_TARGETS. `seneca-provider` was the fourth and
  // has moved to packages/sdkgen-seneca-provider.
  const CONSUMER_TARGETS = ['go-cli', 'go-mcp', 'py-data']

  const NO_FEATURE_DIRS: string[] = []

  // Every SDK target plus the non-SDK consumer surfaces need a
  // src/feature/<name>/ dir for `feature add` to copy (flat-feature languages
  // and the consumer targets use .gitkeep).
  const ADD_TARGETS = SDK_TARGETS
    .concat(CONSUMER_TARGETS)
    .filter((t) => !NO_FEATURE_DIRS.includes(t))

  const GATED: Record<string, string[]> = {
    secrets: [
      'c', 'clojure', 'cpp', 'csharp', 'elixir', 'go', 'java', 'js', 'kotlin',
      'lua', 'ocaml', 'perl', 'php', 'py', 'rb', 'rust', 'scala', 'swift',
      'ts', 'zig',
    ],

    validate: ['c', 'clojure', 'cpp', 'csharp', 'elixir', 'go', 'java', 'js',
      'kotlin', 'lua', 'ocaml', 'perl', 'php', 'py', 'rb', 'rust', 'scala',
      'swift', 'ts', 'zig'],
  }

  function expectedTargets(name: string, all: string[]): string[] {
    const gated = GATED[name]
    return null == gated ? all : all.filter((t) => gated.includes(t))
  }

  const TARGET_MODEL = Path.join(SDK, 'model', 'target')

  // What a target's model declares it PROVIDES. Read from the `.aon` text:
  // the target models are unified per-target by the build, with no index to
  // compile the way the feature models have one, and the only thing wanted
  // here is the one map.
  function declaredProvides(t: string): Record<string, boolean> {
    const mp = Path.join(TARGET_MODEL, t + '.aon')
    if (!existsSync(mp)) {
      return {}
    }

    const m = readFileSync(mp, 'utf8').match(/\bprovides\s*:\s*\{([^}]*)\}/)
    if (null == m) {
      return {}
    }

    const out: Record<string, boolean> = {}
    for (const part of m[1].split(',')) {
      const kv = part.match(/([\w-]+)\s*:\s*(true|false)/)
      if (null != kv) {
        out[kv[1]] = 'true' === kv[2]
      }
    }

    return out
  }


  function shippedTargets(): string[] {
    return readdirSync(TARGET_MODEL)
      .filter((f) => f.endsWith('.aon') && 'target-index.aon' !== f)
      .map((f) => f.replace(/\.aon$/, ''))
      .sort()
  }

  for (const [lang, impl] of Object.entries(IMPL)) {
    test(`${lang}: every enterprise feature is implemented`, () => {
      for (const name of ENTERPRISE) {
        if (!expectedTargets(name, [lang]).includes(lang)) {
          continue
        }
        const p = Path.join(TM, impl(name))
        ok(existsSync(p), `missing ${lang} implementation: ${p}`)
      }
    })
  }

  test('the target lists cover every shipped target exactly once', () => {
    const declared = SDK_TARGETS.concat(CONSUMER_TARGETS).sort()

    deepStrictEqual(declared, shippedTargets(),
      'a target was added or removed without classifying it — add it to ' +
      'SDK_TARGETS (a language SDK) or CONSUMER_TARGETS (wraps another ' +
      'target) in test/featuremodel.test.ts')

    deepStrictEqual(declared, Array.from(new Set(declared)),
      'a target appears in both SDK_TARGETS and CONSUMER_TARGETS')
  })

  test('every target has a feature-add copy dir per feature', () => {
    for (const t of ADD_TARGETS) {
      for (const name of ENTERPRISE) {
        if (!expectedTargets(name, [t]).includes(t)) {
          continue
        }
        const dir = Path.join(TM, t, 'src', 'feature', name)
        ok(existsSync(dir), `missing feature-add dir: tm/${t}/src/feature/${name}`)
      }
    }
  })


  test('gated features match the targets that declare the tags they need', () => {
    for (const [name, targets] of Object.entries(GATED)) {
      // (a) every target NOT named must really lack the source, otherwise
      // the exemption is hiding a target that already has it.
      const unexpected = ADD_TARGETS
        .filter((t) => !targets.includes(t))
        .filter((t) => existsSync(Path.join(TM, t, 'src', 'feature', name)))

      deepStrictEqual(unexpected, [],
        `these targets gained ${name} source — add them to GATED.${name} ` +
        'in test/featuremodel.test.ts (and give their model the tags it needs)')

      const undeclared = targets.filter((t) => {
        const mp = Path.join(TARGET_MODEL, t + '.aon')
        return !existsSync(mp) || !/\bprovides\s*:/.test(readFileSync(mp, 'utf8'))
      })

      deepStrictEqual(undeclared, [],
        `GATED.${name} names targets whose model declares no \`provides\` — ` +
        'the gate would drop the feature for them at generate time')
    }
  })

  test('the targets that declare a gated feature\'s tags are exactly the gated list', () => {
    const { model } = compileFeatureModel()

    for (const [name, targets] of Object.entries(GATED)) {
      const applies = ADD_TARGETS
        .filter((t) => featureApplies(
          model.main.kit.feature[name], { provides: declaredProvides(t) }))
        .sort()

      deepStrictEqual(applies, targets.slice().sort(),
        `the model makes ${name} apply to a different set than GATED.${name} ` +
        'names — either the target is missing the tags (the feature silently ' +
        'vanishes there) or it declares them without carrying ' +
        `tm/<lang>/src/feature/${name} (the feature applies with nothing to copy)`)
    }
  })

  // The exemption has to stay TRUE, or it silently becomes a mute button: a
  // target that gains feature source while sitting on this list would never
  // have those dirs checked again.
  test('targets exempt from feature-add dirs really have none', () => {
    const nowHasSource = NO_FEATURE_DIRS.filter((t) =>
      ENTERPRISE.some((name) =>
        existsSync(Path.join(TM, t, 'src', 'feature', name))))

    deepStrictEqual(nowHasSource, [],
      'these targets gained feature-add copy dirs — drop them from ' +
      'NO_FEATURE_DIRS so the per-feature check covers them')

    deepStrictEqual(NO_FEATURE_DIRS.filter((t) => !shippedTargets().includes(t)), [],
      'NO_FEATURE_DIRS names a target the scaffold does not ship')
  })

  test('every SDK target has a target definition', () => {
    for (const t of SDK_TARGETS) {
      const p = Path.join(TARGET_MODEL, t + '.aon')
      ok(existsSync(p), `missing target definition: model/target/${t}.aon`)
    }
  })
})
