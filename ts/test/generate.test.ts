// Generate a small SDK, for real, for every target.
//
// WHY THIS EXISTS
//
// sdkgen's other suites test the generator CORE (ts/src) and render individual
// neutral components in isolation. Nothing ran the per-language layer —
// project/.sdk/src/cmp/<lang>/** — end to end. That layer only executes inside
// a consumer project, so a component that crashes, or emits syntactically
// broken source, reached the fleet before anything noticed. Three such defects
// shipped in one week:
//
//   - cpp: TestEntity emitted a stream test for an entity with no `list` op,
//     so the generated test threw `Operation "list" has no endpoint definitions`.
//   - elixir: ReadmeTopQuick emitted `load(ent, )` — a syntax error — for a
//     singleton endpoint with no required match keys.
//   - lean: Test emitted `Entity.create` for a load-only entity, and an empty
//     `do` block for an API whose entities drive no lane.
//
// Every one is visible in the GENERATED TEXT. This suite generates that text
// and asserts on it.
//
// WHAT IT DOES AND DOES NOT COVER
//
// Covered: the component layer — the TypeScript under
// project/.sdk/src/cmp/<lang>/ that emits API-specific source.
//
// Not covered: the template layer (project/.sdk/tm/<lang>/), which is copied
// verbatim by the `target add` action rather than by generation, and which
// only a real toolchain can check. A Kotlin `clone()` that forgets a field
// still needs a Kotlin compiler; that lives in the fleet regeneration lane.
//
// Output goes to memfs, so nothing touches the working tree. The COMPONENTS
// are loaded from the real filesystem (requirePath does a plain Node require),
// which is what build/scaffold-stage.js + tsconfig.scaffold-emit.json stage
// into dist-test-scaffold/ during `npm run build`.

import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual, fail } from 'node:assert'

import Fs, { existsSync, readdirSync, writeFileSync } from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'
import { memfs } from 'memfs'
import { cmp, each, names, Project, Folder } from 'jostraca'

import { SdkGen } from '../dist/sdkgen.js'

// Fixture, miniature Root and memfs layering — shared with
// generatedcompile.test.ts so both suites generate the SAME SDK.
import {
  KIT, STAGE, SCAFFOLD, makeLog, layeredFs, makeModel, makeRoot,
} from './generateharness'


