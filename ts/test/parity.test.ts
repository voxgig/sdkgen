// Cross-language parity coverage, made VISIBLE and enforced.
//
// The value of sdkgen is that every target behaves identically, and the
// mechanism for proving that is the shared test corpus: language-neutral
// `.aontu` fixtures (create-sdkgen project/standard/.sdk/test/primary/) that
// compile to a test.json each target's own suite executes. A target whose
// suite does NOT drive that corpus is only ever checked against
// hand-written cases it wrote for itself, so it can drift from the reference
// without anything failing.
//
// Before this file, the only cross-language test asserted file EXISTENCE
// (featuremodel.test.ts), so the coverage tiers below were invisible: you had
// to grep the template tree to discover that five targets mirror the corpus
// by hand and four have no primary-utility suite at all.
//
// This test does not close those gaps — it PINS them. The manifest is the
// stated policy; a target that loses its corpus-driven suite, or a new target
// added without a decision about its tier, fails here.

import { test, describe } from 'node:test'
import { ok, deepStrictEqual, strictEqual } from 'node:assert'

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import Path from 'node:path'


const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')
const TM = Path.join(SDK, 'tm')


// The 21 corpus sections every FULL-tier target must execute. Kept explicit
// (rather than read from the sibling create-sdkgen checkout, which is not
// guaranteed to be present) so this suite is self-contained.
const CORPUS_SECTIONS = [
  'done', 'makeContext', 'makeError', 'makeOptions', 'makeRequest',
  'makeResponse', 'makeSpec', 'makeUrl', 'operator', 'param', 'prepareAuth',
  'prepareBody', 'prepareHeaders', 'prepareMethod', 'prepareParams',
  'preparePath', 'prepareQuery', 'resultBasic', 'resultBody', 'resultHeaders',
  'transformRequest', 'transformResponse',
]


// Targets that are not language SDKs: they consume the sibling `go` SDK and
// switch the standard generation phases off, so they have no primary-utility
// surface of their own.
const NON_SDK_TARGETS = ['go-cli', 'go-mcp']


// TIER 1 — drives the shared corpus for every section. This is the bar.
const FULL = [
  'cpp', 'csharp', 'dart', 'go', 'java', 'js', 'kotlin', 'lean', 'lua', 'perl',
  'php', 'py', 'rb', 'rust', 'swift', 'ts',
]

// TIER 2 — has a primary-utility suite, but it MIRRORS the corpus by hand
// instead of executing it, so the cases can drift from the reference. (zig's
// suite says so outright: "keeps the suite hermetic — no external fixture
// parsing".) Moving one of these to FULL is the highest-value parity work
// available.
const MIRRORED = ['c', 'clojure', 'elixir', 'haskell', 'zig']

// TIER 3 — no primary-utility suite at all. These targets' request-shaping
// utilities are unverified in every language-neutral sense.
const UNCOVERED = ['ocaml', 'scala']


// Targets exposing the raw-access escape hatch (direct/graphql). See the
// 'raw-access gate parity' suite below.
const RAW_ACCESS = [
  'c', 'clojure', 'cpp', 'csharp', 'dart', 'elixir', 'go', 'java', 'js',
  'kotlin', 'lua', 'ocaml', 'perl', 'php', 'py', 'rb', 'rust', 'scala',
  'swift', 'ts', 'zig',
]


function sdkTargets(): string[] {
  return readdirSync(TM, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => !NON_SDK_TARGETS.includes(n))
    .sort()
}


// The target's primary-utility test file, whatever the language calls it.
function primaryTestFile(lang: string): string | undefined {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = Path.join(dir, e.name)
      if (e.isDirectory()) {
        walk(p)
      }
      else if (/primary/i.test(e.name)) {
        // Search the WHOLE target tree, not just paths containing "test":
        // swift keeps its suite in Tests/ and perl in t/, so a path filter
        // silently classified both as having no primary-utility suite.
        found.push(p)
      }
    }
  }
  const root = Path.join(TM, lang)
  if (existsSync(root) && statSync(root).isDirectory()) {
    walk(root)
  }
  return found.sort()[0]
}


