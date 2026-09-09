// Cross-language parity coverage, made VISIBLE and enforced.
//
// The value of sdkgen is that every target behaves identically, and the
// mechanism for proving that is the shared test corpus: language-neutral
// `.aon` fixtures (create-sdkgen project/standard/.sdk/test/primary/) that
// compile to a test.json each target's own suite executes. A target whose
// suite does NOT drive that corpus is only ever checked against
// hand-written cases it wrote for itself, so it can drift from the reference
// without anything failing.
//
// Before this file, the only cross-language test asserted file EXISTENCE
// (featuremodel.test.ts), so the coverage tiers below were invisible: you had
// to grep the template tree to discover that five targets mirrored the corpus
// by hand and four had no primary-utility suite at all.
//
// Those gaps are now CLOSED: every target drives the corpus, and MIRRORED and
// UNCOVERED are empty. Driving it is what found the defects — the same
// prepare_method "GET" catch-all in six independent ports, among others.
// The manifest stays as the stated policy: a target that loses its
// corpus-driven suite, or a new target added without a decision about its
// tier, fails here. Adding a name to MIRRORED or UNCOVERED is a deliberate
// regression and should be argued for in the commit that does it.

import { test, describe } from 'node:test'
import { ok, deepStrictEqual, strictEqual } from 'node:assert'

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import Path from 'node:path'


const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')
const TM = Path.join(SDK, 'tm')


// The 22 corpus sections every FULL-tier target must execute. Kept explicit
// (rather than read from the sibling create-sdkgen checkout, which is not
// guaranteed to be present) so this suite is self-contained.
//
// NOT the whole corpus. `clean` and the deferred sections are excluded, and
// so is `makePoint` — it was promoted from deferred to seven real cases, but
// only ts and go drive it so far. Adding it here makes it mandatory for all
// 16 FULL targets at once, which is the work to do next, one target at a
// time: each needs its context builder to honour a fixture-supplied
// `options` and `config` (lean's overwrites both, which is why lean does not
// drive this section yet).
const CORPUS_SECTIONS = [
  'done', 'makeContext', 'makeError', 'makeOptions', 'makeRequest',
  'makeResponse', 'makeSpec', 'makeUrl', 'operator', 'param', 'prepareAuth',
  'prepareBody', 'prepareHeaders', 'prepareMethod', 'prepareParams',
  'preparePath', 'prepareQuery', 'resultBasic', 'resultBody', 'resultHeaders',
  'transformRequest', 'transformResponse',
]


// Targets that are not language SDKs: they CONSUME another target's SDK
// (go-cli/go-mcp consume `go`; py-data consumes `py`) and switch the standard
// generation phases off, so they have no primary-utility surface of their own.
// Their own behaviour is covered by their generated tests, not by the
// cross-language corpus.
//
// `seneca-provider` was the fourth and has MOVED to
// packages/sdkgen-seneca-provider, where its manifest declares
// `parity: CONSUMER` — the same statement this list makes, in the only place
// an external package can make it. It went first among the four because every
// bundled LANGUAGE target is now FULL tier, and a FULL-tier target that
// migrates is silently capped until the corpus is published; a target in no
// tier set has no tier to cap.
const NON_SDK_TARGETS = ['go-cli', 'go-mcp', 'py-data']


// TIER 1 — drives the shared corpus for every section. This is the bar.
const FULL = [
  'cpp', 'csharp', 'go', 'java', 'js', 'kotlin', 'lua', 'ocaml',
  'perl', 'php', 'py', 'rb', 'rust', 'swift', 'ts', 'zig', 'clojure',
  'elixir', 'c', 'scala',
]

// TIER 2 — has a primary-utility suite, but it MIRRORS the corpus by hand
// instead of executing it, so the cases can drift from the reference. EMPTY:
// c and elixir were the last two and both now execute the corpus. A target
// here is checked only against cases it wrote for itself.
const MIRRORED: string[] = []

// TIER 3 — no primary-utility suite at all, leaving the request-shaping
// utilities unverified in every language-neutral sense. EMPTY: scala was the
// last one.
const UNCOVERED: string[] = []