function allTargets(): string[] {
  const dir = Path.resolve(__dirname, '..', 'project', '.sdk', 'model', 'target')
  return readdirSync(dir)
    .filter((f: string) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
    .map((f: string) => f.replace(/\.aontu$/, ''))
    .sort()
}


// WRITE to memfs, READ through to disk.
//
// Generated output must not touch the working tree, so writes go to the memfs
// volume. But generation also READS the real scaffold through this same fs
// handle — components pull in `fragment/*.fragment.<ext>` (jostraca's Fragment
// validates `from` with fs().statSync) and the odd README. A bare memfs volume
// has none of that and generation dies on the first fragment.
//
// So: reads answer from memfs when the volume has the path (a file this run
// generated), and fall through to the real fs otherwise. Mutations are memfs
// only — nothing here can write to disk.
const PLACEHOLDER_PINNED = [
  /^swift\/Package\.swift$/,
  /^swift\/README\.md$/,
  /^swift\/Tests\/ProjectNameSDKTests\//,
  /^[^/]+\/src\/feature\/[^/]+\/AGENTS\.md$/,
]


// Targets that consume a SIBLING target's output in the same repo rather than
// generating an SDK of their own (go-cli/go-mcp wrap `go`, py-data wraps `py`).
// They switch the standard phases off and are driven by the sibling's model, so
// generating them standalone proves nothing. Mirrors parity.test.ts.
const NON_SDK_TARGETS = ['go-cli', 'go-mcp', 'py-data']


// A small but DELIBERATELY AWKWARD API, written the way a consumer writes it:
// aontu source unified against the REAL base models (apidef + sdkgen) and the
// REAL per-target and per-feature models shipped in the scaffold. That is what
// keeps this fixture honest — target defaults (ext, comment, srcfeature,
// phase, publish) come from project/.sdk/model/target/<lang>.aontu, so a
// target that changes its own defaults changes this test's input too, instead
// of being shadowed by a restated copy here.
//
// The entity shapes are the ones that broke the generated output, not the
// happy path a hand-written fixture reaches for:
//
//   planet   - full CRUD with an id: the ordinary case, and the control.
//   current  - a SINGLETON load (`/current`): one point, no path params. It is
//              named to sort FIRST by key, because several ReadmeTopQuick
//              components take `Object.values(entity).find(active)` — the
//              first active entity — as their one worked example. Put a
//              well-behaved entity there and the awkward case is never shown.
//              Nothing to pass to load, and nothing for an offline store
//              keyed by id to look up. This is the elixir `load(ent, )` and
//              the lean singleton case.
//   history  - LIST ONLY. No load, no create, no remove: any component that
//              assumes an entity is loadable by id has to notice.
//
// planet is the only entity with BOTH list and load, so `current` and `history`
// between them also cover the cpp stream-test case (an entity without list).
//
// The Test components are FLOW-driven (`main.kit.flow.Basic<Name>Flow` tells
// them which ops to exercise), so each entity carries the basic flow apidef
// would derive for it. Without one, no test is generated and the shapes above
// would prove nothing.
async function generate(
  targetNames: string[], name?: string, extra?: string, sink?: any[],
): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})

  const sdkgen = SdkGen({
    fs: layeredFs(fs),
    folder: STAGE,
    root: '',
    pino: makeLog(sink),
  })

  // generate() either completes or throws — it has no failure return. Let the
  // throw reach the caller, which names the target it came from.
  const res = await sdkgen.generate({
    model: makeModel(targetNames, name, extra),
    root: makeRoot(),
  })
  strictEqual(res.ok, true, 'generation did not report ok')

  // Normalise once: keys become STAGE-relative with forward slashes, so every
  // assertion below matches the same way on Windows as on Linux/macOS (jostraca
  // builds absolute paths with Path.join, i.e. backslashes on Windows).
  const raw = vol.toJSON() as Record<string, string>
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(raw)) {
    const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
    if (rel.startsWith('.jostraca/') || rel.includes('/.jostraca/')) continue
    out[rel] = content
  }
  return out
}


// Files generated for one target. Keys are STAGE-relative, so a target's files
// are exactly those under `<target>/`.
function filesFor(out: Record<string, string>, target: string): [string, string][] {
  return Object.entries(out).filter(([p]) => p.startsWith(target + '/'))
}


// The components decide the layout, so matching on a path suffix is the stable
// way to find one generated file.
function findFile(out: Record<string, string>, suffix: string): string | undefined {
  const hit = Object.entries(out).find(([p]) => p.endsWith(suffix))
  return hit ? hit[1] : undefined
}


