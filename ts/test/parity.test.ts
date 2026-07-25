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
import { ok, deepStrictEqual } from 'node:assert'

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
  'cpp', 'csharp', 'dart', 'go', 'java', 'js', 'kotlin', 'lua', 'perl', 'php',
  'py', 'rb', 'rust', 'swift', 'ts',
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

      const missing = CORPUS_SECTIONS.filter((s) => !src.includes(s))
      deepStrictEqual(missing, [],
        `${lang}: corpus sections not exercised — a section a target skips is ` +
        `a behaviour no test compares against the reference`)
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
