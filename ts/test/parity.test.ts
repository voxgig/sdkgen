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


// Targets that are not language SDKs: they CONSUME another target's SDK
// (go-cli/go-mcp consume `go`; py-data consumes `py`; seneca-provider
// consumes `ts`, and is the one that generates into its OWN repo) and switch
// the standard generation phases off, so they have no primary-utility surface
// of their own. Their own behaviour is covered by their generated tests, not by
// the cross-language corpus.
const NON_SDK_TARGETS = ['go-cli', 'go-mcp', 'py-data', 'seneca-provider']


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
  'c', 'clojure', 'cpp', 'csharp', 'dart', 'elixir', 'go', 'haskell', 'java',
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

  // Paging is a separate hook and drifted separately: the kind branch clears
  // spec.query, so a REST-only paging feature writes cursor/limit into a
  // query string that is then discarded, and reads only top-level body
  // cursors — so a Relay connection stops after page one.
  //
  // lean is exempt: its paging feature stamps size/page and counts pages,
  // with no cursor pagination, Link header or hasMore for REST either, so
  // there is no branch to mirror without first porting the REST feature.
  const NO_CURSOR_PAGING = ['lean']

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
const NO_RAW_ACCESS = ['lean']

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
    // Match a call OR an ML-style signature — haskell declares
    // `direct :: Client -> Value -> IO Value` and no paren ever appears, so
    // a call-syntax regex silently cleared a target whose escape hatch was
    // wide open.
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
// A target whose config is a process-wide singleton MUST clone the config
// side before merging client options into it. `merge([{}, cfgopts, opts])`
// uses cfgopts' nested maps as merge TARGETS, so without the clone the first
// client's options (headers, server, ...) are written into the shared config
// and inherited by every client constructed afterwards.
//
// ts/js carried this guard from the day their config became a module
// singleton. go/py/rb/lua only became singletons when L2 landed, and the
// omission was a silent cross-client data leak until then.
const CLONES_CFGOPTS = ['go', 'js', 'lua', 'py', 'rb', 'ts']

// php needs no clone: its arrays are copy-on-write value types, so merge
// cannot reach the shared config through them.
const CFGOPTS_VALUE_SEMANTICS = ['php']


// The target's make_options template, whatever the language calls it.
function makeOptionsFile(lang: string): string | undefined {
  const found: string[] = []
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
    }
  }
  walk(Path.join(TM, lang))
  return found.sort()[0]
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
    if (/shared_config|SharedConfig|config_shared/.test(src)) {
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

      // The merge statement itself must clone — a clone anywhere else in the
      // file (opts, mergeOptions) does not protect the config side.
      const merge = src.split('\n').find(
        (l) => /merge/i.test(l) && /cfgopts/i.test(l))
      ok(undefined !== merge,
        `${lang}: no line merges cfgopts — did make_options change shape?`)
      ok(/clone\s*\(\s*\$?cfgopts/i.test(merge as string),
        `${lang}: make_options merges the SHARED config without cloning it:\n` +
        `  ${(merge as string).trim()}\n` +
        'One client\'s options will contaminate every client built after it.')
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
  ]

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