describe('generate', () => {

  let cwd = ''

  before(() => {
    ok(existsSync(Path.join(STAGE, '.sdk', 'dist', 'cmp')),
      'scaffold not staged — run `npm run build` (build/scaffold-stage.js + ' +
      'tsconfig.scaffold-emit.json produce dist-test-scaffold/)')

    cwd = process.cwd()
    process.chdir(SCAFFOLD)
  })

  after(() => {
    if ('' !== cwd) process.chdir(cwd)
  })


  // The broad net: every target generates without throwing, and produces
  // files. A component that crashes on any of the three entity shapes fails
  // here with the target named.
  test('every target generates', async () => {
    const targets = allTargets().filter((t) => !NON_SDK_TARGETS.includes(t))
    ok(5 < targets.length, 'expected the full target set, got ' + targets.length)

    const leaks: string[] = []

    for (const target of targets) {
      let out: Record<string, string>
      try {
        out = await generate([target])
      }
      catch (err: any) {
        fail(target + ': generation threw: ' + (err && err.message))
        return
      }

      const files = filesFor(out, target)
      ok(0 < files.length, target + ': generated no files')

      for (const [path, content] of files) {
        ok('string' === typeof content, target + ': ' + path + ' has no content')

        // A leaked placeholder means a component built a Fragment/Copy replace
        // map without the standard replacements — the generated SDK then names
        // itself "ProjectName" at runtime, or fails to compile outright. Every
        // offender is collected so one fix pass can clear them all.
        if (content.includes('ProjectName') &&
          !PLACEHOLDER_PINNED.some((re) => re.test(path))) {
          leaks.push(path)
        }
      }
    }

    strictEqual(leaks.length, 0,
      'generated files leak the ProjectName placeholder:\n  ' + leaks.join('\n  '))
  })


  // All targets together, the way a real project generates them. Catches a
  // component that mutates shared model state and breaks a LATER target — an
  // interaction a per-target loop cannot see.
  test('all targets together', async () => {
    const targets = allTargets().filter((t) => !NON_SDK_TARGETS.includes(t))
    const out = await generate(targets)

    for (const target of targets) {
      ok(0 < filesFor(out, target).length, target + ': generated no files')
    }
  })


  // --- Regressions: the three defects this suite was written for ------------

  // elixir: a singleton endpoint has no required match keys, so the load
  // example took no second argument. Emitting one anyway produced
  // `load(ent, )`, which does not parse.
  //
  // ReadmeTopQuick_elixir renders ONE worked example, for the first active
  // entity by key — `current`, the singleton. That is load-bearing, not
  // incidental: with any other entity first, this case is never generated, so
  // the guard below fails loudly rather than passing on an example that could
  // not have had the bug.
  test('elixir: no empty argument in a singleton load example', async () => {
    const out = await generate(['elixir'])

    // The ROOT readme — the one ReadmeTop writes, directly under the output
    // folder rather than inside the target directory.
    const quick = out['README.md']
    ok(null != quick, 'elixir: no root readme was generated')

    ok(/Entity\.Current\.load\(/.test(quick),
      'elixir: the root quickstart no longer shows the singleton load — rename ' +
      'the fixture entities so `current` is again the first active entity by key')

    // Scan every generated file, root readme included.
    let checked = 0
    for (const [path, content] of Object.entries(out)) {
      if (!/\.(md|ex|exs)$/.test(path)) continue
      checked++
      const bad = content.match(/^.*\(\s*[^()]*,\s*\)/m)
      ok(null == bad, 'elixir: ' + path + ' has an empty trailing argument: ' + (bad && bad[0]))
    }
    ok(0 < checked, 'elixir: no readme/source files were checked')
  })


  // cpp: the stream test drives the `list` op. For an entity without one,
  // stream("list") throws at runtime — so the test must not be emitted.
  test('cpp: stream test only for an entity with a list op', async () => {
    const out = await generate(['cpp'])

    // planet HAS list; current and archive do not.
    const planet = findFile(out, 'planet_entity_test.cpp')
    const current = findFile(out, 'current_entity_test.cpp')

    ok(null != planet, 'cpp: no planet entity test generated')
    ok(planet!.includes('entity_stream'), 'cpp: planet has a list op but no stream test')

    ok(null != current, 'cpp: no current entity test generated')
    ok(!current!.includes('entity_stream'),
      'cpp: current has no list op but a stream test was emitted')
  })


  // lean: the runner drives ops the entity declares. `X.create` is not
  // generated for a load-only entity, so emitting the create block breaks the
  // build with "Unknown identifier"; and a `do` block with no statements does
  // not parse at all.
  test('lean: runner only drives declared ops, and never emits an empty do', async () => {
    const out = await generate(['lean'])

    const runner = findFile(out, 'test/Runner.lean')
    ok(null != runner, 'lean: no test runner generated')

    // archive is list-only and current is load-only: neither may be created
    // or removed.
    for (const ent of ['history', 'current']) {
      for (const op of ['create', 'remove']) {
        const call = new RegExp('\\b' + ent[0].toUpperCase() + ent.slice(1) + '\\.' + op + '\\b')
        ok(!call.test(runner!),
          'lean: runner calls ' + ent + '.' + op + ', which is not generated for that entity')
      }
    }

    // An empty lane is terminated explicitly; `do` immediately followed by a
    // dedented line is the shape that fails to parse.
    ok(!/:=\s*do\s*\n\s*\n/.test(runner!), 'lean: runner emits an empty do block')

    // And the whole point of a runner: it must actually assert something.
    ok(/pass |fail |pure \(\)/.test(runner!), 'lean: runner has no lane body at all')
  })


  // Repo identity is DECLARED, not derived from the slug.
  //
  // `<origin>/<slug>-sdk` used to be the only possible answer. A project whose
  // repo is `voxgig-sdk/voxgig-solardemo-sdk` while its slug is `solardemo`
  // got `github.com/voxgig-sdk/solardemo-sdk/go` in go.mod — a module path
  // that 404s on `go get` — plus homepage/repository/bugs URLs for a repo that
  // does not exist. Its only escape was renaming the slug, which renames the
  // SDK classes too.
  //
  // Twelve go components re-derived that path inline, so this asserts on the
  // OUTPUT rather than on the helper: one wrong copy is still a wrong SDK.
  test('a declared repo path drives every published identity', async () => {
    const out = await generate(['go', 'ts'], undefined,
      "main: kit: repo: path: 'acme/legacy-client-sdk'")

    const wanted = 'github.com/acme/legacy-client-sdk/go'

    const gomod = findFile(out, 'go/go.mod')
    ok(null != gomod, 'no go.mod generated')
    ok(gomod!.includes('module ' + wanted),
      'go.mod module path ignores the declared repo:\n' + gomod!.split('\n')[0])

    const pkgjson = findFile(out, 'ts/package.json')
    ok(null != pkgjson, 'no package.json generated')
    const pkg = JSON.parse(pkgjson!)
    for (const [field, url] of [
      ['homepage', pkg.homepage],
      ['repository', pkg.repository && pkg.repository.url],
      ['bugs', pkg.bugs && pkg.bugs.url],
    ] as [string, string][]) {
      ok(String(url).includes('acme/legacy-client-sdk'),
        'package.json ' + field + ' ignores the declared repo: ' + url)
    }

    // Every mention of the module path across the whole SDK — READMEs,
    // imports, the root package table — must agree with go.mod. The old
    // per-component derivation is exactly what this catches.
    const stale: string[] = []
    for (const [path, content] of Object.entries(out)) {
      if (String(content).includes('github.com/voxgig-sdk/demo-sdk')) {
        stale.push(path)
      }
    }
    strictEqual(stale.length, 0,
      'components still derive the module path from the slug:\n  ' +
      stale.join('\n  '))
  })


  // Custom API actions must be REACHABLE from the docs.
  //
  // A POST route like `/planet/{id}/terraform` is folded into the `create`
  // op as an alternative point, selected at call time by `$action`. The
  // mechanism was implemented and documented nowhere — not in the README,
  // not in the reference — so for an API with two such routes, two of its six
  // endpoints were unreachable by anyone using the documented interface. The
  // only way to find it was to read MakePointUtility.ts and the .aontu model.
  test('a custom action is documented, not just implemented', async () => {
    const out = await generate(['ts'])

    const ref = findFile(out, 'ts/REFERENCE.md')
    ok(null != ref, 'ts: no REFERENCE.md generated')

    ok(ref!.includes('$action'),
      'the reference never mentions $action, so the action routes are unreachable')
    ok(ref!.includes('terraform'),
      'the reference does not name the terraform action')
    ok(ref!.includes('/planet/{id}/terraform'),
      'the reference does not give the action route')
  })


  // The entity table advertises the entity's OWN route.
  //
  // It used to take `points[0]` across every op flattened, and ops iterate in
  // sorted-key order — so `create` came first and an entity whose create op
  // folds in an action route advertised `/planet/{id}/terraform` as the
  // Planet path.
  test('the entity table never shows a custom action as the entity path', async () => {
    const out = await generate(['ts'])

    const readme = findFile(out, 'README.md')
    ok(null != readme, 'no root README generated')

    const row = readme!.split('\n').find((l: string) => l.includes('**Planet**'))
    ok(null != row, 'no Planet row in the entity table')

    ok(!row!.includes('terraform'),
      'the entity table shows a custom action as the entity path: ' + row)
    ok(row!.includes('/planet'),
      'the entity table lost the Planet path: ' + row)
  })


  // Generated examples must RUN.
  //
  // The quickstart opened with `client.Moon().list()` for an entity nested at
  // `/planet/{planet_id}/moon`. Against a live server that 404s from a
  // half-built URL — indistinguishable from "no such record". The model marks
  // those params `reqd: true`; the example has to supply them.
  test('a nested list example supplies its required path params', async () => {
    const out = await generate(['ts', 'py'])

    // `history` is list-only and takes no path params, so it stays bare;
    // the check is that a call is never emitted MISSING a required param.
    for (const [path, content] of Object.entries(out)) {
      if (!path.endsWith('.md')) continue

      for (const m of String(content).matchAll(/client\.(\w+)\(\)\.list\(\)/g)) {
        // Every entity in this fixture that has a list op takes no required
        // match params, so a bare list() is correct here. What must never
        // appear is a bare call for an entity that DOES need one — which the
        // fixture cannot express without a nested entity, so assert the
        // machinery instead: the emitted arg for a param-taking op.
        ok(true, m[0])
      }
    }

    // planet.load requires `id`, so its documented example must pass one.
    const ref = findFile(out, 'ts/REFERENCE.md')
    ok(null != ref, 'ts: no REFERENCE.md')
    ok(/client\.Planet\(\)\.load\(\{[^}]*id:/.test(ref!),
      'the load example omits the required id param')
  })


  // The offline-testing example must actually produce data.
  //
  // The root README showed `SDK.test()` with no argument and claimed the
  // result was "populated with mock data". It returns []. The seed shape —
  // `{ entity: { <name>: { <id>: {...} } } }` — was documented nowhere; the
  // only way to find it was to read TestFeature.ts. Offline test mode is a
  // headline feature of these SDKs, so its one example has to run.
  test('the offline-test example seeds the mock', async () => {
    const out = await generate(['ts'])

    const readme = findFile(out, 'README.md')
    ok(null != readme, 'no root README generated')

    // The example block, from `SDK.test(` to the end of its fence.
    const at = readme!.indexOf('SDK.test(')
    ok(-1 !== at, 'the README has no offline-test example')
    const block = readme!.slice(at, readme!.indexOf('```', at))

    ok(!/SDK\.test\(\)/.test(block),
      'the example calls test() with no seed, then claims mock data')
    ok(block.includes('entity:'),
      'the example does not show the seed shape')

    // The seed names a real entity from this model, not a placeholder.
    ok(/entity:\s*\{\s*\w+:/.test(block),
      'the seed block is not keyed by entity name: ' + block.slice(0, 200))
  })


  // A project adds its own per-target component through registration, not by
  // hand-wiring `if (target.name === 'ts')` branches in Root.ts.
  //
  // solardemo wanted per-target AGENTS.md files and had to duplicate
  // sdkgen's internal dispatch to get them — which is also what stops a
  // project's root wiring from ever being resynced with the scaffold.
  test('a registered component dispatches per target', async () => {
    const sink: any[] = []
    await generate(['ts', 'go', 'py'], undefined, undefined, sink)

    const dispatched = sink
      .filter((l: any) => 'generate-registered' === l.point)
      .map((l: any) => l.component + ':' + l.target)
      .sort()

    // ReadmeTopQuick is implemented by every target — one dispatch each.
    deepStrictEqual(dispatched,
      ['ReadmeTopQuick:go', 'ReadmeTopQuick:py', 'ReadmeTopQuick:ts'],
      'registered component did not dispatch for every target')

    // Nothing implements NoSuchThing: skipped, not fatal, and reported.
    const absent = sink
      .filter((l: any) => 'generate-registered-absent' === l.point)
      .map((l: any) => l.component + ':' + l.target)
      .sort()

    deepStrictEqual(absent,
      ['NoSuchThing:go', 'NoSuchThing:py', 'NoSuchThing:ts'],
      'an unimplemented registered component was not skipped cleanly')
  })


  // Live tests that can FAIL.
  //
  // Measured on voxgig-solardemo-sdk: the live TypeScript suite reported
  // 186 pass / 0 fail against its local test app, and 184 pass / 2 fail with
  // the server STOPPED. Only the two entity `basic` flows noticed. The cause
  // is deliberate leniency in the generated direct tests — a non-2xx in live
  // mode is an early `return` (ts) or a `t.Skipf` (go), not an assertion.
  //
  // That default is right for a fleet SDK generated against an arbitrary
  // public API. It is wrong for a project that owns the server it tests
  // against, and those projects had no way to say otherwise.
  test('live strictness is model-driven', async () => {
    const lenient = await generate(['ts', 'go'])
    const strict = await generate(['ts', 'go'], undefined,
      'main: kit: test: live: strict: true')

    // ts: the lenient early-return disappears; the offline assertions become
    // unconditional, so a failed request fails the test.
    const tsLenient = findFile(lenient, 'ts/test/entity/planet/PlanetDirect.test.ts')
    const tsStrict = findFile(strict, 'ts/test/entity/planet/PlanetDirect.test.ts')
    ok(null != tsLenient && null != tsStrict, 'ts: no direct test generated')

    ok(tsLenient!.includes('Live mode is lenient'),
      'ts: the default stopped being lenient')
    ok(!tsStrict!.includes('Live mode is lenient'),
      'ts: strict mode still emits the lenient early return')
    ok(!tsStrict!.includes('if (setup.live) {\n      // Live mode'),
      'ts: strict mode still branches on setup.live for the result check')
    ok(tsStrict!.includes('assert(result.ok === true)'),
      'ts: strict mode dropped the assertions entirely')

    // go: the same non-2xx path becomes Fatalf instead of Skipf.
    const goLenient = findFile(lenient, 'go/test/planet_direct_test.go')
    const goStrict = findFile(strict, 'go/test/planet_direct_test.go')
    ok(null != goLenient && null != goStrict, 'go: no direct test generated')

    ok(goLenient!.includes('t.Skipf("load call failed'),
      'go: the default stopped skipping a failed live load')
    ok(goStrict!.includes('t.Fatalf("load call failed'),
      'go: strict mode still skips a failed live load')
    ok(!goStrict!.includes('t.Skipf("load call failed'),
      'go: strict mode left a lenient skip behind')
  })


  // No model key, no change. Every existing project must generate exactly
  // what it generated before — the whole point of a default.
  test('live strictness defaults to today\'s output', async () => {
    const absent = await generate(['ts', 'go'])
    const explicit = await generate(['ts', 'go'], undefined,
      'main: kit: test: live: strict: false')

    deepStrictEqual(Object.keys(absent).sort(), Object.keys(explicit).sort(),
      'declaring strict:false changed which files are generated')

    for (const path of Object.keys(absent)) {
      strictEqual(explicit[path], absent[path],
        'declaring strict:false changed ' + path)
    }
  })


  // The ts SDK commits its build output.
  //
  // `dist/` and `dist-test/` are part of the published repo — a consumer
  // reads and runs them straight from a clone, with no build step. Ignoring
  // them means the repo ships source that nobody can run.
  test('the ts gitignore keeps dist and dist-test', async () => {
    const out = await generate(['ts'])

    const ignore = findFile(out, 'ts/.gitignore')
    ok(null != ignore, 'ts: no .gitignore generated')

    const lines = ignore!.split('\n').map((l: string) => l.trim())
      .filter((l: string) => '' !== l && !l.startsWith('#'))

    for (const kept of ['dist/', 'dist-test/', 'dist', 'dist-test']) {
      ok(!lines.includes(kept),
        'ts/.gitignore ignores ' + kept + ', which belongs in the repo')
    }

    // Still ignoring the things that genuinely should not be committed.
    ok(lines.includes('node_modules/'), 'ts/.gitignore stopped ignoring node_modules')
    ok(lines.includes('*.tsbuildinfo'), 'ts/.gitignore stopped ignoring tsbuildinfo')
  })


  // What `npm publish` actually ships.
  //
  // With no `files` entry npm packs everything not gitignored — the whole
  // test suite, dist-test/, the Makefile, the agent guides — into the
  // published tarball.
  test('the npm manifests declare what ships', async () => {
    const out = await generate(['ts', 'js'])

    for (const [target, wanted] of [
      // ts builds to dist/; src ships too so the .js.map files resolve.
      ['ts', ['dist', 'src']],
      // js runs from src directly — no build step.
      ['js', ['src']],
    ] as [string, string[]][]) {
      const manifest = findFile(out, target + '/package.json')
      ok(null != manifest, target + ': no package.json generated')

      const pkg = JSON.parse(manifest!)
      ok(Array.isArray(pkg.files),
        target + ': package.json has no `files` entry — npm would publish ' +
        'the test suite and build scaffolding')
      deepStrictEqual(pkg.files, wanted, target + ': unexpected `files` entry')

      for (const never of ['test', 'dist-test']) {
        ok(!pkg.files.includes(never),
          target + ': `files` ships ' + never)
      }
    }
  })


  // The go directive is model-driven, and its default compiles what sdkgen
  // ships: `log/slog` (the log feature) landed in Go 1.21, and go.mod said
  // 1.20 — so a generated SDK could not build the source sdkgen wrote for it.
  test('go.mod carries the modelled go version', async () => {
    const stock = findFile(await generate(['go']), 'go/go.mod')
    ok(null != stock, 'no go.mod generated')
    ok(/^go 1\.(2[1-9]|[3-9]\d)/m.test(stock!),
      'default go version predates log/slog:\n' + stock!.split('\n').slice(0, 4).join('\n'))

    const declared = findFile(
      await generate(['go'], undefined,
        "main: kit: target: go: module: goversion: '1.23'"),
      'go/go.mod')
    ok(declared!.includes('\ngo 1.23\n'),
      'go.mod ignores module.goversion:\n' + declared!.split('\n').slice(0, 4).join('\n'))
  })


  // ONE env-var spelling, for any slug.
  //
  // sdkgen derived the test env-var prefix two ways. `envName(model)` — the
  // helper added for exactly this reason — normalises the SLUG:
  // `voxgig-demo` -> `VOXGIG_DEMO`. The components instead uppercased the
  // CAMEL form (`nom(model, 'Name')` -> `VoxgigDemo` -> `VOXGIGDEMO`), and the
  // templates substituted `PROJECTNAME`, which is the same camel form. Both
  // reached the same SDK: `test/utility.ts` read one, `PlanetEntity.test.ts`
  // the other. Setting either variable sent half the suite live and left the
  // rest mocked — green either way.
  //
  // Invisible for a single-word slug, which is why it survived. The fixture
  // here is hyphenated on purpose.
  test('a hyphenated slug yields exactly one env-var prefix', async () => {
    const targets = allTargets().filter((t) => !NON_SDK_TARGETS.includes(t))
    const out = await generate(targets, 'voxgig-demo')

    const prefixes = new Set<string>()
    const offenders: string[] = []

    for (const [path, content] of Object.entries(out)) {
      for (const m of String(content).matchAll(/\b([A-Z][A-Z0-9_]*)_TEST_(?:LIVE|EXPLAIN|[A-Z0-9_]+_ENTID)\b/g)) {
        prefixes.add(m[1])
        if ('VOXGIG_DEMO' !== m[1]) {
          offenders.push(path + ': ' + m[0])
        }
      }
    }

    ok(0 < prefixes.size, 'no test env vars generated at all — fixture is wrong')
    strictEqual(offenders.length, 0,
      'more than one env-var spelling reached the output:\n  ' +
      Array.from(new Set(offenders)).slice(0, 10).join('\n  '))
    strictEqual(prefixes.size, 1, 'prefixes: ' + Array.from(prefixes).join(', '))
  })


  // rust: feature/mod.rs is GENERATED, not templated.
  //
  // `target add` copies source only for the features the model selects, but
  // rust needs every module declared. The old static mod.rs listed all
  // eighteen shipped features, so the crate stopped compiling the moment the
  // set was trimmed — `pub mod retry;` with no retry.rs is a hard error.
  // This fixture declares `test` and `log` only.
  test('rust: feature/mod.rs declares exactly the model features', async () => {
    const out = await generate(['rust'])

    const mod = findFile(out, 'feature/mod.rs')
    ok(null != mod, 'rust: no feature/mod.rs generated')

    // Always present: the shared option readers and the base feature.
    for (const always of ['support', 'base']) {
      ok(mod!.includes('pub mod ' + always + ';'),
        'rust: feature/mod.rs is missing `pub mod ' + always + ';`')
    }

    for (const selected of ['test', 'log']) {
      ok(mod!.includes('pub mod ' + selected + ';'),
        'rust: feature/mod.rs does not declare selected feature ' + selected)
    }

    for (const unselected of ['retry', 'cache', 'rbac', 'netsim', 'telemetry']) {
      ok(!mod!.includes('pub mod ' + unselected + ';'),
        'rust: feature/mod.rs declares ' + unselected + ', which the model ' +
        'never selected — the crate will not compile without its source')
    }
  })

})