// Targets exposing the raw-access escape hatch (direct/graphql). See the
// 'raw-access gate parity' suite below.
const RAW_ACCESS = [
  'c', 'clojure', 'cpp', 'csharp', 'elixir', 'go', 'java',
  'js', 'kotlin', 'lua', 'ocaml', 'perl', 'php', 'py', 'rb', 'rust', 'scala',
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


// The suite plus any corpus-harness file in the same target tree. A target may
// legitimately split "drive the sections" from "run the assertions".
function corpusSources(lang: string): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = Path.join(dir, e.name)
      if (e.isDirectory()) {
        walk(p)
      }
      else if (/primary/i.test(e.name) || /corpus/i.test(e.name)) {
        found.push(p)
      }
    }
  }
  const root = Path.join(TM, lang)
  if (existsSync(root) && statSync(root).isDirectory()) {
    walk(root)
  }
  return found.sort()
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
//
// `_sec(` is dart's: closing the empty-section hole meant wrapping
// `_runset(_g('x.basic'), fn)` in a helper that asserts the section is
// non-empty first, so the lookup now happens one level in. The token has to
// name the wrapper, or a target gets punished for adding a guard.
const SECTION_LOOKUP =
  /getSpec|get_spec|GetSpec|getspec|spec\.|spec\[|primary|runsection|runset|runSet|_runset|_g\(|_sec\(/


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

      // Read the suite AND any corpus-harness file beside it: elixir keeps its
      // section drivers in test/support/struct_corpus.ex and the *_test.exs is
      // a three-line delegate, so scanning one file called the target's 22
      // sections missing when every one of them runs.
      const src = corpusSources(lang).map((f) => readFileSync(f, 'utf8')).join('\n')

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

  // Paging is a separate hook and drifted separately: the kind branch clears
  // spec.query, so a REST-only paging feature writes cursor/limit into a
  // query string that is then discarded, and reads only top-level body
  // cursors — so a Relay connection stops after page one.
  //
  // EMPTY: `lean` was the only exemption — its paging feature stamps
  // size/page and counts pages, with no cursor pagination, Link header or
  // hasMore for REST — and it has moved to @voxgig/sdkgen-langpack. Every
  // bundled target now mirrors the cursor branch.
  const NO_CURSOR_PAGING: string[] = []

  for (const lang of sdkTargets()) {
    if (NO_CURSOR_PAGING.includes(lang)) {
      continue
    }

    test(`${lang}: paginates graphql through operation variables`, () => {
      const files = codeLines(lang)
      const anyLine = (re: RegExp) =>
        files.some((f) => f.lines.some((l) => re.test(l)))

      ok(anyLine(/after[_-]?var/i) && anyLine(/first[_-]?var/i),
        `${lang}: the paging hook does not bind the after/first operation ` +
        `variables — the cursor goes into a query string the graphql kind ` +
        `branch has already cleared, so auto-pagination never advances`)

      ok(anyLine(/connpath/i),
        `${lang}: the paging hook does not read the model's relay page ` +
        `descriptor, so pageInfo.endCursor is never found and a connection ` +
        `stops after the first page`)

      ok(anyLine(/explicit[_-]?more/i),
        `${lang}: hasMore is inferred from cursor presence alone — a final ` +
        `relay page carries both an end cursor and hasNextPage false, so ` +
        `the caller is sent back for a page that does not exist, forever`)
    })
  }

  test('the cursor-paging exemption list is still accurate', () => {
    const stillExempt = NO_CURSOR_PAGING.filter((lang) =>
      !codeLines(lang).some((f) => f.lines.some((l) => /hasMore/.test(l))))
    deepStrictEqual(stillExempt, NO_CURSOR_PAGING,
      'a target listed as having no cursor paging gained a hasMore signal — ' +
      'give it the graphql paging branches and drop it from NO_CURSOR_PAGING')
  })
})


// The raw-access escape hatch — `direct()` for arbitrary HTTP, `graphql()`
// for arbitrary documents — reaches the API endpoint outside the operation
// surface, so it is operator-controllable like every entity op: both tokens
// are checked against allow.op before anything is sent. An ungated escape
// hatch makes allow.op advisory, since a caller denied `remove` can still
// DELETE through `direct`.
//
// One target ships no raw-access surface at all. It is listed rather than
// inferred, so adding `direct` to it fails here until its gate lands with it.
// EMPTY, and that is a statement rather than an oversight: `lean` was the
// only entry, and it has moved to @voxgig/sdkgen-langpack. Every bundled
// target now exposes the raw-access escape hatch, so the closed-set check
// below asserts RAW_ACCESS alone covers the shipped list.
const NO_RAW_ACCESS: string[] = []

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
    // Search the TEMPLATE tree only: the component tree carries `direct(`
    // inside README and test string literals, which are not a surface.
    // Match a call OR an ML-style signature. Found on haskell (now
    // @voxgig/sdkgen-haskell), which declares
    // `direct :: Client -> Value -> IO Value` with no paren anywhere, so a
    // call-syntax regex silently cleared a target whose escape hatch was wide
    // open. The shape still matters here: ocaml is ML-style too.
    const nowRaw = NO_RAW_ACCESS.filter((lang) => {
      const dir = Path.join(TM, lang)
      const hits: string[] = []
      const walk = (d: string) => {
        if (!existsSync(d)) {
          return
        }
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const p = Path.join(d, e.name)
          if (e.isDirectory()) {
            walk(p)
          }
          else {
            for (const l of readFileSync(p, 'utf8').split('\n')) {
              if (!COMMENT.test(l) && /(^|[^A-Za-z0-9_])(sdk_)?[Dd]irect\s*(\(|::)/.test(l)) {
                hits.push(l)
              }
            }
          }
        }
      }
      walk(dir)
      return 0 < hits.length
    })
    deepStrictEqual(nowRaw, [],
      'these targets gained a direct surface — move them to RAW_ACCESS ' +
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
    ok(/runsection\(t, "preparePath"/.test(src),
      'go must drive preparePath from the corpus, not hand-written cases')
  })

  test('the go runner fails loudly on an empty or missing corpus section', () => {
    // It used to `return` silently, so a renamed section or a fixture that
    // compiled to an empty set reported PASS while running zero assertions.
    const runner = readFileSync(Path.join(TM, 'go', 'test', 'primary_utility_test.go'), 'utf8')
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
// A target whose config is a process-wide singleton MUST clone the config
// side before merging client options into it. `merge([{}, cfgopts, opts])`
// uses cfgopts' nested maps as merge TARGETS, so without the clone the first
// client's options (headers, server, ...) are written into the shared config
// and inherited by every client constructed afterwards.
//
// ts/js carried this guard from the day their config became a module
// singleton. go/py/rb/lua only became singletons when L2 landed, and the
// omission was a silent cross-client data leak until then.
const CLONES_CFGOPTS = [
  'c', 'cpp', 'csharp', 'elixir', 'go', 'java', 'js', 'kotlin', 'lua', 'perl',
  'py', 'rb', 'rust', 'scala', 'swift', 'ts', 'zig',
]

// php needs no clone: its arrays are copy-on-write value types, so merge
// cannot reach the shared config through them.
const CFGOPTS_VALUE_SEMANTICS = ['php']


// The target's make_options template, whatever the language calls it.
function makeOptionsFile(lang: string): string | undefined {
  const found: string[] = []
  const byContent: string[] = []
  const walk = (dir: string) => {
    if (!existsSync(dir)) {
      return
    }
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = Path.join(dir, e.name)
      if (e.isDirectory()) {
        walk(p)
      }
      else if (/make_?options/i.test(e.name)) {
        found.push(p)
      }
      // Not every target names the file for the function: cpp keeps
      // make_options in utility/pipeline.hpp, scala in utility/Make.scala and
      // elixir in lib/<name>/utility.ex. A name match alone silently reported
      // "no make_options template" and skipped the clone check entirely, so
      // fall back to whichever file actually mentions cfgopts.
      else if (/\.(hpp|scala|ex|zig|rs|ml|hs|clj)$/.test(e.name) &&
        /cfgopts/.test(readFileSync(p, 'utf8'))) {
        byContent.push(p)
      }
    }
  }
  walk(Path.join(TM, lang))
  return found.sort()[0] ?? byContent.sort()[0]
}


// Does this target emit a shared/singleton config accessor?
function sharesConfig(lang: string): boolean {
  const cmp = Path.join(TM, '..', 'src', 'cmp', lang)
  if (!existsSync(cmp)) {
    return false
  }
  for (const e of readdirSync(cmp)) {
    if (!/^Config_/.test(e)) {
      continue
    }
    const src = readFileSync(Path.join(cmp, e), 'utf8')
    // Three spellings across the fleet: shared_config (go/py/rb/lua/rust/zig/
    // elixir/c/perl), SharedConfig (csharp), sharedConfig (cpp/java/kotlin/
    // scala/swift).
    if (/shared_config|SharedConfig|sharedConfig|config_shared/.test(src)) {
      return true
    }
  }
  // ts/js hold the singleton in a fragment, not the Config component.
  const frag = Path.join(cmp, 'fragment', 'Config.fragment.' + ('ts' === lang ? 'ts' : 'js'))
  return existsSync(frag) && /const config = new Config\(\)/.test(readFileSync(frag, 'utf8'))
}


describe('shared config cannot leak across clients', () => {

  test('every target that shares its config has declared how it stays safe', () => {
    const declared = [...CLONES_CFGOPTS, ...CFGOPTS_VALUE_SEMANTICS].sort()
    const sharing = sdkTargets().filter(sharesConfig).sort()
    deepStrictEqual(sharing, declared,
      'a target started (or stopped) sharing its config without deciding how ' +
      'client options stay isolated — add it to CLONES_CFGOPTS (and clone ' +
      'cfgopts before the merge) or to CFGOPTS_VALUE_SEMANTICS')
  })

  test('targets that share a config clone cfgopts before merging', () => {
    for (const lang of CLONES_CFGOPTS) {
      const file = makeOptionsFile(lang)
      ok(undefined !== file, `${lang}: no make_options template found`)
      const src = readFileSync(file as string, 'utf8')

      // cfgopts must reach the merge THROUGH a clone. Matched across the
      // whole file rather than on one line: csharp, java, kotlin and scala
      // build the merge list over several lines, so a single-line match
      // reported "no line merges cfgopts" and silently checked nothing.
      //
      // The window is deliberately tight, so `clone` and `cfgopts` have to be
      // part of one expression - Clone(cfgopts), clone(&cfgopts),
      // voxgig_clone(cfgopts), clone(.map(cfgopts)), clone($cfgopts).
      ok(/clone[^\n]{0,24}cfgopts/i.test(src),
        `${lang}: make_options merges the SHARED config without cloning it. ` +
        'One client\'s options will contaminate every client built after it.')

      // ...and no single-line merge may pass it bare, which is the shape the
      // original guard caught and must keep catching.
      const bare = src.split('\n').find(
        (l) => /merge/i.test(l) && /cfgopts/i.test(l) && !/clone/i.test(l))
      ok(undefined === bare,
        `${lang}: this line merges the SHARED config without cloning it:\n` +
        `  ${(bare as string || '').trim()}`)
    }
  })
})


// clean() strips emission-only noise from the model before it is written into
// a generated config. It was broken from the day it was written and nothing
// noticed: it walked a clone calling `delete p[k]`, but walk() assigns its
// callback's result back over the child, so every delete was undone on the way
// out. Returning `undefined` instead is NOT the fix either — setprop stores
// undefined rather than removing the key, and it emits as a null.
//
// These assert the OUTPUT, not the mechanism, so any future rewrite is free as
// long as the keys actually go away.
describe('clean() removes what it claims to remove', () => {

  const subject = () => ({
    keep: 'yes',
    'index$': 0,
    'key$': 'k',
    'val$': 'v',
    active: true,
    req: false,
    reqd: false,
    inactive: { active: false, reqd: true, req: '`reqdata`' },
    list: [{ name: 'a', 'index$': 0, active: true }, { name: 'b', 'index$': 1 }],
  })

  test('$-suffixed keys are gone, not nulled', () => {
    const { clean } = loadGoUtility()
    const out = clean(subject())

    for (const k of ['index$', 'key$', 'val$']) {
      ok(!(k in out), `${k} survived clean()`)
    }
    ok(!('index$' in out.list[0]), 'index$ survived inside a list element')
    // The failure mode that looks like success: key present, value undefined.
    // JSON.stringify hides it, so assert on the keys themselves.
    for (const k of Object.keys(out)) {
      ok(undefined !== out[k], `${k} was left undefined rather than removed`)
    }
    strictEqual(out.keep, 'yes')
  })

  test('defaults are dropped only when asked, and only on their own value', () => {
    const { clean } = loadGoUtility()

    const asis = clean(subject())
    strictEqual(asis.active, true, 'active:true must survive without dropDefaults')
    strictEqual(asis.req, false, 'req:false must survive without dropDefaults')

    const dropped = clean(subject(), true)
    ok(!('active' in dropped), 'active:true should be dropped')
    ok(!('req' in dropped), 'req:false should be dropped')
    ok(!('reqd' in dropped), 'reqd:false should be dropped')

    // Only the DEFAULT value goes. The opposite value is meaningful and stays.
    strictEqual(dropped.inactive.active, false, 'active:false is meaningful')
    strictEqual(dropped.inactive.reqd, true, 'reqd:true is load-bearing (Select)')
    // `req` is also a transform spec, not only a boolean flag.
    strictEqual(dropped.inactive.req, '`reqdata`', 'req as a string must survive')
  })

  test('every target asks for default-dropping on its entity subtree', () => {
    // The helper doing the right thing is only half of it — each Config
    // component has to PASS dropDefaults at the entity call site. Two targets
    // (perl, swift) name the entity `ent` rather than `n` and were silently
    // missed by a sweep that assumed one spelling.
    const CMP = Path.join(TM, '..', 'src', 'cmp')
    const missing: string[] = []
    for (const lang of sdkTargets()) {
      const file = Path.join(CMP, lang, `Config_${lang}.ts`)
      if (!existsSync(file)) continue
      const src = readFileSync(file, 'utf8')
      // The entity subtree is the call that carries fields/op/relations.
      if (!/relations:\s*\w+\.relations/.test(src)) continue
      if (!/relations:\s*\w+\.relations,\s*\n\s*\},\s*true\)/.test(src)) {
        missing.push(lang)
      }
    }
    deepStrictEqual(missing, [],
      'these emit the entity subtree without dropping default-valued keys')
  })

  test('no typed Point reader defaults active to false', () => {
    // Emission drops `active: true` as a default, so a reader that defaults a
    // missing `active` to FALSE reports every active point as inactive. Eight
    // targets model a Point this way — java, kotlin, swift and csharp were the
    // obvious ones; dart, c, scala and zig were missed on the first pass and
    // caught in review. Scan rather than list, so target nine is caught too.
    const wrong: string[] = []
    for (const lang of sdkTargets()) {
      const root = Path.join(TM, lang)
      if (!existsSync(root)) continue
      const walk = (d: string) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const p = Path.join(d, e.name)
          if (e.isDirectory()) {
            walk(p)
          }
          else if (/point/i.test(e.name)) {
            const src = readFileSync(p, 'utf8')
            // `active` given an explicit false default, in any of the shapes
            // the ports use: a field initialiser or a getprop fallback.
            if (/active[^A-Za-z0-9_\n]{0,24}=\s*false/i.test(src) ||
              /["']active["']\s*,\s*false/i.test(src) ||
              /get_bool\([^)]*"active"[^)]*\)[\s\S]{0,40}=\s*false/i.test(src)) {
              wrong.push(`${lang}/${e.name}`)
            }
          }
        }
      }
      walk(root)
    }
    deepStrictEqual(wrong, [],
      'these read a missing `active` as INACTIVE, but emission drops active:true')
  })

  test('metadata removal is by known key, not by $ suffix', () => {
    // A trailing `$` is not exclusive to jostraca — Seneca uses `entity$` as
    // real data — so a blanket suffix match would silently drop a legitimate
    // API field from the emitted config.
    const { clean } = loadGoUtility()
    const out = clean({ 'index$': 1, 'key$': 'k', 'val$': 'v', 'entity$': 'zed', keep: 1 })
    ok(!('index$' in out) && !('key$' in out) && !('val$' in out))
    strictEqual(out['entity$'], 'zed', 'a real $-suffixed API field must survive')
  })

  test('default pruning stops at payload subtrees', () => {
    // `active: true` inside an OpenAPI example is DATA, not a default.
    const { clean } = loadGoUtility()
    const out = clean({
      active: true,
      example: { active: true, req: false, nested: { reqd: false } },
      fields: [{ active: true, example: { active: true } }],
    }, true)
    ok(!('active' in out), 'the schema flag is still pruned')
    strictEqual(out.example.active, true, 'payload active must survive')
    strictEqual(out.example.req, false, 'payload req must survive')
    strictEqual(out.example.nested.reqd, false, 'payload reqd must survive at depth')
    ok(!('active' in out.fields[0]), 'flags inside fields are still pruned')
    strictEqual(out.fields[0].example.active, true, 'payload under a field survives')
  })

  test('every target strips $-keys, so no config ships jostraca metadata', () => {
    // Cheap structural check across the other 22: the helper must not be the
    // old delete-during-walk shape.
    const CMP = Path.join(TM, '..', 'src', 'cmp')
    const stale: string[] = []
    for (const lang of sdkTargets()) {
      const dir = Path.join(CMP, lang)
      if (!existsSync(dir)) continue
      for (const e of readdirSync(dir)) {
        if (!/^utility_|^Main_/.test(e)) continue
        const src = readFileSync(Path.join(dir, e), 'utf8')
        if (/function (clean|cleanModel)\b/.test(src) && /delete p\[k\]\s*$/m.test(src)) {
          stale.push(`${lang}/${e}`)
        }
      }
    }
    deepStrictEqual(stale, [], 'these still delete-during-walk, which does nothing')
  })
})


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