// Does the suite load the shared corpus, rather than only naming its sections?
const CORPUS_LOADERS =
  /test\.json|test_json|testJson|TEST_JSON|loadTestSpec|load_test_spec|LoadTestSpec|makeRunner|getSpec|resolveSpec/

// Tokens that look up a section IN the corpus, in each language's idiom.
// A section counts as driven only when its name appears on a line that also
// contains one of these — i.e. the name is being PASSED to the corpus lookup.
//
// A bare `src.includes(section)` is not enough and was actively misleading:
// every suite lists all 22 section names in its "these utilities exist"
// assertion, so ten FULL-tier targets passed while running preparePath through
// private hand-written contexts. That is the same "green while checking
// nothing" failure this file exists to catch, reproduced in the checker.
const SECTION_LOOKUP =
  /getSpec|get_spec|GetSpec|getspec|spec\.|spec\[|primary|runsection|runset|runSet|_runset|_g\(/


describe('cross-language corpus coverage', () => {

  test('the tier manifest covers every SDK target exactly once', () => {
    const declared = [...FULL, ...MIRRORED, ...UNCOVERED].sort()
    deepStrictEqual(declared, sdkTargets(),
      'a target was added or removed without deciding its parity tier — ' +
      'add it to FULL (drives the shared corpus), MIRRORED (hand-written ' +
      'mirror) or UNCOVERED in test/parity.test.ts')
    deepStrictEqual(declared, Array.from(new Set(declared)),
      'a target appears in more than one tier')
  })

  for (const lang of FULL) {
    test(`${lang}: drives every shared corpus section`, () => {
      const p = primaryTestFile(lang)
      ok(p, `${lang}: no primary-utility test file found under tm/${lang}`)
      const src = readFileSync(p!, 'utf8')

      ok(CORPUS_LOADERS.test(src),
        `${lang}: primary suite does not load the shared corpus (${p})`)

      const lines = src.split('\n')
      const missing = CORPUS_SECTIONS.filter((section) =>
        !lines.some((l) => l.includes(section) && SECTION_LOOKUP.test(l)))

      deepStrictEqual(missing, [],
        `${lang}: these sections are NAMED but never passed to the corpus ` +
        `lookup — the target runs its own hand-written cases for them, so ` +
        `nothing compares that behaviour against the reference`)
    })
  }

  for (const lang of MIRRORED) {
    test(`${lang}: still has a primary-utility suite (mirrored tier)`, () => {
      ok(primaryTestFile(lang),
        `${lang}: primary-utility suite disappeared — it was the only check ` +
        `on this target's request-shaping utilities`)
    })
  }

  test('UNCOVERED targets are genuinely uncovered (else promote them)', () => {
    const nowCovered = UNCOVERED.filter((l) => primaryTestFile(l))
    deepStrictEqual(nowCovered, [],
      'these targets gained a primary-utility suite — move them out of ' +
      'UNCOVERED in test/parity.test.ts (to FULL if it drives the corpus)')
  })
})


// GraphQL is a second TRANSPORT, not a second SDK surface: apidef emits
// `kind: 'graphql'` points carrying a precomputed document, and every target
// must branch on that kind in makeSpec and lift the top-level `errors` array
// in makeResponse. A target that ships the REST path only produces an SDK
// that silently posts REST-shaped requests at a GraphQL endpoint and reports
// server-side failures as success (GraphQL errors ride HTTP 200).
//
// Twelve of the twenty-three targets have no toolchain in CI, so a compile
// cannot catch a target left behind — this manifest can. It is a DRIFT guard,
// not a proof of correctness: it asserts each target still carries the four
// pieces of the transport, in whatever the language's idiom names them.
describe('graphql transport parity', () => {

  // Comment lines are stripped before matching, so a target cannot satisfy
  // the guard with the doc-comment every port copies from the reference.
  const COMMENT = /^\s*(\/\/|#|--|\*|;|\/\*|\(\*|"""|''')/

  function codeLines(lang: string): { file: string, lines: string[], src: string }[] {
    const out: { file: string, lines: string[], src: string }[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = Path.join(dir, e.name)
        if (e.isDirectory()) {
          if ('node_modules' !== e.name) {
            walk(p)
          }
        }
        else {
          const src = readFileSync(p, 'utf8')
          out.push({
            file: p,
            src,
            lines: src.split('\n').filter((l) => !COMMENT.test(l)),
          })
        }
      }
    }
    walk(Path.join(TM, lang))
    return out
  }

  for (const lang of sdkTargets()) {
    test(`${lang}: carries the graphql transport`, () => {
      const files = codeLines(lang)
      const anyLine = (re: RegExp) =>
        files.some((f) => f.lines.some((l) => re.test(l)))

      // The document/variables builder, wired into the makeSpec kind branch.
      ok(anyLine(/graphql[_.:-]?body/i),
        `${lang}: no graphql body builder — makeSpec cannot post a document`)

      // The failure lift, wired into makeResponse before transformResponse.
      ok(anyLine(/graphql[_.:-]?errors/i),
        `${lang}: no graphql error lift — a GraphQL failure under HTTP 200 ` +
        `would be reported to the caller as success`)

      // The transport's own error code, produced by the extensions mapping.
      const mapping = files.filter((f) => /request_graphql/.test(f.src))
      ok(0 < mapping.length,
        `${lang}: no request_graphql code — GraphQL failures cannot be told ` +
        `apart from HTTP ones by a caller switching on err.code`)

      // Variable binding, and the SDK-side `$action` discriminator stripped
      // before the input object is sent as a variable.
      ok(mapping.some((f) => /variables/.test(f.src) && /\$action/.test(f.src)),
        `${lang}: the graphql body builder does not bind variables and strip ` +
        `$action — command mutations would send the point discriminator`)

      // The kind branch overrides the content type on the same line it names
      // the transport, which is only true when the branch exists.
      ok(anyLine(/(?=.*content.?type)(?=.*graphql)/i),
        `${lang}: makeSpec does not set the graphql content type — the kind ` +
        `branch is missing`)
    })
  }
})


// The raw-access escape hatch — `direct()` for arbitrary HTTP, `graphql()`
// for arbitrary documents — reaches the API endpoint outside the operation
// surface, so it is operator-controllable like every entity op: both tokens
// are checked against allow.op before anything is sent. An ungated escape
// hatch makes allow.op advisory, since a caller denied `remove` can still
// DELETE through `direct`.
//
// Two targets ship no raw-access surface at all. They are listed rather than
// inferred, so adding `direct()` to one of them fails here until its gate
// lands with it.
const NO_RAW_ACCESS = ['haskell', 'lean']

describe('raw-access gate parity', () => {

  const COMMENT = /^\s*(\/\/|#|--|\*|;|\/\*|\(\*|"""|''')/

  // The gate spans both layers: the client method is a component fragment,
  // but clojure and ocaml keep the implementation in the template tree and
  // re-export it, so search the pair.
  function clientLines(lang: string): string[] {
    const out: string[] = []
    const walk = (dir: string) => {
      if (!existsSync(dir)) {
        return
      }
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = Path.join(dir, e.name)
        if (e.isDirectory()) {
          if ('node_modules' !== e.name) {
            walk(p)
          }
        }
        else {
          for (const l of readFileSync(p, 'utf8').split('\n')) {
            if (!COMMENT.test(l)) {
              out.push(l)
            }
          }
        }
      }
    }
    walk(Path.join(SDK, 'src', 'cmp', lang))
    walk(Path.join(TM, lang))
    return out
  }

  test('every SDK target declares whether it has raw access', () => {
    const declared = [...RAW_ACCESS, ...NO_RAW_ACCESS].sort()
    deepStrictEqual(declared, sdkTargets(),
      'a target was added or removed without deciding whether it exposes ' +
      'raw access — add it to RAW_ACCESS (and gate it) or NO_RAW_ACCESS')
  })

  test('targets without raw access really have none', () => {
    const nowRaw = NO_RAW_ACCESS.filter((lang) =>
      clientLines(lang).some((l) => /\bdirect\s*\(/.test(l)))
    deepStrictEqual(nowRaw, [],
      'these targets gained a direct() surface — move them to RAW_ACCESS ' +
      'and gate it on allow.op, or the SDK option becomes advisory')
  })

  for (const lang of RAW_ACCESS) {
    test(`${lang}: gates raw access on allow.op`, () => {
      const lines = clientLines(lang)
      const anyLine = (re: RegExp) => lines.some((l) => re.test(l))

      ok(anyLine(/operation not allowed by/),
        `${lang}: no allow.op denial — raw access cannot be turned off`)

      ok(anyLine(/(?=.*direct)(?=.*(allow|denied))/i),
        `${lang}: direct() is not gated on allow.op, so a caller denied an ` +
        `entity op can still reach the same endpoint through it`)

      ok(anyLine(/(?=.*graphql)(?=.*(allow|denied))/i),
        `${lang}: graphql() is not gated on allow.op`)

      // Both entry points must share one ungated inner path. A flag on
      // fetchargs instead would let a caller opt straight back out of the
      // gate by passing it.
      ok(anyLine(/raw[_-]?request/i),
        `${lang}: no shared raw-request path — direct() and graphql() have ` +
        `diverged, or one of them re-implements the gate`)
    })
  }
})


// The reference pair carries the behavioural feature suite and the typed-model
// assertions; everything else is checked against it. Guard the invariants that
// make "ts/js are the reference" true rather than aspirational.
describe('reference-target invariants', () => {

  test('ts and js are both FULL tier', () => {
    for (const lang of ['ts', 'js']) {
      ok(FULL.includes(lang), `${lang} must drive the shared corpus`)
    }
  })

  test('preparePath is a corpus section, not a per-language special case', () => {
    // It shipped as an empty `set: []` while go/py kept private hand-written
    // cases — the exact drift this suite exists to prevent.
    ok(CORPUS_SECTIONS.includes('preparePath'))
    const src = readFileSync(primaryTestFile('go')!, 'utf8')
    ok(/runsetNamed\(t, "preparePath"/.test(src),
      'go must drive preparePath from the corpus, not hand-written cases')
  })

  test('the go runner fails loudly on an empty or missing corpus section', () => {
    // It used to `return` silently, so a renamed section or a fixture that
    // compiled to an empty set reported PASS while running zero assertions.
    const runner = readFileSync(Path.join(TM, 'go', 'test', 'runner_test.go'), 'utf8')
    ok(/t\.Fatalf\(/.test(runner), 'runset must fail, not return')
    ok(/is EMPTY/.test(runner), 'runset must reject a zero-case section')
    ok(/pendingSections/.test(runner),
      'deliberately-empty sections must be declared, not inferred')
  })

  test('the ts primary suite guards zero-case sections too', () => {
    const src = readFileSync(primaryTestFile('ts')!, 'utf8')
    ok(/runsection\(/.test(src), 'sections must run through the guard wrapper')
    ok(/is EMPTY/.test(src), 'a zero-case section must fail')
  })
})


// The scaffold components (project/.sdk/src/cmp/**) are TypeScript that only
// ever compiles inside a CONSUMER project, so `tsc --build src test` never
// sees them: a missing import there is invisible here and fatal there (every
// generated SDK of that language fails to build). tsconfig.scaffold.json
// type-checks them against this package's own source; `npm run build` runs it.
//
// A source-level approximation was tried first and abandoned — the components
// EMIT target-language source, so identifiers like `cmap(`, `names(` and
// `template(` appear inside string literals and comments and cannot be told
// apart from real call sites by regex. Only a real compile is sound.
describe('scaffold components are type-checked', () => {

  test('the scaffold typecheck is wired into the build', () => {
    const pkg = JSON.parse(
      readFileSync(Path.resolve(__dirname, '..', 'package.json'), 'utf8'))
    ok(/check-scaffold/.test(pkg.scripts.build),
      'npm run build must type-check project/.sdk/src/cmp/**')
    ok(/tsconfig\.scaffold\.json/.test(pkg.scripts['check-scaffold'] || ''),
      'check-scaffold must run the scaffold tsconfig')
  })

  test('the scaffold tsconfig covers the components and skips fragments', () => {
    const cfg = JSON.parse(
      readFileSync(Path.resolve(__dirname, '..', 'tsconfig.scaffold.json'), 'utf8'))
    deepStrictEqual(cfg.include, ['project/.sdk/src/cmp/**/*.ts'])
    ok((cfg.exclude || []).some((e: string) => /fragment/.test(e)),
      'fragments are template source, not standalone modules')
    ok(cfg.compilerOptions?.paths?.['@voxgig/sdkgen'],
      'components must resolve @voxgig/sdkgen to this package source')
  })
})


// Identifiers that one component DECLARES and another REFERENCES must be
// derived in exactly one place. Two copies agree until one is fixed alone.
describe('go feature identifiers are derived once', () => {

  const GO = Path.join(TM, '..', 'src', 'cmp', 'go')

  test('Main_go and Config_go share goFeatureName', () => {
    // Main_go DECLARES New<F>FeatureFunc (registry.go + root init()); Config_go
    // REFERENCES it (makeFeature). Both used to hand-roll
    // `name.charAt(0).toUpperCase() + name.slice(1)` — consistently wrong for a
    // name needing real normalisation, but at least agreeing. Fixing Main_go
    // alone made `rate_limit` NewRateLimitFeatureFunc in the registry and
    // NewRate_limitFeatureFunc in config: an undefined identifier in the
    // generated Go, i.e. worse than the bug it replaced.
    for (const file of ['Main_go.ts', 'Config_go.ts']) {
      const src = readFileSync(Path.join(GO, file), 'utf8')
      ok(/goFeatureName\(/.test(src),
        `${file} must derive the feature identifier via goFeatureName`)
      ok(!/\bf?e?a?t?\.?name\.charAt\(0\)\.toUpperCase\(\)/.test(src) ||
        !/Feature(Func)?/.test(src.split('charAt(0).toUpperCase()')[0].slice(-200)),
        `${file} still hand-rolls a feature identifier`)
    }
  })

  test('goFeatureName normalises a multi-word feature name', () => {
    const { goFeatureName } = loadGoUtility()
    strictEqual(goFeatureName({ name: 'ratelimit' }), 'Ratelimit')
    // The cases that broke: hyphen and underscore must yield a LEGAL Go
    // identifier, identical on both sides.
    strictEqual(goFeatureName({ name: 'rate_limit' }), 'RateLimit')
    strictEqual(goFeatureName({ name: 'rate-limit' }), 'RateLimit')
  })
})


// utility_go.ts is scaffold source (only compiled in a consumer project), so
// load it the way entitytypes.test.ts loads emitters: transpile + shim.
function loadGoUtility(): any {
  const { transform } = require('sucrase')
  const sdkgen = require('../dist/sdkgen.js')
  const file = Path.resolve(
    __dirname, '..', 'project', '.sdk', 'src', 'cmp', 'go', 'utility_go.ts')
  const js = transform(readFileSync(file, 'utf8'),
    { transforms: ['typescript', 'imports'], filePath: file }).code
  const mod: any = { exports: {} }
  const req = (p: string) =>
    '@voxgig/sdkgen' === p ? sdkgen :
      '@voxgig/apidef' === p ? require('../dist/types.js') : require(p)
  // eslint-disable-next-line no-new-func
  new Function('exports', 'require', 'module', '__dirname', '__filename', js)(
    mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}