// The config representation is chosen by size (design rung L1, threshold from
// design Q7). Both branches must exist and the choice must be by the MODEL,
// not by the emitted source - which varies per language while the model does
// not.
describe('config representation is chosen by size', () => {

  test('the threshold is the decided 256 KB', () => {
    const { CONFIG_DATA_THRESHOLD, isConfigData, configRepr } =
      require('../dist/sdkgen.js')
    strictEqual(CONFIG_DATA_THRESHOLD, 256 * 1024)
    // Boundary: at the threshold it is still a literal; one byte over is data.
    strictEqual(isConfigData('x'.repeat(CONFIG_DATA_THRESHOLD)), false)
    strictEqual(isConfigData('x'.repeat(CONFIG_DATA_THRESHOLD + 1)), true)
    strictEqual(configRepr('x'), 'literal')
    strictEqual(configRepr('x'.repeat(CONFIG_DATA_THRESHOLD + 1)), 'data')
  })

  test('the threshold counts UTF-8 bytes, not UTF-16 code units', () => {
    const { CONFIG_DATA_THRESHOLD, isConfigData } = require('../dist/sdkgen.js')
    // A CJK character is 3 bytes but ONE UTF-16 code unit, so a `.length`
    // comparison reads a multilingual model as a third of its real size and
    // keeps it on the expensive literal path well past the point it hurts.
    const cjk = '\u4e16'.repeat(Math.ceil((CONFIG_DATA_THRESHOLD + 3) / 3))
    strictEqual(cjk.length < CONFIG_DATA_THRESHOLD, true, 'fixture proves nothing')
    strictEqual(isConfigData(cjk), true, 'threshold measured in code units')
  })

  // An ABSENT optional member must not become a key in either representation.
  //
  // Callers build `{fields, name, op, relations}` from an entity, and `op` is
  // optional - so the key exists with value undefined. JSON.stringify omits
  // such a key while the py/rb/php literal formatters emit None/nil/null, so
  // an entity with no `op` would describe a DIFFERENT config depending on
  // which side of the threshold it fell. The equivalence tests missed it
  // because every entity in the fixture has an `op`.
  test('clean drops an absent optional member rather than carrying undefined', () => {
    const { clean } = require('../dist/sdkgen.js')
    const out = clean({ fields: [{ name: 'a' }], name: 'x', op: undefined }, true)
    deepStrictEqual(Object.keys(out), ['fields', 'name'],
      'an undefined-valued key survived clean, so the literal and the data ' +
      'representations disagree about whether it exists')
    strictEqual(Object.prototype.hasOwnProperty.call(out, 'op'), false)

    // A real null is DATA, not absence, and must survive.
    const kept = clean({ name: 'x', note: null }, true)
    strictEqual(Object.prototype.hasOwnProperty.call(kept, 'note'), true)
    strictEqual(kept.note, null)
  })


  test('an unknown repr is rejected, not silently treated as auto', () => {
    const { isConfigData, CONFIG_REPR_VALUES } = require('../dist/sdkgen.js')
    deepStrictEqual(CONFIG_REPR_VALUES, ['auto', 'data', 'literal'])
    for (const good of CONFIG_REPR_VALUES) {
      isConfigData('x', good)
    }
    let threw = false
    try {
      isConfigData('x', 'date')
    }
    catch (e: any) {
      threw = /must be one of/.test(String(e.message))
    }
    strictEqual(threw, true,
      'a typo falls through to auto, quietly restoring the compile cost')
  })

  // Targets that have been through rung L1, and the marker of each branch in
  // their Config component. Adding a target here is how L1 rollout is tracked:
  // the remaining Config-emitting targets are literal-only and are NOT listed.
  const L1_TARGETS: [string, string, string, string][] = [
    ['go', 'Config_go.ts', 'const configJSON = ', 'map\\[string\\]any\\{'],
    ['ts', 'Config_ts.ts', 'Config\\.data\\.fragment\\.ts', 'Config\\.fragment\\.ts'],
    ['js', 'Config_js.ts', 'Config\\.data\\.fragment\\.js', 'Config\\.fragment\\.js'],
    ['py', 'Config_py.ts', 'json\\.loads\\(_CONFIG_DATA\\)', 'formatPyDict'],
    ['rb', 'Config_rb.ts', 'JSON\\.parse\\(CONFIG_DATA\\)', 'formatRubyHash'],
    ['php', 'Config_php.ts', 'json_decode\\(self::CONFIG_DATA\\)', 'formatPhpArray'],
    ['lua', 'Config_lua.ts', 'json\\.decode\\(CONFIG_DATA\\)', 'formatLuaTable'],
    ['c', 'Config_c.ts', 'cStringLiteral\\(configJson\\)', 'formatCValue'],
    ['rust', 'Config_rust.ts', 'rustRawString\\(configJson\\)', 'formatRustValue'],
    ['zig', 'Config_zig.ts', 'CONFIG_DATA: \\[\\]const u8', 'formatZigValue'],
    ['elixir', 'Config_elixir.ts', '@config_data', 'Helpers\\.deep'],
    ['clojure', 'Config_clojure.ts', 'core/json-parse', 'formatCljValue'],
    ['ocaml', 'Config_ocaml.ts', 'Sdk_json\\.json_read', 'formatOcamlValue'],
    ['csharp', 'Config_csharp.ts', 'JsonSerializer\\.Deserialize', 'formatCsMap'],
  ]

  // The clojure data constant must be CHUNKED under the JVM limit.
  //
  // A Clojure string literal becomes a constant-pool UTF-8 entry, capped at
  // 65,535 bytes — so one constant cannot hold a config large enough to select
  // the data representation at all (the threshold is 256 KB). The failure is
  // AOT-only, which is why nothing here caught it: loading from source is fine
  // and `clojure -M:test-compile` only requires. Compiling a 70,000-character
  // literal gives:
  //
  //   Execution error (IllegalArgumentException)
  //     at clojure.asm.ByteVector/putUTF8 (ByteVector.java:245)
  //
  // java/kotlin/scala already chunk for the same reason.
  test('clojure: the data constant is chunked under the JVM 64KB limit', () => {
    const { cljStringChunks } = require(
      Path.join(SDK, '..', '..', 'dist-test-scaffold', '.sdk', 'dist',
        'cmp', 'clojure', 'utility_clojure.js'))

    const big = 'y'.repeat(200000)
    const chunks = cljStringChunks(big)
    ok(1 < chunks.length, 'a 200 KB payload was not chunked at all')
    for (const c of chunks) {
      ok(Buffer.byteLength(c, 'utf8') < 65535,
        'a chunk exceeds the JVM constant-pool limit')
    }
    strictEqual(chunks.join(''), big, 'chunking lost or reordered content')

    // Multi-byte characters are measured in BYTES, and a surrogate pair is
    // never cut in half - a lone surrogate would be invalid UTF-8.
    const astral = '\u{1F600}'.repeat(20000)
    const acs = cljStringChunks(astral)
    strictEqual(acs.join(''), astral, 'chunking corrupted astral characters')
    for (const c of acs) {
      ok(Buffer.byteLength(c, 'utf8') < 65535, 'an astral chunk is over the limit')
      ok(!/[\uD800-\uDBFF]$/.test(c), 'a chunk ends on a lone high surrogate')
    }
  })


  // The csharp literal's BOXED NUMERIC TYPE must match what parsing the JSON
  // produces, because boxed numerics compare by exact type - (object)5L does
  // not Equals (object)5 - and MakeConfig is public API consumers read numbers
  // out of.
  //
  // Unsuffixed C# integer literals take the first of int/uint/long/ulong that
  // fits, so `3000000000` used to box as a uint nothing else in the SDK ever
  // produces, while the JSON side gave a long. Verified by compiling both
  // forms under .NET 8: before this, every whole number disagreed.
  test('csharp: the literal number ladder matches the JSON parser', () => {
    const { formatCsMap } = require(
      Path.join(SDK, '..', '..', 'dist-test-scaffold', '.sdk', 'dist',
        'cmp', 'csharp', 'utility_csharp.js'))

    // [value, expected C# literal] - the ladder ConfigValue mirrors with
    // TryGetInt32 / TryGetInt64 / GetDouble.
    const cases: [number, string][] = [
      [0, '0'],
      [5, '5'],
      [-5, '-5'],
      [2147483647, '2147483647'],
      [-2147483648, 'int.MinValue'],
      [2147483648, '2147483648L'],
      [3000000000, '3000000000L'],
      [5000000000, '5000000000L'],
      [1e20, '100000000000000000000D'],
      [1e21, '1e+21D'],
      [1.5, '1.5D'],
      [-0.25, '-0.25D'],
      // THE LOWER BOUNDARY, and the reason the range test is on the emitted
      // text rather than the JS value. `String(-9223372036854775808)` is
      // "-9223372036854776000", which is BELOW long.MinValue - TryGetInt64
      // refuses it, so the data branch gives a double and the literal has to
      // as well. Emitting `long.MinValue` here made the two disagree at
      // exactly this value (verified: literal=Int64 data=Double).
      [-9223372036854775808, '-9223372036854776000D'],
    ]
    for (const [val, expected] of cases) {
      strictEqual(formatCsMap({ n: val }, 0).replace(/[\s\S]*\["n"\] = /, '')
        .replace(/,[\s\S]*/, ''), expected, 'csharp literal for ' + val)
    }

    // long.MaxValue is not representable as a JS number - it rounds up to
    // 2^63, which the C# compiler rejects as a long and TryGetInt64 also
    // refuses - so both sides must fall to double there. (JS renders that
    // value as 9223372036854776000; the point is the D, not the digits.)
    strictEqual(formatCsMap({ n: 9223372036854775808 }, 0)
      .replace(/[\s\S]*\["n"\] = /, '').replace(/,[\s\S]*/, ''),
      '9223372036854776000D',
      'a value at 2^63 must be a double, not an out-of-range long literal')
  })


  // C# forbids its NEW-LINE CHARACTERS inside a regular quoted string, and
  // that set is wider than the two everyone escapes: U+000D, U+000A, U+0085
  // (NEL), U+2028 (LINE SEPARATOR), U+2029 (PARAGRAPH SEPARATOR).
  //
  // JSON.stringify leaves the last three RAW - they are ordinary characters in
  // JSON and in every other target language - so a model string carrying one
  // (an OpenAPI description or example pasted from a word processor) emitted a
  // C# file that would not compile. Confirmed against .NET 8:
  // `error CS1010: Newline in constant`. Both the data blob and the literal's
  // own strings go through the escape.
  test('csharp: C# line terminators are escaped in both branches', () => {
    const { csStringLiteral, formatCsString, formatCsMap } = require(
      Path.join(SDK, '..', '..', 'dist-test-scaffold', '.sdk', 'dist',
        'cmp', 'csharp', 'utility_csharp.js'))

    // Built from char codes rather than written literally: U+2028/U+2029 end
    // a line in JavaScript too, so having them verbatim in this source is the
    // very hazard under test.
    const raw = String.fromCharCode(0x85, 0x2028, 0x2029)
    for (const [what, out] of [
      ['csStringLiteral', csStringLiteral(JSON.stringify({ d: raw }))],
      ['formatCsString', formatCsString(raw)],
      ['formatCsMap', formatCsMap({ d: raw }, 0)],
    ] as [string, string][]) {
      for (const ch of raw) {
        ok(!out.includes(ch),
          what + ' emitted a raw U+' +
          (ch.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, '0') +
          ', which ends a C# string literal')
      }
      ok(/\\u0085/.test(out) && /\\u2028/.test(out) && /\\u2029/.test(out),
        what + ' did not escape all three C# line terminators')
    }
  })



  // Every target whose generated config can carry `options.server` must also
  // ACCEPT it in the option spec `make_options` validates against.
  //
  // These are not independent: rendering options from the canonical definition
  // is what put `server` into the config, and a target that emits a key its own
  // validator rejects fails at client construction. elixir demonstrated it -
  // 75 of its 151 generated tests failed with
  // `Unexpected keys at field <root>: server` - and the same gap is open in a
  // dozen targets that do not emit `server` yet.
  const SERVER_OPTSPEC: [string, string][] = [
    ['ts', 'src/utility/MakeOptionsUtility.ts'],
    ['js', 'src/utility/MakeOptionsUtility.js'],
    ['lua', 'utility/make_options.lua'],
    ['go', 'utility/make_options.go'],
    ['py', 'pkg/utility/make_options.py'],
    ['rb', 'utility/make_options.rb'],
    ['rust', 'utility/make_options.rs'],
    ['zig', 'core/utility.zig'],
    ['elixir', 'lib/projectname/utility.ex'],
    ['clojure', 'src/sdk/core.clj'],
    ['ocaml', 'sdk_runtime.ml'],
    ['csharp', 'utility/MakeOptions.cs'],
  ]

  for (const [target, file] of SERVER_OPTSPEC) {
    test(target + ': the option spec accepts options.server', () => {
      const path = Path.join(TM, target, file)
      ok(existsSync(path), target + ': no ' + file)
      const src = readFileSync(path, 'utf8')
      // Quoted ("server" / 'server' / :server) or a bare object/table key
      // (`server:` in ts/js, `server =` in lua) — the optspec is written in
      // each language's own literal syntax.
      ok(/["'`:]server["'`]|(^|[\s{,])server\s*[:=]/m.test(src),
        target + ': make_options does not accept `server`, so a spec with a ' +
        'templated server URL fails validation at client construction')
    })

    // ACCEPTING the option is not the same as HONOURING it, and the weaker
    // check above is what let the two drift apart: seven targets took a
    // `server` map and then sent every request to a URL still containing a
    // literal `{tenant}`. Accepting an option the runtime ignores is worse
    // than rejecting it — the SDK looks configured and silently misbehaves.
    //
    // The `test-<name>` fallback is the marker: it exists only inside the
    // substitution itself, so a target cannot pass this by declaring the
    // option and stopping there.
    test(target + ': make_options RESOLVES {name} into base', () => {
      const src = readFileSync(Path.join(TM, target, file), 'utf8')
      // The QUOTED literal, not the bare word: every one of these files says
      // "test-first" and "test-<name>" in prose, so a bare /test-/ passes
      // everywhere and proves nothing. This matches the opening quote and the
      // character that closes or interpolates it - "test-", 'test-',
      // "test-{}" (rust format), "test-#{name}" (ruby) - which only the
      // substitution itself produces.
      ok(/["']test-["'{#]/.test(src),
        target + ': make_options accepts `server` but never substitutes it ' +
        'into `base`, so a templated server URL reaches the wire with the ' +
        'placeholder still in it')
    })
  }

  // Targets whose config has ALWAYS been emitted as data, at every size, from
  // before rung L1 existed. They are past L1 rather than exempt from it: there
  // is no literal branch to keep, so the pair guard above does not apply.
  // Listed rather than ignored, so a target that quietly LOSES its data
  // emission is still a test failure.
  const L1_DATA_ONLY: [string, string, string][] = [
    ['cpp', 'Config_cpp.ts', 'parse_json'],
    ['java', 'Config_java.ts', 'Json\\.parse'],
    ['kotlin', 'Config_kotlin.ts', 'Json\\.parse'],
    ['perl', 'Config_perl.ts', 'parse_json'],
    ['scala', 'Config_scala.ts', 'Json\\.parse'],
    ['swift', 'Config_swift.ts', 'configJson'],
  ]

  for (const [target, file, dataMark] of L1_DATA_ONLY) {
    test(target + ': config is emitted as data at every size', () => {
      const src = readFileSync(
        Path.join(TM, '..', 'src', 'cmp', target, file), 'utf8')
      ok(new RegExp(dataMark).test(src), target + ': no data emission')
    })
  }

  for (const [target, file, dataMark, litMark] of L1_TARGETS) {
    test(target + ': emitting data still emits the literal branch', () => {
      // Both paths have to stay in the component: a target that lost its
      // literal branch would silently switch every small SDK to data, and a
      // target that lost its data branch would silently keep the compile cost.
      const src = readFileSync(
        Path.join(TM, '..', 'src', 'cmp', target, file), 'utf8')
      ok(/isConfigData\(/.test(src), target + ': no threshold check')
      ok(new RegExp(dataMark).test(src), target + ': no data branch')
      ok(new RegExp(litMark).test(src), target + ': no literal branch')
    })
  }
})


// Vendored-library rollout parity (migration guide Phases 2 and 3).
//
// Both rollouts are PER-LANGUAGE, so for a while some targets have migrated
// and some have not. The failure worth catching is the half-migrated one:
// a resolver with no vendored tree behind it, a feature class with no
// vendored library, or the superseded runner left in place as a second,
// stale copy of the same thing. Each is individually plausible and none of
// them shows up as a missing file at the language's own build.
//
// The lists are DECLARED and then checked in both directions, the pattern
// the tier manifest above already uses: a target that is migrated but not
// listed fails just as loudly as a listed one that is incomplete.

// Targets running the vendored omni corpus runner instead of the
// hand-vendored per-target one.
const OMNI_RUNNER: Record<string, {
  resolver: string,
  vendor: string,
  vendorfiles: string[],
  smoke: string,
  // Most targets retire MORE than one file (a generic runner AND a struct
  // runner), so this is a list — every entry must be gone.
  superseded: string[],
}> = {
  ts: {
    resolver: 'ts/test/omni.ts',
    vendor: 'ts/test/vendor/omni',
    // No compat shim: the resolver drives omni's NATIVE makeRunner and
    // carries the SDK-provider adapter itself (vendor-tag rollout,
    // Decision 4).
    vendorfiles: ['Runner.ts', 'Util.ts', 'index.ts'],
    smoke: 'ts/test/omni.test.ts',
    superseded: ['ts/test/runner.ts'],
  },
  js: {
    resolver: 'js/test/omni.js',
    vendor: 'js/test/vendor/omni',
    vendorfiles: ['runner.js', 'util.js', 'index.js'],
    smoke: 'js/test/omni.test.js',
    // js's ONE runner file drove BOTH corpora; its support half was
    // already split into the retained test/utility.js.
    superseded: ['js/test/runner.js'],
  },
  go: {
    // _test.go suffix: the resolver is test-only code and must not ship
    // in the module a consumer imports.
    resolver: 'go/test/omniresolver_test.go',
    vendor: 'go/test/omni',
    vendorfiles: ['omni.go', 'util.go'],
    smoke: 'go/test/omnismoke_test.go',
    // go's support half was split into the retained testsupport_test.go
    // FIRST (same package, zero call-site churn), then both fused files
    // were retired.
    superseded: ['go/test/runner_test.go', 'go/test/struct_runner_test.go'],
  },
  py: {
    resolver: 'py/test/omni.py',
    vendor: 'py/test/voxgig_omni',
    vendorfiles: ['__init__.py', 'runner.py', 'util.py'],
    smoke: 'py/test/test_omni_smoke.py',
    // py's file NAMED runner.py is support-ONLY and is RETAINED; the
    // generic engine it superseded was inlined in the primary-utility
    // template, so the only whole-file retirement is the struct runner.
    superseded: ['py/test/struct_runner.py'],
  },
  rb: {
    resolver: 'rb/test/omni.rb',
    vendor: 'rb/test/vendor/omni',
    vendorfiles: ['voxgig_omni.rb', 'runner.rb', 'util.rb'],
    smoke: 'rb/test/omni_smoke_test.rb',
    // rb's runner.rb is support-ONLY and RETAINED (py shape); the inlined
    // engine left with the primary-utility rewrite.
    superseded: ['rb/test/struct_runner.rb'],
  },
  php: {
    resolver: 'php/test/Omni.php',
    vendor: 'php/test/vendor/omni',
    vendorfiles: ['Runner.php', 'Util.php'],
    smoke: 'php/test/OmniSmokeTest.php',
    // php's Runner.php is support-ONLY and RETAINED (py shape); the
    // engine was inlined in the primary-utility template.
    superseded: ['php/test/StructRunner.php'],
  },
  lua: {
    resolver: 'lua/test/omni.lua',
    vendor: 'lua/test/vendor/omni',
    // The lua port is self-contained by design: it carries its own
    // json/regex modules, so the vendored runner is four files.
    vendorfiles: ['json.lua', 'regex.lua', 'runner.lua', 'util.lua'],
    smoke: 'lua/test/omni_smoke_test.lua',
    // lua's runner.lua is support-ONLY and RETAINED (py shape).
    superseded: ['lua/test/struct_runner.lua'],
  },
  java: {
    resolver: 'java/test/OmniResolver.java',
    vendor: 'java/test/vendor/omni',
    vendorfiles: ['Json.java', 'Runner.java', 'Util.java'],
    smoke: 'java/test/OmniSmokeTest.java',
    // RunnerSupport.java KEEPS ITS NAME with the engine stripped out -
    // emitted call sites reference the class, so support survives in
    // place (the go split's zero-churn rule, class-scoped).
    superseded: ['java/test/StructRunner.java'],
  },
  perl: {
    resolver: 'perl/t/omni.pm',
    vendor: 'perl/t/vendor/omni',
    vendorfiles: ['Voxgig/Omni.pm', 'Voxgig/Omni/Runner.pm', 'Voxgig/Omni/Util.pm'],
    smoke: 'perl/t/omni_smoke.t',
    // perl's t/runner.pm is support-ONLY and RETAINED (py shape).
    superseded: ['perl/t/struct_runner.pm'],
  },
  kotlin: {
    resolver: 'kotlin/test/OmniResolver.kt',
    vendor: 'kotlin/test/vendor/omni',
    vendorfiles: ['Json.kt', 'Runner.kt', 'Util.kt'],
    smoke: 'kotlin/test/OmniSmokeTest.kt',
    // RunnerSupport.kt KEEPS ITS NAME with the engine stripped out (the
    // class-scoped zero-churn rule, as java).
    superseded: ['kotlin/test/StructRunner.kt'],
  },
  csharp: {
    resolver: 'csharp/test/OmniResolver.cs',
    vendor: 'csharp/test/vendor/omni',
    vendorfiles: ['Runner.cs', 'Util.cs'],
    smoke: 'csharp/test/OmniSmokeTest.cs',
    // Runner.cs keeps the TestRunner class name with the engine stripped
    // (support + the StructRunner support members live on inside it), so
    // the emitted call sites need zero churn.
    superseded: ['csharp/test/StructRunner.cs'],
  },
  // ---- Tranche 3: the last ten. Between them they complete the rollout
  // for every SDK target except zig, whose omni port at the tag is written
  // for Zig 0.16 while this target is pinned to 0.13.
  c: {
    // c has no modules: the resolver is a header the corpus drivers
    // include, and the vendored .c files build into their own archive so
    // they never reach the shipped libsdk.a.
    resolver: 'c/tests/omni_resolver.h',
    vendor: 'c/tests/vendor/omni',
    vendorfiles: ['omni.h', 'json.c', 'runner.c', 'util.c'],
    smoke: 'c/tests/omni_smoke_test.c',
    superseded: ['c/tests/runner.h'],
  },
  cpp: {
    resolver: 'cpp/test/omni_resolver.hpp',
    vendor: 'cpp/test/vendor/omni',
    vendorfiles: ['omni.hpp', 'json.hpp', 'util.hpp'],
    smoke: 'cpp/test/omni_smoke_test.cpp',
    superseded: ['cpp/test/struct_runner.hpp'],
  },
  swift: {
    resolver: 'swift/Tests/ProjectNameSDKTests/OmniResolver.swift',
    vendor: 'swift/Tests/vendor/omni',
    vendorfiles: ['Json.swift', 'Runner.swift', 'Util.swift'],
    smoke: 'swift/Tests/ProjectNameSDKTests/OmniSmokeTest.swift',
    // Runner.swift is support-ONLY (py shape) and is RETAINED; the corpus
    // files keep their names and were rewritten in place.
    superseded: [],
  },
  rust: {
    resolver: 'rust/tests/omni_resolver/mod.rs',
    vendor: 'rust/tests/vendor/omni',
    vendorfiles: ['mod.rs', 'json.rs', 'regex.rs', 'runner.rs', 'util.rs'],
    smoke: 'rust/tests/omni_smoke_test.rs',
    superseded: ['rust/tests/struct_runner/mod.rs'],
  },
  scala: {
    resolver: 'scala/sdktest/OmniResolver.scala',
    vendor: 'scala/sdktest/vendor/omni',
    vendorfiles: ['Json.scala', 'Runner.scala', 'Util.scala'],
    smoke: 'scala/sdktest/OmniSmoke.scala',
    // StructCorpus.scala keeps its name: the build binds a main class to
    // it, so a rename would be pure call-site churn.
    superseded: [],
  },
  clojure: {
    resolver: 'clojure/test/sdk/test/omni.clj',
    // A clojure namespace is derived from its PATH, so the vendored files
    // keep their voxgig/omni/ prefix underneath the vendor root.
    vendor: 'clojure/test/vendor/omni',
    vendorfiles: [
      'voxgig/omni/json.clj', 'voxgig/omni/runner.clj', 'voxgig/omni/util.clj',
    ],
    smoke: 'clojure/test/sdk/test/omni_smoke.clj',
    superseded: [],
  },
  elixir: {
    resolver: 'elixir/test/support/omni.ex',
    vendor: 'elixir/test/vendor/omni',
    vendorfiles: ['json.ex', 'runner.ex', 'util.ex'],
    smoke: 'elixir/test/omni_smoke_test.exs',
    superseded: ['elixir/test/support/struct_corpus.ex'],
  },
  ocaml: {
    resolver: 'ocaml/test/omni_resolver.ml',
    // The whole ocaml port is ONE file — the only single-file omni port
    // besides lean.
    vendor: 'ocaml/test/vendor/omni',
    vendorfiles: ['omni.ml'],
    smoke: 'ocaml/test/omni_smoke_test.ml',
    superseded: ['ocaml/test/corpus_runner.ml'],
  },
  zig: {
    // The LAST target, and the one that needed a toolchain move to get
    // here: omni's zig port is written for Zig 0.16, so vendoring it was
    // impossible while this target was pinned to 0.13.
    resolver: 'zig/test/omniresolver.zig',
    vendor: 'zig/test/vendor/omni',
    vendorfiles: ['omni.zig', 'regex.zig'],
    smoke: 'zig/test/omnismoke_test.zig',
    superseded: ['zig/test/struct_runner.zig'],
  },
}


// Targets shipping the secrets feature, which is a thin layer over a
// vendored sekreto port and is worthless without it.
const SECRETS: Record<string, {
  feature: string,
  vendor: string,
  vendorfiles: string[],
  plugindir?: string,
  pluginfiles?: string[],
  tests: string,
}> = {
  // ---- The checkpoint expansion. sekreto's ports were reshaped one at a
  // time; at sdk-20260904-1610-0 only four had the provider/ + plugins/
  // shape, which is why secrets stopped at ts/go/py. At
  // sdk-20260907-0029-0 all twenty-three do, and js — deferred since the
  // pilot for exactly this reason — is first through.
  js: {
    feature: 'js/src/feature/secrets/SecretsFeature.js',
    vendor: 'js/src/feature/secrets/sekreto',
    vendorfiles: [
      'Sekreto.js', 'index.js',
      'provider/support.js', 'provider/builtin.js', 'provider/addr.js',
      'provider/env.js', 'provider/memory.js',
      'provider/dotenv.js', 'provider/file.js',
      'plugins/aws.js', 'plugins/sigv4.js', 'plugins/httpjson.js',
      'plugins/hashicorp.js', 'plugins/secretspec.js',
    ],
    plugindir: 'js/src/feature/secrets/plugin',
    pluginfiles: ['index.js', 'catalog.js', 'host.js', 'types.js'],
    tests: 'js/test/feature/secrets',
  },
  rb: {
    // rb's container is the top-level feature/ dir (srcfeature: false), and
    // its vendored trees carry the voxgig_ prefix a ruby require path needs.
    feature: 'rb/feature/secrets_feature.rb',
    vendor: 'rb/feature/secrets/voxgig_sekreto',
    // ruby's reshape is NOT ts's: the built-ins stay in one aggregate
    // `providers.rb` rather than a `provider/` directory, and only the
    // gated kinds are split into `plugins/`. `plugins.rb` is the full-set
    // barrel and is deliberately absent — vendoring a barrel would defeat
    // the plugin trim by importing every kind.
    vendorfiles: [
      'sekreto.rb', 'addr.rb', 'providers.rb',
      'plugins/aws.rb', 'plugins/sigv4.rb', 'plugins/httpjson.rb',
      'plugins/hashicorp.rb', 'plugins/secretspec.rb',
    ],
    plugindir: 'rb/feature/secrets/voxgig_plugin',
    pluginfiles: ['catalog.rb', 'host.rb', 'types.rb'],
    tests: 'rb/test/feature/secrets',
  },
  php: {
    feature: 'php/feature/SecretsFeature.php',
    vendor: 'php/feature/secrets/sekreto',
    // php keeps the core under src/ and the gated kinds beside it.
    vendorfiles: [
      'src/Sekreto.php', 'src/Providers.php', 'src/Addr.php',
      'plugins/aws.php', 'plugins/sigv4.php', 'plugins/httpjson.php',
      'plugins/hashicorp.php', 'plugins/secretspec.php',
    ],
    plugindir: 'php/feature/secrets/plugin',
    pluginfiles: ['Catalog.php', 'Host.php', 'Types.php'],
    tests: 'php/test/feature/secrets',
  },
  ts: {
    feature: 'ts/src/feature/secrets/SecretsFeature.ts',
    vendor: 'ts/src/feature/secrets/sekreto',
    // The RESHAPED sekreto (vendor-tag rollout): `src/provider/` holds the
    // built-ins the core imports unconditionally (env, memory, dotenv,
    // file, via builtin.ts), and `plugins/` holds the gated definitions.
    // `plugins/index.ts` — the full-set barrel — is deliberately NOT here:
    // vendored.test.ts asserts its absence directly. `plugins/sigv4.ts` is
    // owned by the `aws` PLUGIN; what reaches a generated SDK is decided
    // per project by the plugin trim.
    vendorfiles: [
      'Sekreto.ts', 'index.ts',
      'provider/support.ts', 'provider/builtin.ts', 'provider/addr.ts',
      'provider/env.ts', 'provider/memory.ts',
      'provider/dotenv.ts', 'provider/file.ts',
      'plugins/aws.ts', 'plugins/sigv4.ts', 'plugins/httpjson.ts',
      'plugins/hashicorp.ts', 'plugins/secretspec.ts',
    ],
    // The vendored voxgig/plugin runtime sekreto's reshape depends on,
    // INSIDE the feature container so the feature trim removes both
    // together.
    plugindir: 'ts/src/feature/secrets/plugin',
    pluginfiles: ['index.ts', 'Catalog.ts', 'Host.ts', 'Types.ts'],
    tests: 'ts/test/feature/secrets',
  },
  go: {
    // go's feature container is the top-level feature/ dir (srcfeature:
    // false), so the vendored trees live beside the feature file and the
    // add-time featureExcludes gates the whole folder.
    feature: 'go/feature/secrets_feature.go',
    vendor: 'go/feature/secrets',
    vendorfiles: [
      'sekreto/sekreto.go', 'sekreto/providers.go', 'sekreto/addr.go',
      'plugins/httpjson/httpjson.go',
      'plugins/hashicorp/hashicorp.go', 'plugins/boru/boru.go',
      'plugins/gcpsecrets/gcpsecrets.go', 'plugins/azuresecrets/azuresecrets.go',
      'plugins/onepassword/onepassword.go', 'plugins/doppler/doppler.go',
      'plugins/infisical/infisical.go', 'plugins/secretspec/secretspec.go',
      'plugins/aws/aws.go', 'plugins/aws/sigv4.go',
    ],
    plugindir: 'go/feature/secrets/plugin',
    pluginfiles: [
      'capability.go', 'catalog.go', 'config.go', 'depend.go', 'env.go',
      'export.go', 'graph.go', 'host.go', 'order.go', 'point.go',
      'ref.go', 'resolve.go', 'types.go', 'util.go', 'version.go',
    ],
    tests: 'go/test/feature/secrets',
  },
  py: {
    // py's feature container is pkg/feature/ (srcfeature: false); the
    // vendored trees live under the gated secrets/ folder beside the
    // feature file.
    feature: 'py/pkg/feature/secrets_feature.py',
    vendor: 'py/pkg/feature/secrets/voxgig_sekreto',
    vendorfiles: [
      '__init__.py', 'sekreto.py', 'providers.py', 'addr.py',
      'plugins/aws.py', 'plugins/sigv4.py', 'plugins/httpjson.py',
      'plugins/hashicorp.py', 'plugins/secretspec.py',
    ],
    plugindir: 'py/pkg/feature/secrets/voxgig_plugin',
    pluginfiles: ['__init__.py', 'catalog.py', 'host.py', 'types.py'],
    tests: 'py/test/feature/secrets',
  },
  // ---- Tranche B: the nine targets that joined at sdk-20260907-0029-0.
  // Each row is written from the tree ON DISK, not from the ts shape:
  // every port reshaped sekreto in its own idiom.
  java: {
    // java's feature container is the top-level feature/ dir. Two files
    // under plugins/ are SHARED, not grouped: Httpjson and Proc, and Sigv4
    // whose package-private uriescape three saas kinds call - the plugin
    // trim must never remove them (see model/feature/secrets.aon).
    feature: 'java/feature/SecretsFeature.java',
    vendor: 'java/feature/secrets/sekreto',
    vendorfiles: [
      'Addr.java', 'Builtins.java', 'Json.java', 'Provider.java',
      'Sekreto.java', 'Support.java', 'plugins/Aws.java',
      'plugins/Azuresecrets.java', 'plugins/Boru.java',
      'plugins/Doppler.java', 'plugins/Gcpsecrets.java',
      'plugins/Hashicorp.java', 'plugins/Httpjson.java',
      'plugins/Infisical.java', 'plugins/Onepassword.java',
      'plugins/Proc.java', 'plugins/Secretspec.java', 'plugins/Sigv4.java',
    ],
    plugindir: 'java/feature/secrets/plugin',
    pluginfiles: [
      'Capability.java', 'Catalog.java', 'Config.java', 'Definition.java',
      'Depend.java', 'Entry.java', 'Env.java', 'Export.java', 'Graph.java',
      'Host.java', 'Inst.java', 'Json.java', 'Order.java', 'Plugin.java',
      'PluginException.java', 'Point.java', 'Refs.java', 'Resolve.java',
      'Types.java', 'Version.java',
    ],
    tests: 'java/test/feature/secrets',
  },
  csharp: {
    // csharp keeps the sekreto core and its gated kinds as SIBLINGS -
    // sekreto/ beside plugins/ - rather than nesting plugins/ inside.
    feature: 'csharp/feature/SecretsFeature.cs',
    vendor: 'csharp/feature/secrets',
    vendorfiles: [
      'sekreto/Json.cs', 'sekreto/Providers.cs', 'sekreto/Sekreto.cs',
      'plugins/Aws.cs', 'plugins/AzureSecrets.cs', 'plugins/Boru.cs',
      'plugins/Child.cs', 'plugins/Doppler.cs', 'plugins/GcpSecrets.cs',
      'plugins/Hashicorp.cs', 'plugins/HttpJson.cs', 'plugins/Infisical.cs',
      'plugins/OnePassword.cs', 'plugins/SecretSpec.cs', 'plugins/Sigv4.cs',
    ],
    plugindir: 'csharp/feature/secrets/plugin',
    pluginfiles: [
      'Capability.cs', 'Catalog.cs', 'Config.cs', 'Definition.cs',
      'Depend.cs', 'Entry.cs', 'Env.cs', 'Export.cs', 'Graph.cs', 'Host.cs',
      'Inst.cs', 'Json.cs', 'Order.cs', 'Plugin.cs', 'Point.cs', 'Refs.cs',
      'Resolve.cs', 'Types.cs', 'Version.cs',
    ],
    tests: 'csharp/test/feature/secrets',
  },
  kotlin: {
    // kotlin mirrors java's shape, with Spec.kt split out of the core.
    feature: 'kotlin/feature/SecretsFeature.kt',
    vendor: 'kotlin/feature/secrets/sekreto',
    vendorfiles: [
      'Json.kt', 'Provider.kt', 'Providers.kt', 'Sekreto.kt', 'Spec.kt',
      'Support.kt', 'plugins/Aws.kt', 'plugins/Azuresecrets.kt',
      'plugins/Boru.kt', 'plugins/Doppler.kt', 'plugins/Gcpsecrets.kt',
      'plugins/Hashicorp.kt', 'plugins/Httpjson.kt', 'plugins/Infisical.kt',
      'plugins/Onepassword.kt', 'plugins/Secretspec.kt', 'plugins/Sigv4.kt',
    ],
    plugindir: 'kotlin/feature/secrets/plugin',
    pluginfiles: [
      'Capability.kt', 'Catalog.kt', 'Config.kt', 'Depend.kt', 'Env.kt',
      'Export.kt', 'Graph.kt', 'Host.kt', 'Json.kt', 'Order.kt', 'Plugin.kt',
      'Point.kt', 'Refs.kt', 'Resolve.kt', 'Types.kt', 'Version.kt',
    ],
    tests: 'kotlin/test/feature/secrets',
  },
  scala: {
    // scala's suite lives in sdktest/ (its test roots are named, not
    // discovered), and Sigv4.scala ships ungrouped for the same reason
    // as java's: its private[plugins] uriescape has four callers outside
    // the aws group.
    feature: 'scala/feature/SecretsFeature.scala',
    vendor: 'scala/feature/secrets/sekreto',
    vendorfiles: [
      'Json.scala', 'Provider.scala', 'Providers.scala', 'Sekreto.scala',
      'Spec.scala', 'Support.scala', 'plugins/Aws.scala',
      'plugins/Azuresecrets.scala', 'plugins/Boru.scala',
      'plugins/Doppler.scala', 'plugins/Gcpsecrets.scala',
      'plugins/Hashicorp.scala', 'plugins/Httpjson.scala',
      'plugins/Infisical.scala', 'plugins/Onepassword.scala',
      'plugins/Secretspec.scala', 'plugins/Sigv4.scala',
    ],
    plugindir: 'scala/feature/secrets/plugin',
    pluginfiles: [
      'Capability.scala', 'Config.scala', 'Depend.scala', 'Env.scala',
      'Export.scala', 'Graph.scala', 'Host.scala', 'Json.scala',
      'Order.scala', 'Plugin.scala', 'Point.scala', 'Refs.scala',
      'Resolve.scala', 'Types.scala', 'Value.scala', 'Version.scala',
    ],
    tests: 'scala/sdktest/feature/secrets',
  },
  perl: {
    // perl nests the package path under each vendored root:
    // sekreto/Voxgig/Sekreto.pm, plugins/Voxgig/Sekreto/Plugins/*.pm,
    // plugin/Voxgig/Plugin/*.pm. The suite lives in t/, not test/.
    feature: 'perl/feature/secrets_feature.pm',
    vendor: 'perl/feature/secrets',
    vendorfiles: [
      'sekreto/Voxgig/Sekreto.pm', 'sekreto/Voxgig/Sekreto/Addr.pm',
      'sekreto/Voxgig/Sekreto/Providers.pm',
      'plugins/Voxgig/Sekreto/Plugins/Aws.pm',
      'plugins/Voxgig/Sekreto/Plugins/Azuresecrets.pm',
      'plugins/Voxgig/Sekreto/Plugins/Boru.pm',
      'plugins/Voxgig/Sekreto/Plugins/Doppler.pm',
      'plugins/Voxgig/Sekreto/Plugins/Gcpsecrets.pm',
      'plugins/Voxgig/Sekreto/Plugins/Hashicorp.pm',
      'plugins/Voxgig/Sekreto/Plugins/Httpjson.pm',
      'plugins/Voxgig/Sekreto/Plugins/Infisical.pm',
      'plugins/Voxgig/Sekreto/Plugins/Onepassword.pm',
      'plugins/Voxgig/Sekreto/Plugins/Proc.pm',
      'plugins/Voxgig/Sekreto/Plugins/Secretspec.pm',
      'plugins/Voxgig/Sekreto/Plugins/Sigv4.pm',
    ],
    plugindir: 'perl/feature/secrets/plugin',
    pluginfiles: [
      'Voxgig/Plugin.pm', 'Voxgig/Plugin/Capability.pm',
      'Voxgig/Plugin/Catalog.pm', 'Voxgig/Plugin/Config.pm',
      'Voxgig/Plugin/Depend.pm', 'Voxgig/Plugin/Env.pm',
      'Voxgig/Plugin/Export.pm', 'Voxgig/Plugin/Graph.pm',
      'Voxgig/Plugin/Host.pm', 'Voxgig/Plugin/Order.pm',
      'Voxgig/Plugin/Point.pm', 'Voxgig/Plugin/Ref.pm',
      'Voxgig/Plugin/Resolve.pm', 'Voxgig/Plugin/Types.pm',
      'Voxgig/Plugin/Version.pm',
    ],
    tests: 'perl/t/feature/secrets',
  },
  rust: {
    // rust's feature is a single secrets.rs beside the secrets/ tree; aws
    // and httpjson are each a module file plus a submodule directory.
    feature: 'rust/feature/secrets.rs',
    vendor: 'rust/feature/secrets',
    vendorfiles: [
      'sekreto/addr.rs', 'sekreto/mod.rs', 'sekreto/providers.rs',
      'sekreto/sekreto.rs', 'plugins/aws.rs', 'plugins/aws/crypto.rs',
      'plugins/aws/sigv4.rs', 'plugins/azuresecrets.rs', 'plugins/boru.rs',
      'plugins/doppler.rs', 'plugins/gcpsecrets.rs', 'plugins/hashicorp.rs',
      'plugins/httpjson.rs', 'plugins/httpjson/http.rs',
      'plugins/httpjson/json.rs', 'plugins/infisical.rs',
      'plugins/onepassword.rs', 'plugins/secretspec.rs',
    ],
    plugindir: 'rust/feature/secrets/plugin',
    pluginfiles: [
      'capability.rs', 'catalog.rs', 'config.rs', 'depend.rs', 'env.rs',
      'export.rs', 'graph.rs', 'host.rs', 'mod.rs', 'order.rs', 'point.rs',
      'refs.rs', 'resolve.rs', 'types.rs', 'value.rs', 'version.rs',
    ],
    tests: 'rust/tests/feature/secrets',
  },
  clojure: {
    // clojure's namespaces are path-derived, so both vendored libraries
    // sit under one voxgig/ root: sekreto.clj + sekreto/, plugin.clj +
    // plugin/. The feature namespace is sdk.feature.secrets, and the
    // suite is one file under test/sdk/test/feature/.
    feature: 'clojure/feature/secrets/sdk/feature/secrets.clj',
    vendor: 'clojure/feature/secrets/voxgig',
    vendorfiles: [
      'sekreto.clj', 'sekreto/addr.clj', 'sekreto/chain.clj',
      'sekreto/core.clj', 'sekreto/json.clj', 'sekreto/plugins/aws.clj',
      'sekreto/plugins/azuresecrets.clj', 'sekreto/plugins/boru.clj',
      'sekreto/plugins/doppler.clj', 'sekreto/plugins/gcpsecrets.clj',
      'sekreto/plugins/hashicorp.clj', 'sekreto/plugins/httpjson.clj',
      'sekreto/plugins/infisical.clj', 'sekreto/plugins/onepassword.clj',
      'sekreto/plugins/proc.clj', 'sekreto/plugins/secretspec.clj',
      'sekreto/plugins/sigv4.clj', 'sekreto/provider.clj',
      'sekreto/providers.clj',
    ],
    plugindir: 'clojure/feature/secrets/voxgig',
    pluginfiles: [
      'plugin.clj', 'plugin/capability.clj', 'plugin/catalog.clj',
      'plugin/config.clj', 'plugin/depend.clj', 'plugin/env.clj',
      'plugin/export.clj', 'plugin/graph.clj', 'plugin/host.clj',
      'plugin/json.clj', 'plugin/order.clj', 'plugin/point.clj',
      'plugin/ref.clj', 'plugin/resolve.clj', 'plugin/types.clj',
      'plugin/version.clj',
    ],
    tests: 'clojure/test/sdk/test/feature/secrets.clj',
  },
  elixir: {
    // elixir's container is lib/projectname/feature/secrets/ - the
    // ProjectName placeholder is the module root a mix project needs.
    // Its port carries http.ex and proc.ex as shared plugin helpers.
    feature: 'elixir/lib/projectname/feature/secrets.ex',
    vendor: 'elixir/lib/projectname/feature/secrets/sekreto',
    vendorfiles: [
      'json.ex', 'plugins/aws.ex', 'plugins/azuresecrets.ex',
      'plugins/boru.ex', 'plugins/doppler.ex', 'plugins/gcpsecrets.ex',
      'plugins/hashicorp.ex', 'plugins/http.ex', 'plugins/httpjson.ex',
      'plugins/infisical.ex', 'plugins/onepassword.ex', 'plugins/proc.ex',
      'plugins/secretspec.ex', 'plugins/sigv4.ex', 'provider.ex',
      'providers.ex', 'sekreto.ex',
    ],
    plugindir: 'elixir/lib/projectname/feature/secrets/plugin',
    pluginfiles: [
      'capability.ex', 'catalog.ex', 'config.ex', 'depend.ex', 'env.ex',
      'error.ex', 'export.ex', 'graph.ex', 'host.ex', 'inst.ex', 'json.ex',
      'order.ex', 'point.ex', 'ref.ex', 'resolve.ex', 'types.ex',
      'version.ex', 'voxgig_plugin.ex',
    ],
    tests: 'elixir/test/feature/secrets',
  },
  swift: {
    // swift vendors THREE SwiftPM modules (Sekreto, SekretoPlugins,
    // VoxgigPlugin) under one gated folder: sekreto/ and plugins/ are
    // SIBLINGS, as upstream lays them out, and Package_swift names each as
    // its own target. plugins/All.swift is the full-set barrel and is
    // deliberately absent (pinned by vendored.test.ts).
    feature: 'swift/Sources/ProjectNameSDK/feature/SecretsFeature.swift',
    vendor: 'swift/Sources/ProjectNameSDK/feature/secrets',
    vendorfiles: [
      'sekreto/Addr.swift', 'sekreto/Json.swift', 'sekreto/Provider.swift',
      'sekreto/Providers.swift', 'sekreto/Sekreto.swift',
      'plugins/Aws.swift', 'plugins/Azuresecrets.swift',
      'plugins/Boru.swift', 'plugins/Crypto.swift', 'plugins/Doppler.swift',
      'plugins/Gcpsecrets.swift', 'plugins/Hashicorp.swift',
      'plugins/Httpjson.swift', 'plugins/Infisical.swift',
      'plugins/Onepassword.swift', 'plugins/Proc.swift',
      'plugins/Secretspec.swift', 'plugins/Sigv4.swift',
    ],
    plugindir: 'swift/Sources/ProjectNameSDK/feature/secrets/plugin',
    pluginfiles: [
      'Capability.swift', 'Catalog.swift', 'Config.swift', 'Depend.swift',
      'Env.swift', 'Export.swift', 'Graph.swift', 'Host.swift', 'Json.swift',
      'Order.swift', 'Point.swift', 'Refs.swift', 'Resolve.swift',
      'Types.swift', 'Value.swift', 'Version.swift',
    ],
    tests: 'swift/Tests/ProjectNameSDKTests/feature/secrets',
  },
  c: {
    // c's feature is the flat secrets.c (+ secrets.h) beside a same-named
    // directory holding both vendored libraries; sekreto/ and plugins/ are
    // siblings as upstream lays them out, and every include is a bare
    // basename resolved by -I, so there are no adapts. plugins/all.c is the
    // full-set barrel and is deliberately absent (pinned by vendored.test.ts).
    // The generated feature/secrets/kinds.c (definitions + the gated libcurl
    // transport) is NOT vendored and lives outside these three dirs.
    feature: 'c/feature/secrets.c',
    vendor: 'c/feature/secrets',
    vendorfiles: [
      'sekreto/internal.h', 'sekreto/json.c', 'sekreto/providers.c',
      'sekreto/sekreto.c', 'sekreto/sekreto.h', 'sekreto/util.c',
      'plugins/aws.c', 'plugins/azuresecrets.c', 'plugins/boru.c',
      'plugins/clock.c', 'plugins/doppler.c', 'plugins/encode.c',
      'plugins/gcpsecrets.c', 'plugins/hashicorp.c', 'plugins/httpjson.c',
      'plugins/infisical.c', 'plugins/onepassword.c', 'plugins/proc.c',
      'plugins/secretspec.c', 'plugins/sekretoplugins.h', 'plugins/sha256.c',
      'plugins/sigv4.c', 'plugins/support.h', 'plugins/tls.c',
    ],
    plugindir: 'c/feature/secrets/plugin',
    pluginfiles: [
      'capability.c', 'capability.h', 'catalog.c', 'catalog.h', 'config.c',
      'config.h', 'depend.c', 'depend.h', 'env.c', 'env.h', 'export.c',
      'export.h', 'graph.c', 'graph.h', 'host.c', 'host.h', 'order.c',
      'order.h', 'point.c', 'point.h', 'ref.c', 'ref.h', 'resolve.c',
      'resolve.h', 'types.c', 'types.h', 'value.c', 'value.h', 'version.c',
      'version.h',
    ],
    tests: 'c/tests/feature/secrets',
  },
  lua: {
    // lua's feature container is the top-level feature/ dir. The two library
    // entry modules (sekreto.lua, plugin.lua) sit at the container root
    // because `require` resolves them by that path; sekreto/ holds the core
    // and its plugins/, plugin/ the voxgig/plugin runtime, and native/ the
    // vendored C source of sekreto's socket helper, compiled by the generated
    // Makefile only when a plugin group is active. sekreto/plugins.lua is the
    // full-set barrel and is deliberately absent (pinned by vendored.test.ts).
    feature: 'lua/feature/secrets_feature.lua',
    vendor: 'lua/feature/secrets',
    vendorfiles: [
      'plugin.lua', 'sekreto.lua', 'sekreto/addr.lua', 'sekreto/err.lua',
      'sekreto/name.lua', 'sekreto/plugins/aws.lua',
      'sekreto/plugins/azuresecrets.lua', 'sekreto/plugins/boru.lua',
      'sekreto/plugins/crypto.lua', 'sekreto/plugins/doppler.lua',
      'sekreto/plugins/gcpsecrets.lua', 'sekreto/plugins/hashicorp.lua',
      'sekreto/plugins/httpjson.lua', 'sekreto/plugins/infisical.lua',
      'sekreto/plugins/json.lua', 'sekreto/plugins/net.lua',
      'sekreto/plugins/onepassword.lua', 'sekreto/plugins/secretspec.lua',
      'sekreto/plugins/sigv4.lua', 'sekreto/plugins/support.lua',
      'sekreto/providers.lua', 'native/sekretonet.c',
    ],
    plugindir: 'lua/feature/secrets/plugin',
    pluginfiles: [
      'capability.lua', 'catalog.lua', 'config.lua', 'depend.lua', 'env.lua',
      'export.lua', 'graph.lua', 'host.lua', 'json.lua', 'order.lua',
      'point.lua', 'ref.lua', 'resolve.lua', 'types.lua', 'version.lua',
    ],
    tests: 'lua/test/feature/secrets',
  },
  zig: {
    // zig's feature is the flat secrets.zig beside a same-named directory
    // holding both libraries as sibling sekreto/ and plugins/ module trees.
    // The generated feature/secrets/plugins.zig (the sekretoplugins module
    // root, listing the selected kinds) sits ABOVE the vendored plugins/ dir
    // on purpose, so no vendored-guard exemption is needed. plugins/all.zig
    // is the full-set barrel and is deliberately absent.
    feature: 'zig/feature/secrets.zig',
    vendor: 'zig/feature/secrets',
    vendorfiles: [
      'sekreto/addr.zig', 'sekreto/builtins.zig', 'sekreto/provider.zig',
      'sekreto/sekreto.zig', 'plugins/aws.zig', 'plugins/azuresecrets.zig',
      'plugins/boru.zig', 'plugins/doppler.zig', 'plugins/gcpsecrets.zig',
      'plugins/hashicorp.zig', 'plugins/httpjson.zig',
      'plugins/infisical.zig', 'plugins/onepassword.zig',
      'plugins/secretspec.zig', 'plugins/sigv4.zig',
    ],
    plugindir: 'zig/feature/secrets/plugin',
    pluginfiles: [
      'capability.zig', 'catalog.zig', 'config.zig', 'depend.zig', 'env.zig',
      'export.zig', 'graph.zig', 'host.zig', 'inst.zig', 'order.zig',
      'plugin.zig', 'point.zig', 'ref.zig', 'resolve.zig', 'types.zig',
      'value.zig', 'version.zig',
    ],
    tests: 'zig/test/feature/secrets',
  },
  ocaml: {
    // ocaml's feature container is the top-level feature/ dir; sekreto/ and
    // plugins/ are siblings, and plugins/ carries tls_stubs.c, the vendored
    // C binding compiled by the generated secrets.mk only when a TLS group is
    // active. plugins/allplugins.ml is the full-set barrel and is
    // deliberately absent (pinned by vendored.test.ts).
    feature: 'ocaml/feature/secrets_feature.ml',
    vendor: 'ocaml/feature/secrets',
    vendorfiles: [
      'sekreto/json.ml', 'sekreto/provider.ml', 'sekreto/secret.ml',
      'sekreto/sekreto.ml', 'plugins/aws.ml', 'plugins/azuresecrets.ml',
      'plugins/boru.ml', 'plugins/crypto.ml', 'plugins/doppler.ml',
      'plugins/gcpsecrets.ml', 'plugins/hashicorp.ml', 'plugins/http.ml',
      'plugins/httpjson.ml', 'plugins/infisical.ml',
      'plugins/onepassword.ml', 'plugins/runcmd.ml', 'plugins/secretspec.ml',
      'plugins/sigv4.ml', 'plugins/tls.ml', 'plugins/tls_stubs.c',
    ],
    plugindir: 'ocaml/feature/secrets/plugin',
    pluginfiles: [
      'capability.ml', 'catalog.ml', 'config.ml', 'defs.ml', 'depend.ml',
      'env.ml', 'export.ml', 'graph.ml', 'host.ml', 'order.ml', 'point.ml',
      'ref.ml', 'resolve.ml', 'types.ml', 'value.ml', 'version.ml',
    ],
    tests: 'ocaml/test/feature/secrets',
  },
}


describe('vendored-library rollout parity', () => {

  test('every target on the omni runner carries the whole runner', () => {
    for (const [target, spec] of Object.entries(OMNI_RUNNER)) {
      ok(existsSync(Path.join(TM, spec.resolver)),
        target + ': missing the omni resolver ' + spec.resolver)

      for (const f of spec.vendorfiles) {
        ok(existsSync(Path.join(TM, spec.vendor, f)),
          target + ': missing vendored omni file ' + spec.vendor + '/' + f)
      }

      // Without this the generated suite can go vacuously green: a broken
      // runner that reports nothing looks exactly like a passing one.
      ok(existsSync(Path.join(TM, spec.smoke)),
        target + ': missing the runner-must-fail smoke test ' + spec.smoke)

      for (const gone of spec.superseded) {
        ok(!existsSync(Path.join(TM, gone)),
          target + ': the superseded runner ' + gone + ' is still ' +
          'present alongside vendored omni — two copies of the same runner, ' +
          'one of them stale')
      }
    }
  })


  test('no target is half-migrated to omni without being listed', () => {
    // The vendored-omni location is per-language (ts/js keep a vendor/
    // dir, go vendors a package at test/omni, py a package at
    // test/voxgig_omni) — one hard-coded path here read a third of the
    // tree as unmigrated. Any candidate existing without a row is the
    // half-migrated state this exists to catch.
    const CANDIDATES = [
      ['test', 'vendor', 'omni'],
      ['test', 'omni'],
      ['test', 'voxgig_omni'],
      // perl keeps its tests in t/, not test/ — a candidate list that
      // only knew test/ would let a rowless perl vendor pass unseen.
      ['t', 'vendor', 'omni'],
      // Tranche 3 brought three more test-directory spellings, and each
      // was invisible here until it was listed: c and rust use tests/
      // (plural), scala sdktest/, swift Tests/.
      ['tests', 'vendor', 'omni'],
      ['sdktest', 'vendor', 'omni'],
      ['Tests', 'vendor', 'omni'],
    ]

    const unlisted = sdkTargets()
      .filter((t) => null == OMNI_RUNNER[t])
      .filter((t) => CANDIDATES.some((c) => existsSync(Path.join(TM, t, ...c))))

    deepStrictEqual(unlisted, [],
      'these targets have a vendored omni tree but are not in OMNI_RUNNER — ' +
      'add them so the rest of the runner is checked too')
  })


  test('every target shipping secrets ships the vendored sekreto with it', () => {
    for (const [target, spec] of Object.entries(SECRETS)) {
      ok(existsSync(Path.join(TM, spec.feature)),
        target + ': missing ' + spec.feature)

      for (const f of spec.vendorfiles) {
        ok(existsSync(Path.join(TM, spec.vendor, f)),
          target + ': missing vendored sekreto file ' + spec.vendor + '/' + f)
      }

      for (const f of spec.pluginfiles || []) {
        ok(existsSync(Path.join(TM, spec.plugindir as string, f)),
          target + ': missing vendored plugin file ' + spec.plugindir + '/' + f)
      }

      // In the feature container, so the trim removes it with the feature.
      ok(existsSync(Path.join(TM, spec.tests)),
        target + ': missing the trimmable feature tests ' + spec.tests)
    }
  })


  test('no target ships secrets source without being listed', () => {
    // Feature containers are per-language too: ts/js use src/feature/,
    // go a top-level feature/ dir, py pkg/feature/.
    const CONTAINERS = [
      ['src', 'feature', 'secrets'],
      ['feature', 'secrets'],
      ['pkg', 'feature', 'secrets'],
      // dart keeps its feature under lib/, elixir under the mix module root.
      ['lib', 'feature', 'secrets'],
      ['lib', 'projectname', 'feature', 'secrets'],
      // swift's SwiftPM source root.
      ['Sources', 'ProjectNameSDK', 'feature', 'secrets'],
    ]

    const unlisted = sdkTargets()
      .filter((t) => null == SECRETS[t])
      .filter((t) => CONTAINERS.some((c) => {
        const dir = Path.join(TM, t, ...c)
        if (!existsSync(dir)) return false
        // A bare copy-target dir (.gitkeep only) is what `feature add`
        // needs and is not an implementation.
        return readdirSync(dir).some((f) => !f.startsWith('.'))
      }))

    deepStrictEqual(unlisted, [],
      'these targets carry secrets source but are not in SECRETS — add them ' +
      'so the vendored library and the tests are checked too')
  })
})


// A zig file belongs to exactly ONE module. `build.zig` makes
// `utility/voxgigstruct/struct.zig` the root of the `voxgig-struct` module
// and hands that import to every test module by name, so a test that ALSO
// reaches those files by relative path puts them in two modules at once —
// `error: file exists in multiple modules`, raised whether or not the
// path-imported decl is ever used, and it gives the importer a second copy
// of the file with distinct types besides.
//
// Two test templates did exactly that. CI caught it once and then passed on
// a re-run of the same tree, which is the worst way to learn about a rule:
// the pin is here so the next one fails on the first run instead.
describe('zig test templates reach modules by name', () => {

  test('no zig template path-imports a file the struct module owns', () => {
    const dir = Path.join(TM, 'zig', 'test')
    const offenders: string[] = []

    for (const name of readdirSync(dir).filter((f) => f.endsWith('.zig'))) {
      const src = readFileSync(Path.join(dir, name), 'utf8')
      for (const line of src.split('\n')) {
        if (/@import\("[^"]*utility\/voxgigstruct\//.test(line)) {
          offenders.push(name + ': ' + line.trim())
        }
      }
    }

    deepStrictEqual(offenders, [],
      'import the module by name — @import("voxgig-struct") — rather than ' +
      'reaching into utility/voxgigstruct/ by path')
  })


  test('the runner still has a regex path', () => {
    // Originally this read the hand-written struct_runner.zig, which owned
    // the /pattern/ branch. That file is retired: the engine is vendored
    // omni now, and the regex path is ITS regex path. Same risk, new home —
    // losing the call would leave every /pattern/ corpus check falling
    // through to a substring comparison and quietly passing.
    const src = readFileSync(
      Path.join(TM, 'zig', 'test', 'vendor', 'omni', 'omni.zig'), 'utf8')

    ok(/regex\.(find|match|test)/.test(src),
      'the vendored omni zig port lost its regex match — /pattern/ checks ' +
      'would degrade to a substring comparison and still look green')
  })
})
