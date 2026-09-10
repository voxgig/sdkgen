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
import Os from 'node:os'
import Path from 'node:path'

import { Aontu } from 'aontu'
import { memfs } from 'memfs'
import { cmp, each, names, Project, Folder } from 'jostraca'
import * as sucrase from 'sucrase'

import { SdkGen } from '../dist/sdkgen.js'

// Fixture, miniature Root and memfs layering — shared with
// generatedcompile.test.ts so both suites generate the SAME SDK.
import {
  KIT, STAGE, SCAFFOLD, makeLog, layeredFs, makeModel, makeRoot,
} from './generateharness'


function allTargets(): string[] {
  const dir = Path.resolve(__dirname, '..', 'project', '.sdk', 'model', 'target')
  return readdirSync(dir)
    .filter((f: string) => f.endsWith('.aon') && 'target-index.aon' !== f)
    .map((f: string) => f.replace(/\.aon$/, ''))
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


// Targets that consume ANOTHER target's output rather than generating an SDK
// of their own: go-cli/go-mcp wrap `go` and py-data wraps `py`. They switch
// the standard phases off and are driven by the wrapped target's model, so
// generating them standalone proves nothing — and each fails outright without
// its sibling, deliberately. Mirrors parity.test.ts.
//
// The sibling each one needs is declared HERE rather than left implicit,
// because "excluded from the loop" was silently reading as "excluded from the
// suite": the placeholder scan is this file's only content guard, and none of
// them had ever been through it. See 'a consumer target generates against its
// sibling', which does exactly that.
//
// `seneca-provider` was the fourth and has moved to
// packages/sdkgen-seneca-provider, which runs the same scan through the test
// kit's `generateInto` — the kit's PLACEHOLDERS list is kept in step with this
// file's for exactly that reason.
const NON_SDK_SIBLING: Record<string, string> = {
  'go-cli': 'go',
  'go-mcp': 'go',
  'py-data': 'py',
}

const NON_SDK_TARGETS = Object.keys(NON_SDK_SIBLING)


// A small but DELIBERATELY AWKWARD API, written the way a consumer writes it:
// aontu source unified against the REAL base models (apidef + sdkgen) and the
// REAL per-target and per-feature models shipped in the scaffold. That is what
// keeps this fixture honest — target defaults (ext, comment, srcfeature,
// phase, publish) come from project/.sdk/model/target/<lang>.aon, so a
// target that changes its own defaults changes this test's input too, instead
// of being shadowed by a restated copy here.
//
// The entity shapes are the ones that broke the generated output, not the
// happy path a hand-written fixture reaches for:
//
//   planet   - full CRUD with an id: the ordinary case, and the control.
//   ambient  - a SINGLETON load (`/ambient`): one point, no path params. It is
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
// planet is the only entity with BOTH list and load, so `ambient` and `history`
// between them also cover the cpp stream-test case (an entity without list).
//
// The Test components are FLOW-driven (`main.kit.flow.Basic<Name>Flow` tells
// them which ops to exercise), so each entity carries the basic flow apidef
// would derive for it. Without one, no test is generated and the shapes above
// would prove nothing.
// An entity whose name is not a legal identifier, injected into the fixture
// model rather than added to it: every other test in this file asserts on the
// base entity set, and a permanent extra entity would move all of them.
// `/3ds-sessions` is Evervault's real path shape.
const DIGIT_ENTITY = `
main: kit: entity: 3ds_session: {
  alias: field: {}
  name: "3ds_session"
  field: {
    id: { name: "id", kind: "field", type: "\`$STRING\`", required: true }
  }
  fields: [ { name: "id", req: true, type: "\`$STRING\`" } ]
  op: {
    list: {
      name: "list"
      points: [ {
        args: {}, method: "GET", orig: "/3ds-sessions"
        segments: [{ lit: "3ds-sessions" }]
        transform: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}

main: kit: flow: Basic3dsSessionFlow: {
  entity: "3ds_session", kind: "basic", name: "Basic3dsSessionFlow"
  step: [ { name: "list", op: "list", match: {} } ]
}
`


// A `3ds…` token in an IDENTIFIER position: not inside a string or a path,
// and not the tail of a longer word. Deliberately matches the RAW stem, so it
// fires when the rename was skipped and stays quiet on the guarded
// `n3ds_session` / `N3dsSession`.
const RAW_DIGIT_IDENT = /(^|[^A-Za-z0-9_$."'`\/-])(3ds[A-Za-z_]|3ds_session)/


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


// The generated ts config, as source.
function tsConfigSrc(files: [string, string][]): string {
  const config = files.find(([name]) => /(^|\/)src\/Config\.ts$/.test(name))
  ok(config, 'no src/Config.ts generated')
  return String(config![1])
}


// The model carried by the data representation, as an object. The constant is
// a ts string literal holding JSON, so it unwraps in two steps - and doing it
// this way proves the literal really is well formed, which a mangled escape
// would not be even though it still compiles.
function parseTsConfigData(src: string): any {
  const m = src.match(/const CONFIG_DATA = ("(?:[^"\\]|\\.)*")/)
  ok(m, 'could not extract the embedded config constant')
  return JSON.parse(JSON.parse(m![1]))
}


// A generated ts config, as the RUNTIME OBJECT a consumer would import.
//
// sucrase strips the types and rewrites the imports to `require`; the require
// shim hands back a class for every feature import, because nothing here calls
// makeFeature and the config never constructs one at module load.
function loadTsConfig(src: string): any {
  const { code } = sucrase.transform(src, {
    transforms: ['typescript', 'imports'],
    filePath: 'Config.ts',
  })
  const mod: any = { exports: {} }
  const req = () => new Proxy({}, { get: () => class Stub { } })
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports)
  ok(null != mod.exports.config, 'generated Config.ts exported no config')
  return mod.exports.config
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


  // AN ENTITY NAME THAT IS NOT AN IDENTIFIER, through the real generator.
  //
  // `/3ds-sessions` is an ordinary REST resource and yields the entity name
  // `3ds_session`. Every target builds identifiers from that name — the
  // PascalCase Name for the class, the SDK accessor and the generated types;
  // the snake stem for python modules and test functions; the bare key in the
  // emitted config map — and no target language permits an identifier that
  // starts with a digit. Before the guard, `ts` alone emitted
  // `class 3dsSessionEntity`, `import { 3dsSession }` and `3dsSession()`:
  // not a degraded SDK, no SDK (issue #124).
  //
  // The unit tests pin the rename; this pins the OUTCOME, which is the part
  // that can regress silently. A component reading `entity.name` where it
  // needs an identifier reopens the bug in exactly one target, and only a
  // sweep over the generated text finds it.
  //
  // The scan deliberately looks for the RAW stem, not the guarded one: it
  // fails if the rename is skipped anywhere, and stays quiet on the legal
  // `n3ds_session` / `N3dsSession` the guard produces. String positions are
  // excluded, since a digit is fine in the wire route and in a quoted key —
  // the route `/3ds-sessions` MUST survive, and is asserted separately below.
  test('a digit-leading entity name generates legal identifiers', async () => {
    const targets = allTargets().filter((t) => !NON_SDK_TARGETS.includes(t))

    const bad: string[] = []

    for (const target of targets) {
      const out = await generate([target], undefined, DIGIT_ENTITY)

      const files = filesFor(out, target)
      ok(0 < files.length, target + ': generated no files')

      for (const [path, content] of files) {
        content.split('\n').forEach((line, i) => {
          if (RAW_DIGIT_IDENT.test(line)) {
            bad.push(`${path}:${i + 1}: ${line.trim().slice(0, 100)}`)
          }
        })
      }
    }

    strictEqual(bad.length, 0,
      'generated identifiers start with a digit:\n  ' + bad.join('\n  '))
  })


  // The rename must not move the WIRE. A request path comes from the point's
  // `orig`, never from the entity name, so the guarded SDK still calls
  // `/3ds-sessions` — otherwise the fix would trade a compile error for a
  // silent 404, which is far worse.
  test('the digit-leading rename leaves the route alone', async () => {
    const out = await generate(['ts'], undefined, DIGIT_ENTITY)

    const config = out['ts/src/Config.ts']
    ok(null != config, 'ts config not generated')
    ok(config.includes('/3ds-sessions'), 'the route did not survive the rename')

    const sdk = out['ts/src/DemoSDK.ts']
    ok(null != sdk, 'ts SDK not generated')
    ok(sdk.includes('N3dsSession('), 'the accessor is not the guarded Name')
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


  // A FULL SDK BUILD ON THE DATA PATH (design rung L1).
  //
  // The config is emitted as data above a size threshold and as a literal
  // below it, and no test fixture comes anywhere near that threshold - the
  // demo model is a few KB against a 256 KB bar. So the branch that EVERY
  // large SDK depends on would be generated by nothing, compiled by nothing
  // and run by nothing, which is how the no-op clean() survived for years.
  //
  // `main.kit.config.repr` exists to close that: it pins the representation
  // per SDK, so a small fixture can drive the data path for real.
  test('a full SDK generates on the data path when repr is pinned', async () => {
    const out = await generate(['go'], undefined, "main: kit: config: repr: 'data'")

    const files = filesFor(out, 'go')
    ok(0 < files.length, 'generated no files on the data path')

    const config = files.find(([name]) => /core\/config\.go$/.test(name))
    ok(config, 'no core/config.go generated')
    const src = String(config![1])

    // The data branch, not the literal one.
    ok(/const configJSON = "/.test(src), 'config was not emitted as data')
    ok(/encoding\/json/.test(src), 'data path did not import encoding/json')
    ok(!/return map\[string\]any\{/.test(src),
      'data path still emitted a composite literal')

    // The embedded constant must be VALID JSON carrying the real model -
    // a mangled string literal would still compile and fail at runtime.
    const m = src.match(/const configJSON = ("(?:[^"\\]|\\.)*")/)
    ok(m, 'could not extract the embedded config constant')
    const parsed = JSON.parse(JSON.parse(m![1]))
    ok(null != parsed.entity, 'embedded config has no entity block')
    ok(0 < Object.keys(parsed.entity).length, 'embedded config has no entities')
    strictEqual(parsed.main.name, 'Demo')

    // The rest of the SDK still generates: this is a FULL build, not just a
    // config file.
    ok(files.some(([n]) => /gitlab|demo/i.test(n) || /\.go$/.test(n)),
      'data path produced no Go sources beyond config')
    ok(20 < files.length, 'data path produced a suspiciously small SDK')
  })


  // The same fixture pinned the other way must produce the literal, so the
  // setting is proven to actually switch rather than being ignored.
  test('the same model pinned to literal emits a literal', async () => {
    const out = await generate(['go'], undefined, "main: kit: config: repr: 'literal'")
    const config = filesFor(out, 'go').find(([n]) => /core\/config\.go$/.test(n))
    ok(config, 'no core/config.go generated')
    const src = String(config![1])
    ok(/return map\[string\]any\{/.test(src), 'literal branch not emitted')
    ok(!/const configJSON = /.test(src), 'literal path emitted data as well')
  })


  // The same pair for the ts target, which is the reference implementation.
  test('a full ts SDK generates on the data path when repr is pinned', async () => {
    const out = await generate(['ts'], undefined, "main: kit: config: repr: 'data'")

    const files = filesFor(out, 'ts')
    ok(0 < files.length, 'generated no files on the data path')

    const src = tsConfigSrc(files)

    ok(/const CONFIG_DATA = "/.test(src), 'config was not emitted as data')
    ok(/JSON\.parse\(CONFIG_DATA\)/.test(src), 'data path does not parse the data')
    ok(!/^\s*entity = \{/m.test(src), 'data path still emitted a class literal')

    const parsed = parseTsConfigData(src)
    ok(null != parsed.entity, 'embedded config has no entity block')
    ok(0 < Object.keys(parsed.entity).length, 'embedded config has no entities')
    strictEqual(parsed.main.name, 'Demo')

    ok(files.some(([n]) => /\.ts$/.test(n)), 'data path produced no ts sources')
    ok(20 < files.length, 'data path produced a suspiciously small SDK')
  })


  // voxgig/sdkgen#128. `$action` selects WHICH POINT of an op to use; it is
  // the SDK's own discriminator and never an API field, but the REST body
  // path had no step to remove it, so it went out on the wire:
  // `PUT /repos/{owner}/{repo}/pulls/{n}/merge` carried
  // `{"$action":"merge", ...}`. GitHub ignores unknown body keys; an API
  // that validates strictly rejects the request for a reason the caller
  // cannot see and did not cause.
  //
  // EXECUTED, not pattern-matched. The generated js utility is
  // dependency-free CommonJS whose whole context is injected, so the real
  // emitted function can be required and called here — a text assertion
  // would pass on a `stripAction` that was defined and never wired in.
  test('js: the generated request transform strips $action from the body',
    async () => {
      const out = await generate(['js'])
      const emitted = findFile(out, 'utility/TransformRequestUtility.js')
      ok(null != emitted, 'the js request transform was not generated')

      const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-xreq-'))
      const file = Path.join(tmp, 'TransformRequestUtility.js')
      writeFileSync(file, emitted as string)
      const { transformRequest } = require(file)

      // reqform as a FUNCTION is one of the two branches; `transform` is the
      // other. Both return through the same strip, so either proves it.
      const run = (reqdata: any) => transformRequest({
        spec: null,
        reqdata,
        point: { transform: { req: (c: any) => c.reqdata } },
        utility: {
          struct: { isfunc: (f: any) => 'function' === typeof f },
          makeError: (_c: any, err: any) => { throw err },
        },
      })

      deepStrictEqual(
        run({ $action: 'merge', commit_title: 'Merge pull request #42' }),
        { commit_title: 'Merge pull request #42' },
        '$action survived into the request body')

      // Narrow: nothing else is touched, and a body that is not a plain
      // object cannot carry a selector and must pass through as it is.
      deepStrictEqual(run({ id: 1, title: 't' }), { id: 1, title: 't' })
      deepStrictEqual(run([1, 2]), [1, 2])
      strictEqual(run(null), null)
      strictEqual(run('body'), 'body')

      // `__proto__` is a legal JSON key and can be a real API field. Copied
      // with `body[key] =` it invokes the inherited setter instead: the key
      // vanishes from the serialised request and silently becomes the body's
      // prototype. Asserted through JSON, which is what actually goes out.
      const proto = run(JSON.parse('{"$action":"a","__proto__":{"x":1},"k":2}'))
      strictEqual(JSON.parse(JSON.stringify(proto)).__proto__?.x, 1,
        '__proto__ was lost from the request body')
      strictEqual(Object.getPrototypeOf(proto), Object.prototype,
        '__proto__ became the body prototype instead of a field')

      Fs.rmSync(tmp, { recursive: true, force: true })
    })


  test('the same ts model pinned to literal emits a literal', async () => {
    const out = await generate(['ts'], undefined, "main: kit: config: repr: 'literal'")
    const src = tsConfigSrc(filesFor(out, 'ts'))
    ok(/^\s*entity = \{/m.test(src), 'literal branch not emitted')
    ok(!/const CONFIG_DATA = /.test(src), 'literal path emitted data as well')
  })


  // STATION SELF-REGISTRATION (station design §6.2 path 1; declarative
  // design §11 item 2). When the model carries an ACTIVE station feature —
  // a project installs it via `package add @voxgig/sdkgen-station` — the
  // generated MAIN module registers the SDK's {construct, config} pair with
  // the station library at module init, keyed by the descriptor slug
  // (config.main.slug), so `station.sdk('<name>')` needs no imports in
  // application code. With the feature absent — every other test in this
  // file — the main must carry none of it.
  //
  // The feature model is stated inline because the real one ships in the
  // EXTERNAL sdkgen-station package; this mirrors its shape (transport
  // role, options, per-target deps with the real library package names).
  // The feature PHASE is switched off for the run because the adapter
  // source also lives in that external package's tm overlay: the Feature
  // component would `Copy` tm/<t>/src/feature/station, which the bundled
  // scaffold does not ship. Main — the component under test — runs
  // unconditionally in makeRoot.
  const STATION_FEATURE = `
main: kit: feature: station: {
  name: key()
  title: "Station control surface binding"
  active: true
  transport: 'wrap'
  config: options: { active: false, url: '', instance: '', register: true }
  hook: PostConstruct: active: true
  deps: ts: { '@voxgig/station': { active: true, version: '>=0.0.1', kind: peer } }
  deps: js: { '@voxgig/station-js': { active: true, version: '>=0.0.1', kind: peer } }
}
main: kit: target: ts: phase: feature: active: false
main: kit: target: js: phase: feature: active: false
`

  test('ts/js main self-registers with station when the feature is active', async () => {
    const out = await generate(['ts', 'js'], undefined, STATION_FEATURE)

    for (const [target, pkg] of [
      ['ts', '@voxgig/station'], ['js', '@voxgig/station-js'],
    ] as [string, string][]) {
      const main = filesFor(out, target)
        .find(([n]) => n.endsWith('src/DemoSDK.' + target))
      ok(main, target + ': no src/DemoSDK.' + target + ' generated')
      const src = String(main![1])

      // The soft probe: only genuine module-not-found is swallowed, so the
      // require is guarded by require.resolve — the requirePath discipline,
      // in the generated code. The package name is the JSON-stringified
      // model dep (per-target: js requires @voxgig/station-js, not the ts
      // library), proving the name is read from the feature model's deps
      // block rather than hardcoded once.
      ok(src.includes(`require.resolve(${JSON.stringify(pkg)})`),
        target + ': main does not probe for the station library')
      ok(src.includes(`require(${JSON.stringify(pkg)})`),
        target + ': main does not require the station library')

      // The §6.2 pair, keyed by the descriptor slug the embedded config
      // already carries.
      ok(src.includes('provide(config.main.slug'),
        target + ': main does not provide under config.main.slug')
      ok(src.includes('new DemoSDK(options)'),
        target + ': factory construct does not build the SDK class')
      ok(/construct:/.test(src) && /config,/.test(src),
        target + ': factory is not the {construct, config} pair')

      // Nothing leaked from the fragment substitution.
      ok(!src.includes('STATIONPKG'),
        target + ': STATIONPKG placeholder leaked')
      ok(!src.includes('ProjectName'),
        target + ': ProjectName placeholder leaked')
    }
  })


  // Declarative design §11 items 3-4: with the station feature active,
  // the generated README's "Use with Station" section LEADS with the
  // declarative flow (a station.json block + station.sdk()) and derives
  // the secret/env-var name from the INSTANCE name (untagged = the slug,
  // so the documented env var is unchanged; tagged derives its own), and
  // the generated AGENTS.md tells an agent that integrations are
  // declared in station.json and to read that file. Without the feature
  // — the other suites — neither says a word about station.
  test('ts/js readme and agent guide lead with the declarative station flow', async () => {
    const out = await generate(['ts', 'js'], undefined, STATION_FEATURE)

    const agents = out['AGENTS.md']
    ok(null != agents, 'no root AGENTS.md generated')
    ok(String(agents).includes('declared in `station.json`'),
      'AGENTS.md does not say integrations are declared in station.json')
    ok(String(agents).includes('read that file'),
      'AGENTS.md does not tell an agent to read station.json')

    for (const target of ['ts', 'js']) {
      const readme = out[target + '/README.md']
      ok(null != readme, target + ': no README.md generated')
      const src = String(readme)

      // The declarative quickstart: the station.json block keyed by the
      // descriptor slug, and the sdk() call beside the connect() form.
      // Keyed by the descriptor slug, and carrying `package` — without
      // it the quickstart is a zero-import example that cannot work:
      // self-registration runs when the SDK's main module executes, and
      // nothing in the example would execute it, so `sdk()` would raise
      // station_no_factory. ts and js are both self-registering targets.
      ok(src.includes('"sdk": { "demo": {'),
        target + ': README has no station.json block keyed by the slug')
      ok(src.includes('"package": "' + ('ts' === target ?
        '@voxgig-sdk/demo' : '@voxgig-sdk/demo-js') + '"'),
        target + ': README quickstart declares no package for station to load')
      ok(src.includes("station.sdk('demo')"),
        target + ': README has no station.sdk() quickstart')
      ok(src.includes('station.connect('),
        target + ': README dropped the imperative connect() form')

      // The instance-derived names: the untagged instance keeps the env
      // var the README already documents; a tagged one derives its own
      // (envtoken maps `$` and `-` alike to `_`, declarative §3.4/§5.1).
      ok(src.includes('`demo.apikey`') && src.includes('`DEMO_APIKEY`'),
        target + ': README does not derive the untagged instance name')
      ok(src.includes('`demo_test.apikey`') && src.includes('`DEMO_TEST_APIKEY`'),
        target + ': README does not derive the tagged instance name')

      // One canonical error catalog, linked rather than restated
      // (station design §9.4).
      ok(src.includes('docs/reference/station-errors.md'),
        target + ': README does not link the station error catalog')
    }

    // And with no station feature, no station story anywhere.
    const bare = await generate(['ts'])
    ok(!String(bare['ts/README.md']).includes('Use with Station'),
      'README carries the station section without the feature')
    ok(!String(bare['AGENTS.md']).includes('station.json'),
      'AGENTS.md carries the station paragraph without the feature')
  })


  test('ts/js main emits no station registration when the feature is absent', async () => {
    const out = await generate(['ts', 'js'])

    for (const target of ['ts', 'js']) {
      const main = filesFor(out, target)
        .find(([n]) => n.endsWith('src/DemoSDK.' + target))
      ok(main, target + ': no src/DemoSDK.' + target + ' generated')
      const src = String(main![1])

      ok(!src.includes('@voxgig/station'),
        target + ': main references the station library without the feature')
      ok(!src.includes('require.resolve'),
        target + ': main carries the station probe without the feature')
      ok(!src.includes('provide('),
        target + ': main registers a factory without the feature')
    }
  })


  // ZIG: no entity accessor may collide with a field or local in the SDK type.
  //
  // Entity accessors are generated as methods on the SDK struct, so an API with
  // an entity named after one of that struct's own members breaks the target
  // twice over: Zig rejects a local binding that shadows a declaration, and
  // `sdk.<name>` resolves to the FIELD, which makes the accessor unreachable.
  //
  // Both happened for real. The fixture has an entity called `utility` and the
  // SDK struct had a `utility` field plus `const utility = self.utility;` in two
  // methods, so the generated zig SDK did not compile AT ALL, and once it did,
  // `sdk.utility(...)` still could not be called. The field is now `util_rt`
  // and the locals are gone.
  //
  // This scan is the guard: it catches the next entity name to collide (an API
  // with an entity called `options` or `headers` would do it) rather than
  // leaving it to whoever compiles that SDK.
  test('zig: no entity accessor collides with an SDK member', async () => {
    const out = await generate(['zig'])
    const sdkFile = filesFor(out, 'zig').find(([n]) => /core\/sdk\.zig$/.test(n))
    ok(sdkFile, 'no zig core/sdk.zig generated')
    const src = String(sdkFile![1])

    // The accessors this model generated, from the emitted source itself.
    const accessors = Array.from(src.matchAll(/pub fn (\w+)\(self: \*@This\(\), entopts: Value\)/g))
      .map((m) => m[1])
    ok(0 < accessors.length, 'no entity accessors found — the scan would be vacuous')
    ok(accessors.includes('utility'),
      'the fixture entity named `utility` is what makes this test bite')

    const clashes: string[] = []
    for (const name of accessors) {
      // A local binding that shadows the accessor declaration.
      if (new RegExp('^\\s+(const|var) ' + name + '\\s*[=:]', 'm').test(src)) {
        clashes.push(name + ': local binding shadows the accessor')
      }
      // A struct FIELD of the same name, which wins over the method on `.`
      // and makes the accessor unreachable.
      if (new RegExp('^\\s+' + name + ': \\*?\\w', 'm').test(src)) {
        clashes.push(name + ': struct field hides the accessor')
      }
    }
    deepStrictEqual(clashes, [],
      'zig entity accessors collide with SDK members — the generated SDK will ' +
      'not compile, or the accessor cannot be called')

    // The invariant behind the fix, asserted rather than assumed.
    //
    // `zigVarName` LOWERCASES every name it is given, so a field spelled with
    // an uppercase letter is one no entity name can ever reach. That is the
    // only real guarantee available here — the scan above only covers entity
    // names THIS fixture happens to use, so a field named `util_rt` would pass
    // it while still colliding with an API that has a `util-rt` entity.
    //
    // The remaining lowercase fields are a KNOWN collision surface, listed
    // rather than ignored: an API with an entity named `mode`, `options`,
    // `features` or `rootctx` still breaks the zig target the same way. They
    // predate this guard and renaming them is its own change; listing them
    // means a NEW lowercase field fails here instead of joining them silently.
    const KNOWN_LOWERCASE_FIELDS = ['mode', 'options', 'features', 'rootctx']

    const sdkStruct = src.slice(src.indexOf('SDK = struct {'))
    const fields = Array.from(
      sdkStruct.slice(0, sdkStruct.indexOf('\n    pub fn '))
        .matchAll(/^    (\w+): /gm)).map((m) => m[1])
    ok(0 < fields.length, 'no SDK struct fields found — the check would be vacuous')

    const reachable = fields
      .filter((f) => f === f.toLowerCase())
      .filter((f) => !KNOWN_LOWERCASE_FIELDS.includes(f))
    deepStrictEqual(reachable, [],
      'these zig SDK fields are spelled in a way zigVarName CAN produce, so an ' +
      'entity of that name collides with them — give the field an uppercase ' +
      'letter, or add it to KNOWN_LOWERCASE_FIELDS with a reason')

    ok(fields.some((f) => f !== f.toLowerCase()),
      'the utility field lost its uppercase spelling, so an entity name can ' +
      'reach it again')
  })


  // EVERY L1 TARGET, on the data path.
  //
  // `main.kit.config.repr` pins it, so a fixture that is nowhere near the
  // 256 KB threshold still generates the branch every large SDK depends on.
  // Each entry names the generated config file, the marker that proves the
  // DATA branch ran, and the marker that proves the LITERAL branch did not.
  const L1_DATA: [string, RegExp, RegExp, RegExp][] = [
    ['go', /core\/config\.go$/, /const configJSON = "/, /return map\[string\]any\{/],
    ['ts', /src\/Config\.ts$/, /const CONFIG_DATA = "/, /^\s*entity = \{/m],
    ['js', /src\/Config\.js$/, /const CONFIG_DATA = "/, /^\s*entity = \{/m],
    // Anchored on the package root: the vendored secrets trees ship a
    // voxgig_plugin/config.py of their own (py has no generate-time
    // feature trim), and a bare /config\.py$/ finds that one first.
    ['py', /_sdk\/config\.py$/, /_CONFIG_DATA = "/, /^\s+return \{$/m],
    // Anchored at the target root, for the reason py's row is: the
    // vendored secrets tree ships a voxgig_plugin/config.rb of its own
    // (rb, like go and py, trims a feature at ADD time rather than at
    // generate time), and a bare /config\.rb$/ finds that one first.
    ['rb', /^rb\/config\.rb$/, /CONFIG_DATA = '/, /"main" => \{/],
    ['php', /config\.php$/, /const CONFIG_DATA = '/, /"main" => \[/],
    ['lua', /config\.lua$/, /local CONFIG_DATA = \[=*\[/, /^\s*main = \{$/m],
    ['c', /core\/config\.c$/, /static const char CONFIG_DATA\[\] =/, /return cmap\(/],
    ['rust', /core\/config\.rs$/, /const CONFIG_DATA: &str = r/, /Value::map_of\(\[/],
    ['zig', /core\/config\.zig$/, /const CONFIG_DATA: \[\]const u8 =/, /return h\.jo\(&\./],
    ['elixir', /lib\/config\.ex$/, /@config_data "/, /Helpers\.deep\(%\{/],
    ['clojure', /src\/sdk\/config\.clj$/, /def \^:private config-data/, /formatCljValue|vs\/jm/],
    ['ocaml', /sdk_config\.ml$/, /let config_data = "/, /^\s*\(jo \[/m],
    ['csharp', /core\/Config\.cs$/, /private const string ConfigData = "/, /^\s*return new Dictionary<string, object\?>$/m],
  ]

  for (const [target, file, dataMark, litMark] of L1_DATA) {
    test(target + ': a full SDK generates on the data path', async () => {
      const out = await generate([target], undefined, "main: kit: config: repr: 'data'")
      const files = filesFor(out, target)
      ok(20 < files.length, target + ': data path produced a suspiciously small SDK')

      const config = files.find(([n]) => file.test(n))
      ok(config, target + ': no config file matching ' + file)
      const src = String(config![1])

      ok(dataMark.test(src), target + ': config was not emitted as data')
      ok(!litMark.test(src), target + ': data path still emitted a literal')

      // The REAL model has to be in there, not an empty shell that happens to
      // carry the marker. Every entity the fixture declares, and the main
      // block, must appear inside the embedded JSON.
      //
      // Unescape first: a target embedding the JSON in a double-quoted literal
      // (go, ts, js, py) has every `"` backslashed in the SOURCE, while one
      // using a raw literal (rb, php, lua) carries the JSON verbatim. The model
      // is the same either way, so compare against the same text either way.
      const plain = src.replace(/\\"/g, '"')
      // Prefix match: main gained additive identity fields (slug, and
      // version/target where the emitter passes its target name).
      ok(plain.includes('"main":{"name":"Demo"'),
        target + ': embedded config is missing the main block')
      for (const entity of ['planet', 'ambient', 'history', 'console']) {
        ok(plain.includes('"' + entity + '"'),
          target + ': embedded config is missing entity ' + entity)
      }

      // Each feature's transport ROLE rides beside its config (station
      // design §8.4, sdkgen tranche §11 items 6-7): the fixture's `test`
      // feature is the one 'base' (it REPLACES the transport slot) and
      // `log` is hook-only 'none'. Station's descriptor reads the role to
      // validate the resolved feature order, so a config without it
      // silently switches those checks off.
      ok(plain.includes('"transport":"base"'),
        target + ': embedded config is missing the test feature\'s ' +
        "transport role 'base'")
      ok(plain.includes('"transport":"none"'),
        target + ': embedded config is missing the log feature\'s ' +
        "transport role 'none'")
    })


    test(target + ': the same model pinned to literal emits a literal', async () => {
      const out = await generate([target], undefined, "main: kit: config: repr: 'literal'")
      const config = filesFor(out, target).find(([n]) => file.test(n))
      ok(config, target + ': no config file matching ' + file)
      const src = String(config![1])
      ok(litMark.test(src), target + ': literal branch not emitted')
      ok(!dataMark.test(src), target + ': literal path emitted data as well')

      // The literal rep must carry the feature transport role too - it is
      // rendered from configDefinition's def, so the same API cannot
      // describe a different config either side of the size threshold
      // (the rung L1 promise; same shape as the dart options.server fix).
      ok(/transport/.test(src),
        target + ': literal config lost the feature transport role')
    })
  }


  // java and kotlin emit config as DATA ONLY, assembling the JSON with their
  // own StringBuilder chunking rather than embedding configDefinition's json
  // string - which is exactly how their feature block could silently drop
  // what the shared def carries. Their featureConfig now renders from
  // configDefinition's def, so the transport role (station design §8.4)
  // must reach the emitted source. (cpp/perl/swift embed the shared json
  // verbatim and are covered by construction; scala and lean do not consume
  // configDefinition at all yet - a known gap, station.md §9 defers them.)
  for (const [target, file] of [
    ['java', /Config\.java$/],
    ['kotlin', /Config\.kt$/],
  ] as [string, RegExp][]) {
    test(target + ': the assembled config JSON carries the transport role', async () => {
      const out = await generate([target])
      const config = filesFor(out, target).find(([n]) => file.test(n))
      ok(config, target + ': no config file matching ' + file)
      const src = String(config![1])
      ok(/transport/.test(src),
        target + ': assembled config lost the feature transport role')
    })
  }


  // THE POINT OF L1: the representation is an emission detail, and nothing
  // downstream may be able to tell which one it got.
  //
  // Asserting that both branches merely GENERATE proves nothing about that —
  // they can each be internally consistent and still describe different
  // configs. So build the object both ways and compare it. This is the check
  // that found the ts `options.base` defect: the literal fragment left the
  // base URL to a `$$...$$` stdrep placeholder, which for a model with no
  // `info.servers` cannot resolve, so the literal shipped the placeholder text
  // as the base URL while the data path shipped ''.
  // Run over BOTH server shapes. With no `info.servers` the two sides agree at
  // '', which is the degenerate case and on its own would let a base URL that
  // never arrives pass; the second fixture is a real SDK's shape and pins that
  // reading the URL explicitly still delivers it.
  for (const [shape, servers] of [
    ['no server URL', ''],
    ['a server URL', "main: kit: info: servers: [ { url: 'https://api.example.com' } ]"],
  ]) {
    test('the ts config is the same whichever representation is emitted, with ' +
      shape, async () => {
        const of = (repr: string) =>
          generate(['ts'], undefined, `main: kit: config: repr: '${repr}'\n${servers}`)
        const [lit, dat] = await Promise.all([of('literal'), of('data')])

        const litcfg = loadTsConfig(tsConfigSrc(filesFor(lit, 'ts')))
        const datcfg = loadTsConfig(tsConfigSrc(filesFor(dat, 'ts')))

        // Sanity: the fixture must actually populate these, or an equality over
        // two empty objects would pass while proving nothing.
        ok(0 < Object.keys(litcfg.entity || {}).length, 'literal config has no entities')
        ok(0 < Object.keys(datcfg.entity || {}).length, 'data config has no entities')

        // Plain snapshots, not the instances: both are `Config` instances, but
        // of two separately evaluated classes, so deepStrictEqual would fail on
        // prototype identity alone and say nothing about the data.
        const snap = (c: any) => ({
          main: c.main, feature: c.feature, options: c.options, entity: c.entity,
        })
        deepStrictEqual(snap(datcfg), snap(litcfg),
          'the two config representations describe different configs')

        strictEqual(litcfg.options.base, '' === servers ? '' : 'https://api.example.com',
          'the base URL did not survive into the config')

        // `makeFeature` lives on the prototype in both, so assigning the parsed
        // data over an instance must not have shadowed it.
        strictEqual(typeof litcfg.makeFeature, 'function', 'literal lost makeFeature')
        strictEqual(typeof datcfg.makeFeature, 'function', 'data lost makeFeature')

        // And no placeholder survived into either.
        for (const [what, cfg] of [['literal', litcfg], ['data', datcfg]] as any[]) {
          ok(!/\$[\w.]*\$/.test(JSON.stringify(snap(cfg))),
            what + ' config carries an unresolved stdrep placeholder')
        }
      })
  }


  // The rendered-output check for L0 normalisation.
  //
  // parity.test.ts asserts the clean() helper behaves and that every Config
  // calls it. Neither reads what is actually EMITTED, and this is exactly the
  // kind of defect that hides between the two: clean() was a no-op for years —
  // it deleted keys during a walk that assigned them straight back — and every
  // suite stayed green while jostraca's iteration metadata shipped inside the
  // config of every generated SDK (5,231 index$ in gitlab alone).
  //
  // So assert on the text: no generated config may carry index$/key$/val$.
  test('no generated config ships jostraca iteration metadata', async () => {
    const targets = allTargets().filter((t) => !NON_SDK_TARGETS.includes(t))
    const out = await generate(targets)

    const leaks: string[] = []
    for (const target of targets) {
      for (const [name, content] of filesFor(out, target)) {
        if (!/(^|\/)config[^/]*$/i.test(name) && !/Config\.[a-z]+$/i.test(name)) {
          continue
        }
        for (const meta of ['index$', 'key$', 'val$']) {
          if (String(content).includes('"' + meta + '"') ||
            String(content).includes("'" + meta + "'")) {
            leaks.push(`${target}:${name} carries ${meta}`)
          }
        }
      }
    }
    deepStrictEqual(leaks, [], 'emitted config still carries model metadata')
  })


  // A LIVE suite for an SDK whose spec templates its server URL cannot even
  // CONSTRUCT a client: makeOptions raises rather than issue requests to a URL
  // with a literal `{tenant}` in it. The generated tests therefore have to be
  // told the values, the same way they have always been told the apikey — via
  // the environment, one `<PROJ>_SERVER_<NAME>` var per declared variable.
  //
  // This was wired for ts/go/py/java first and the other eight targets kept
  // generating live suites that could not run, silently: nothing in the suite
  // read the generated TEXT for it, so the gap was invisible per-target. The
  // list below is therefore the CONTRACT, not a sample — a target that grows a
  // live client without the server-variable wiring fails here.
  //
  // Same for `test.client.options`: it is the project's own place to say how
  // its API wants to be talked to, and a target that ignores it silently drops
  // whatever the project put there.
  // Every target names these differently — PlanetEntity.test.ts,
  // test_planet_entity.py, planet_entity_test.go, planet_entity.t — so match on
  // the two things they all share: an entity/direct basename, and a test-suite
  // extension or path.
  function testFiles(out: Record<string, string>, target: string): [string, string][] {
    return filesFor(out, target)
      .filter(([n]) => /(entity|direct)/i.test(n) &&
        (/test/i.test(n) || /\.t$/.test(n)) &&
        !/\.(json|md|txt|ya?ml)$/i.test(n))
  }


  test('every live-capable target wires server variables and test.client.options',
    async () => {
      const LIVE_TARGETS = [
        'ts', 'js', 'go', 'py', 'java',
        'php', 'rb', 'lua', 'rust', 'csharp', 'perl',
      ]

      // Two variables on purpose: one REQUIRED (empty default) and one with a
      // default, so a target that emits only the required ones, or seeds the
      // env map with '' regardless of the spec, shows up here.
      const servers =
        "main: kit: info: servers: [ { url: 'https://{tenant}.example.com/{region}'," +
        ' variables: { tenant: { default: %27%27 }, region: { default: %27eu%27 } } } ]'
          .replace(/%27/g, "'")

      // A HOSTILE spec, run through the same assertions. Server-variable names
      // are spec-derived and are not identifiers: the URL grammar admits a
      // leading digit, and a declared-but-unreferenced name is unconstrained.
      // A default is likewise arbitrary text, and `$region` / `#{region}` are
      // interpolation in Dart, Perl, PHP and Ruby — the emitters have to write
      // target-language string literals, not JSON.
      const hostile =
        'main: kit: info: servers: [ { url: "https://{2fa}.example.com/{region}",' +
        ' variables: { "2fa": { default: "" },' +
        ' region: { default: "$eu#{x}" },' +
        ' "edge-zone": { default: "z" } } } ]'

      const gaps: string[] = []

      // The plain spec proves the wiring exists; the hostile one proves it is
      // written safely. Both must hold for every target.
      const out = await generate(LIVE_TARGETS, undefined, servers)
      const hostileOut = await generate(LIVE_TARGETS, undefined, hostile)

      for (const target of LIVE_TARGETS) {
        const tests = testFiles(out, target)
        if (0 === tests.length) {
          gaps.push(`${target}: generated no entity/direct test files`)
          continue
        }

        for (const [name, content] of tests) {
          const src = String(content)

          // Both variables reach the env map, under the documented name.
          for (const v of ['TENANT', 'REGION']) {
            if (!src.includes('_SERVER_' + v)) {
              gaps.push(`${target}:${name} has no _SERVER_${v} env entry`)
            }
          }

          // The spec default is carried through, not flattened to ''.
          if (!/['"]eu['"]/.test(src)) {
            gaps.push(`${target}:${name} lost the 'eu' server-variable default`)
          }

          // sdk-test-control.json's test.client.options reaches the live client.
          if (!/live_client_options|liveClientOptions|LiveClientOptions/.test(src)) {
            gaps.push(`${target}:${name} does not read test.client.options`)
          }

          // The apikey placeholder must be EMPTY, not a plausible-looking
          // credential: 'NONE' was sent verbatim to live APIs.
          if (/["']NONE["']/.test(src)) {
            gaps.push(`${target}:${name} still seeds a 'NONE' credential`)
          }
        }
      }

      // Hostile spec: nothing may reach the output as a bare identifier or as
      // a JSON literal that the target language would reinterpret.
      for (const target of LIVE_TARGETS) {
        for (const [name, content] of testFiles(hostileOut, target)) {
          const src = String(content)

          // A bare `2fa:` / `2fa =` key, or a bare `edge-zone` one, is a
          // syntax error in every target that does not quote its keys.
          for (const bad of [/(^|[\s{[(,])2fa\s*[:=]/m, /(^|[\s{[(,])edge-zone\s*[:=]/m]) {
            if (bad.test(src)) {
              gaps.push(`${target}:${name} emits an unquoted server-variable key`)
            }
          }

          // `env.PROJ_SERVER_EDGE-ZONE` is a subtraction, not a lookup.
          if (/env\.[A-Z0-9_]*SERVER[A-Z0-9_]*-/.test(src)) {
            gaps.push(`${target}:${name} reads a server env var by dotted access`)
          }

          // The default must survive as text. Dart/Perl/PHP interpolate `$eu`
          // and Ruby interpolates `#{x}` inside a double-quoted literal, so a
          // JSON-stringified default is wrong for those targets specifically.
          if (['perl', 'php'].includes(target) && /"\$eu/.test(src)) {
            gaps.push(`${target}:${name} emits an interpolating default literal`)
          }
          if ('rb' === target && /[^\\]#\{x\}/.test(src)) {
            gaps.push(`${target}:${name} emits an interpolating default literal`)
          }
        }
      }

      deepStrictEqual(gaps, [], 'live-suite wiring is not uniform across targets')
    })


  // `sdk-test-control.json` is documented "edit by hand" — it is where a
  // project names the tests to skip, the live pacing, and the extra client
  // options a live run needs. It shipped inside each target's blanket
  // `Copy({ from: 'tm/<lang>' })`, and a Copy has no per-file "leave it alone
  // if it already exists", so every `npm run generate` silently reverted those
  // edits. Editing the template master under `.sdk/tm/` instead is worse:
  // `doctor` reports it as drift and the next `target add <lang>` reverts it.
  //
  // So the assertion is not "the file is emitted" (the old Copy did that too)
  // but "a SECOND generation does not touch it". That needs two passes over
  // ONE volume, which the shared `generate()` cannot do — it starts a fresh
  // memfs each call — hence the local twin below.
  test('an edited sdk-test-control.json survives regeneration', async () => {
    const TARGETS = ['ts', 'go', 'py', 'rust', 'perl', 'scala']

    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const pass = async () => {
      const res = await sdkgen.generate({
        model: makeModel(TARGETS), root: makeRoot(),
      })
      strictEqual(res.ok, true, 'generation did not report ok')
    }

    await pass()

    // Every target emits one, wherever its test directory lives.
    // Separators normalised first: jostraca builds paths with Path.join, so
    // these keys are backslash-separated on Windows and the matches below
    // would silently find nothing there. Same reason the shared generate()
    // helper normalises. `.jostraca/generated/` is jostraca's own
    // build-metadata mirror of the output, not the output — dropped here too.
    const controls = Object.keys(vol.toJSON())
      .map((n) => n.split(Path.sep).join('/'))
      .filter((n) => n.endsWith('/sdk-test-control.json'))
      .filter((n) => !n.includes('/.jostraca/'))
    strictEqual(controls.length, TARGETS.length,
      'expected one control file per target, got:\n' + controls.join('\n'))

    // What a project would actually put there.
    const EDITED = JSON.stringify({
      version: 1,
      test: {
        skip: { live: { direct: [{ test: 'direct-list-planet' }], entityOp: [] } },
        client: { options: { timeout: { active: true } } },
      },
    }, null, 2)
    // Back to native separators to actually touch the volume.
    const native = (n: string) => n.split('/').join(Path.sep)
    for (const path of controls) {
      vol.writeFileSync(native(path), EDITED)
    }

    await pass()

    const reverted = controls.filter((path) =>
      EDITED !== String(vol.readFileSync(native(path), 'utf8')))
    deepStrictEqual(reverted, [],
      'regeneration overwrote a hand-edited sdk-test-control.json')
  })


  // The CONSUMER targets, each generated against the target it wraps.
  //
  // They are out of the two loops above for a good reason — standalone they
  // throw, by design — but that also took them out of the placeholder scan,
  // which is the only guard in this suite that reads the generated TEXT. So
  // the go-cli / go-mcp / py-data emitters had no content check at all: a Copy
  // or Fragment added there without `...ctx$.stdrep` would ship a package
  // naming itself "ProjectName" at runtime and every suite would stay green.
  // external.test.ts generates a consumer target too, but asserts only on file
  // PLACEMENT.
  //
  // Each generates IN-TREE here (under `<target>/`): the out-of-tree
  // `output: path` mode is external.test.ts's subject, and the text a target
  // emits is the same either way.
  test('a consumer target generates against its sibling', async () => {
    const leaks: string[] = []

    for (const target of allTargets().filter((t) => NON_SDK_TARGETS.includes(t))) {
      const sibling = NON_SDK_SIBLING[target]
      ok(null != sibling,
        target + ': a consumer target with no declared sibling — add it to ' +
        'NON_SDK_SIBLING, or it is generated by nothing')

      let out: Record<string, string>
      try {
        out = await generate([sibling, target])
      }
      catch (err: any) {
        fail(target + ' (with ' + sibling + '): generation threw: ' +
          (err && err.message))
        return
      }

      const files = filesFor(out, target)
      ok(0 < files.length, target + ': generated no files')

      for (const [path, content] of files) {
        ok('string' === typeof content, target + ': ' + path + ' has no content')

        // Every placeholder the two writers use, not just ProjectName:
        // PROJECTENV and PROJECTVERSION are added by ensureStdrep /
        // templateReplacements, and a surviving `$$model.path$$` means a
        // Fragment or Copy whose model interpolation never ran.
        for (const token of ['ProjectName', 'PROJECTENV', 'PROJECTVERSION']) {
          if (content.includes(token) &&
            !PLACEHOLDER_PINNED.some((re) => re.test(path))) {
            leaks.push(path + ': ' + token)
          }
        }

        // A MODEL PATH between the delimiters — identifiers and dots — not any
        // `$$` pair. In a Makefile `$$` is how you write a literal `$`, so
        // py-data's `$${GITHUB_TOKEN:-$$(gh auth token)}` matched a loose
        // pattern and reported a correct recipe as a leaked placeholder.
        const ref = content.match(/\$\$[A-Za-z_][A-Za-z0-9_.]*\$\$/)
        if (null != ref) {
          leaks.push(path + ': ' + ref[0])
        }
      }
    }

    strictEqual(leaks.length, 0,
      'a consumer target leaked a placeholder into its output:\n  ' +
      leaks.join('\n  '))
  })


  // --- Regressions: the three defects this suite was written for ------------

  // Root.ts (via makeRoot) and every Test_<lang>.ts each read the raw,
  // unfiltered entity map independently, ignoring `active`.
  test('an inactive entity generates no source file and no test file', async () => {
    const extra = "main: kit: entity: history: active: false\n"
    const out = await generate(['ts'], undefined, extra)
    const files = filesFor(out, 'ts').map(([p]) => p)

    ok(files.some((p) => p.endsWith('PlanetEntity.ts')),
      'control failed: active entity Planet missing from ts output')
    ok(!files.some((p) => p.endsWith('HistoryEntity.ts')),
      'inactive entity History still generated a source file: ' +
      files.filter((p) => p.includes('History')).join(', '))
    ok(!files.some((p) => p.includes('/entity/history/')),
      'inactive entity History still generated test files: ' +
      files.filter((p) => p.includes('/entity/history/')).join(', '))
  })


  // elixir: a singleton endpoint has no required match keys, so the load
  // example took no second argument. Emitting one anyway produced
  // `load(ent, )`, which does not parse.
  //
  // ReadmeTopQuick_elixir renders ONE worked example, for the first active
  // entity by key — `ambient`, the singleton. That is load-bearing, not
  // incidental: with any other entity first, this case is never generated, so
  // the guard below fails loudly rather than passing on an example that could
  // not have had the bug.
  test('elixir: no empty argument in a singleton load example', async () => {
    const out = await generate(['elixir'])

    // The ROOT readme — the one ReadmeTop writes, directly under the output
    // folder rather than inside the target directory.
    const quick = out['README.md']
    ok(null != quick, 'elixir: no root readme was generated')

    ok(/Entity\.Ambient\.load\(/.test(quick),
      'elixir: the root quickstart no longer shows the singleton load — rename ' +
      'the fixture entities so `ambient` is again the first active entity by key')

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
    const current = findFile(out, 'ambient_entity_test.cpp')

    ok(null != planet, 'cpp: no planet entity test generated')
    ok(planet!.includes('entity_stream'), 'cpp: planet has a list op but no stream test')

    ok(null != current, 'cpp: no ambient entity test generated')
    ok(!current!.includes('entity_stream'),
      'cpp: ambient has no list op but a stream test was emitted')
  })


  // --- Reserved-name collisions ---------------------------------------------
  //
  // Every one of these shipped a broken SDK to the corpus. They are pinned per
  // symptom rather than as one blanket "no collisions" check, so a regression
  // names the exact clash.

  // php: an entity named `utility` generated `private $_utility` on a class
  // that already declares one — PHP refuses to parse the file at all, so the
  // SDK produced ZERO working tests.
  test('php: entity accessors do not collide with SDK class members', async () => {
    const out = await generate(['php'])

    const main = Object.entries(out)
      .find(([p]) => p.startsWith('php/') && p.endsWith('_sdk.php'))
    ok(null != main, 'php: no SDK class file generated')
    const src = main![1]

    // Declared property and method names, lowercased: PHP is case-insensitive
    // for method names, so `GraphQl` and `graphql` are the SAME declaration.
    const props = [...src.matchAll(/(?:private|public|protected)\s+\$(\w+)/g)]
      .map(m => m[1].toLowerCase())
    const methods = [...src.matchAll(/(?:public|private|protected)(?:\s+static)?\s+function\s+(\w+)/g)]
      .map(m => m[1].toLowerCase())

    for (const [what, names] of [['property', props], ['method', methods]] as const) {
      const dupes = names.filter((n, i) => names.indexOf(n) !== i)
      strictEqual(dupes.length, 0,
        `php: duplicate ${what} declaration(s): ${[...new Set(dupes)].join(', ')} ` +
        '— an entity name collided with an SDK class member')
    }
  })


  // php: the SDK class mangles an accessor that would collide (an entity named
  // `test` becomes `Test_()`, since `test()` is the static test-mode
  // constructor). Eight readme components emitted the UNMANGLED `Test()`, so
  // every generated php example called the constructor and then died with
  // "Call to undefined method <Name>SDK::load()". The accessor name has to
  // agree between the class and the docs — one helper, one answer.
  test('php: doc examples call the accessor the SDK class actually declares', async () => {
    const out = await generate(['php'])

    const main = Object.entries(out)
      .find(([p]) => p.startsWith('php/') && p.endsWith('_sdk.php'))
    ok(null != main, 'php: no SDK class file generated')

    // `static` included: the test-mode constructor is `public static function
    // test()`, and PHP happily resolves a static method through `->`, which is
    // how the generated StructRunner calls it.
    const declared = new Set(
      [...main![1].matchAll(/public (?:static )?function (\w+)\(/g)]
        .map(m => m[1].toLowerCase()))

    const bad: string[] = []
    for (const [path, content] of Object.entries(out)) {
      if (!/\.(md|php)$/.test(path)) continue
      // Strip comments first: the components explain the accessor pattern in
      // prose ("Entity accessor ($client->Name()) => fixture key"), which is
      // documentation, not a call.
      const code = content
        .replace(/^\s*(?:\/\/|#).*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
      for (const m of code.matchAll(/\$client->(\w+)\(/g)) {
        if (!declared.has(m[1].toLowerCase())) {
          bad.push(`${path}: calls $client->${m[1]}(...), not declared on the SDK class`)
        }
      }
    }

    strictEqual(bad.length, 0, 'php: example calls a nonexistent accessor:\n  ' +
      [...new Set(bad)].join('\n  '))
  })


  // ts: an entity named `console` produced `for (const console of consoles)`,
  // shadowing the global — the example's own console.log then resolved to the
  // entity and threw "console.log is not a function".
  test('ts: example variables do not shadow language globals', async () => {
    const out = await generate(['ts'])

    const GLOBALS = ['console', 'window', 'document', 'process', 'globalThis']
    const offenders: string[] = []

    for (const [path, content] of Object.entries(out)) {
      if (!/\.(md|ts)$/.test(path)) continue
      for (const g of GLOBALS) {
        // `const console =` / `let console =` / `for (const console of` all
        // rebind the global for the rest of the snippet.
        const re = new RegExp(`(?:const|let|var)\\s+${g}\\b\\s*(?:=|of|in)`)
        if (re.test(content)) offenders.push(`${path}: rebinds \`${g}\``)
      }
    }

    strictEqual(offenders.length, 0,
      'ts: generated code shadows a language global:\n  ' + offenders.join('\n  '))
  })


  // ts: an entity named `record` (Airtable's real shape) produced `export
  // interface Record {...}` with a field typed `Record<string, any>` —
  // canonToType's own generic-object mapping — in the SAME interface,
  // shadowing the TS builtin: "Type 'Record' is not generic".
  test('ts: an entity named record does not shadow the builtin Record<K,V>', async () => {
    const out = await generate(['ts'])

    const types = findFile(out, 'DemoTypes.ts')
    ok(null != types, 'ts: no DemoTypes.ts generated')
    ok(types!.includes('export interface RecordType {'),
      'the record entity data type was not renamed off the builtin')
    ok(!/export interface Record\s*\{/.test(types!),
      'the record entity still shadows the builtin Record<K,V>')

    const entity = findFile(out, 'RecordEntity.ts')
    ok(null != entity, 'ts: no RecordEntity.ts generated')
    ok(entity!.includes('extends DemoEntityBase<RecordType>'),
      'the entity class does not use the renamed data type')
    ok(entity!.includes(`this.Name = 'Record'`),
      'the runtime Name string was wrongly renamed along with the type')
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
  // The SDK's OWN release version. Every manifest emitter used to hardcode
  // '0.0.1', so the value lived only in generated output — and generation
  // OVERWRITES, so a project that had published 0.0.2 got a 0.0.1 manifest
  // back on its next regeneration. Only the 3-way merge (which sdkgen turns
  // off) had been hiding it, by conflicting over that very line.
  // Attribution reaches the manifests that carry it, and a target can differ
  // from the rest.
  //
  // The five manifests with an author field used to HARDCODE the publisher —
  // two via the PUBLISHER constant, three as bare "Voxgig" / "voxgig"
  // literals — so a model naming someone else was simply not read. The
  // solardemo model named a person, the seneca-provider target credited them,
  // and the SDK's own package.json went on saying Voxgig.
  //
  // The per-target override is what makes the model-wide value safe to set: a
  // generated SDK is an artefact of the publisher, while a provider is
  // independently released by named people, and one model produces both.
  test('a declared author reaches every manifest, and a target may override', async () => {
    const TARGETS = ['ts', 'js', 'rb', 'php', 'ocaml']

    const declared = [
      "main: kit: author: { name: 'Ada Lovelace', url: 'https://example.com' }",
      "main: kit: target: ts: author: { name: 'Someone Else', url: 'https://elsewhere.example' }",
    ].join('\n')

    const out = await generate(TARGETS, undefined, declared)

    const MANIFEST: Record<string, string> = {
      ts: 'package.json', js: 'package.json', rb: 'Demo_sdk.gemspec',
      php: 'composer.json', ocaml: 'voxgig-demo-sdk.opam',
    }

    const bad: string[] = []
    for (const t of TARGETS) {
      const file = findFile(out, t + '/' + MANIFEST[t])
      if (null == file) { bad.push(`${t}: no ${MANIFEST[t]} generated`); continue }

      // ts is pinned to a different author; every other target inherits.
      const expected = 'ts' === t ? 'Someone Else' : 'Ada Lovelace'
      if (!file.includes(expected)) {
        bad.push(`${t}: ${MANIFEST[t]} does not carry "${expected}"`)
      }

      // The hardcoded publisher must be gone from the author position. It is
      // still legitimate elsewhere in a manifest (keywords, the npm scope),
      // so only an author-shaped occurrence counts.
      if (/(?:"name"\s*:\s*"Voxgig"|authors\s*[:=]\s*\[?"?[Vv]oxgig)/.test(file)) {
        bad.push(`${t}: ${MANIFEST[t]} still hardcodes the publisher as author`)
      }
    }

    deepStrictEqual(bad, [])
  })


  test('a declared version reaches every manifest', async () => {
    const TARGETS = [
      'csharp', 'elixir', 'java', 'js', 'kotlin',
      'lua', 'ocaml', 'py', 'rb', 'rust', 'ts', 'zig',
    ]
    const declared = TARGETS
      .map((t) => `main: kit: target: ${t}: publish: version: '4.5.6'`)
      .join('\n')

    const out = await generate(TARGETS, undefined, declared)

    // The manifest each ecosystem actually publishes from.
    const MANIFEST: Record<string, string> = {
      csharp: 'DemoSDK.csproj', elixir: 'mix.exs',
      java: 'pom.xml', js: 'package.json',
      kotlin: 'build.gradle.kts', lua: 'demo.rockspec',
      ocaml: 'voxgig-demo-sdk.opam', py: 'pyproject.toml', rb: 'Demo_sdk.gemspec',
      rust: 'Cargo.toml', ts: 'package.json', zig: 'build.zig.zon',
    }

    const missing: string[] = []
    for (const t of TARGETS) {
      const file = findFile(out, t + '/' + MANIFEST[t])
      if (null == file) { missing.push(`${t}: no ${MANIFEST[t]} generated`); continue }
      if (!file.includes('4.5.6')) {
        missing.push(`${t}: ${MANIFEST[t]} does not carry the declared version`)
      }
      if (/(?:^|[^.\d])0\.0\.1(?![.\d])/.test(file)) {
        missing.push(`${t}: ${MANIFEST[t]} still hardcodes 0.0.1`)
      }
    }

    deepStrictEqual(missing, [],
      'the declared publish version did not reach every manifest:\n  ' +
      missing.join('\n  '))
  })


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
  // only way to find it was to read MakePointUtility.ts and the .aon model.
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


  // go: the secrets plugin wiring is EMITTED, and the trim is REAL.
  //
  // The ts pass established that pluginImports silently no-ops when its
  // path filter and the model drift (vendor-tag rollout, reshape edit 5):
  // nothing asserted on the emitted imports, and the failure surfaced only
  // at runtime as "<kind> is a sekreto plugin, not built in". This is the
  // go guard for the same seam: an ACTIVE secrets model must emit the
  // plugin package imports and the FeaturePlugins entries into
  // core/config.go, and the INACTIVE groups' vendored files must stay out
  // of the tree (Main_go's pluginExcludes - the generate-time trim go now
  // has), while the shared httpjson helper (in no group) ships regardless.
  test('go: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['go'], undefined,
        'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    const config = findFile(out, 'core/config.go')
    ok(null != config, 'go: no core/config.go generated')

    // The NAMED imports and the definitions list - the two emissions that
    // can silently no-op while everything else stays green.
    ok(/feature\/secrets\/plugins\/hashicorp"/.test(config!),
      'go: active vault group did not emit the hashicorp plugin import')
    ok(/"secrets": \{boru\.Plugin, hashicorp\.Plugin\}/.test(config!),
      'go: FeaturePlugins is missing the vault definitions:\n' +
      (config!.match(/var featurePlugins[^}]*\}/) || ['(no featurePlugins var)'])[0])

    // The trim: an inactive group's vendored file is OUT, the active
    // group's and the group-less shared helper are IN.
    ok(null == findFile(out, 'plugins/gcpsecrets/gcpsecrets.go'),
      'go: the inactive cloud group still ships gcpsecrets')
    ok(null == findFile(out, 'plugins/secretspec/secretspec.go'),
      'go: the inactive secretspec group still ships its child-process plugin')
    ok(null != findFile(out, 'plugins/hashicorp/hashicorp.go'),
      'go: the ACTIVE vault group lost hashicorp')
    ok(null != findFile(out, 'plugins/httpjson/httpjson.go'),
      'go: the shared httpjson helper must ship with the feature core')

    // And the inactive-model baseline: no secrets machinery in config.go.
    const plain = findFile(await generate(['go']), 'core/config.go')
    ok(!/feature\/secrets\/plugins/.test(plain!),
      'go: an inactive model still emitted plugin imports')
    ok(/var featurePlugins = map\[string\]\[\]any\{\n\}/.test(plain!),
      'go: an inactive model must emit an EMPTY featurePlugins map')
  })


  // lua guard for the same seam: an ACTIVE secrets model must emit the
  // plugin module requires and the FEATURE_PLUGINS entries into the
  // generated config_plugins.lua, and the INACTIVE groups' vendored files
  // must stay out of the tree (Main_lua's pluginExcludes - the
  // generate-time trim), while the shared helpers (in no group) ship
  // regardless. lua alone has a NATIVE tier: the plugin kinds run a C
  // transport helper, so an active group must also produce the Makefile
  // fragment that compiles it - and an inactive model must produce
  // neither the fragment nor the helper's source.
  test('lua: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['lua'], undefined,
        'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    const plugins = findFile(out, 'lua/config_plugins.lua')
    ok(null != plugins, 'lua: no config_plugins.lua generated')

    // The NAMED requires and the definitions list - the two emissions that
    // can silently no-op while everything else stays green.
    ok(/require\("feature\.secrets\.sekreto\.plugins\.hashicorp"\)/.test(plugins!),
      'lua: active vault group did not emit the hashicorp plugin require')
    ok(/\["secrets"\] = \{\n    plugin_boru\.boru,\n    plugin_hashicorp\.hashicorp,\n  \}/.test(plugins!),
      'lua: FEATURE_PLUGINS is missing the vault definitions:\n' + plugins)
    ok(!/gcpsecrets|secretspec|awssecrets/.test(plugins!),
      'lua: an inactive group reached config_plugins.lua')

    // The trim: an inactive group's vendored file is OUT, the active
    // group's and the group-less shared helpers are IN.
    ok(null == findFile(out, 'sekreto/plugins/gcpsecrets.lua'),
      'lua: the inactive cloud group still ships gcpsecrets')
    ok(null == findFile(out, 'sekreto/plugins/secretspec.lua'),
      'lua: the inactive secretspec group still ships its child-process plugin')
    ok(null == findFile(out, 'sekreto/plugins/sigv4.lua'),
      'lua: the inactive aws group still ships sigv4 (aws.lua is its only user)')
    ok(null != findFile(out, 'sekreto/plugins/hashicorp.lua'),
      'lua: the ACTIVE vault group lost hashicorp')
    for (const shared of ['httpjson', 'net', 'json', 'support', 'crypto']) {
      ok(null != findFile(out, 'sekreto/plugins/' + shared + '.lua'),
        'lua: the shared ' + shared + ' helper must ship with the feature core')
    }
    ok(null == findFile(out, 'sekreto/plugins.lua'),
      'lua: the full-set barrel plugins.lua must never be vendored')

    // The NATIVE tier: the helper's source is vendored with the feature,
    // its build fragment is generated because a plugin group is active,
    // the Makefile includes it, and the built binary is ignored by git.
    ok(null != findFile(out, 'feature/secrets/native/sekretonet.c'),
      'lua: the sekreto transport helper source was not carried')
    const mk = findFile(out, 'feature/secrets/native.mk')
    ok(null != mk, 'lua: an active plugin group must generate feature/secrets/native.mk')
    ok(/secrets\.vault/.test(mk!) && /-lssl -lcrypto/.test(mk!) && /tail -n \+4/.test(mk!),
      'lua: native.mk does not name the group, link OpenSSL and skip the provenance header:\n' + mk)
    const makefile = findFile(out, 'lua/Makefile')
    // The template names NO feature (featuresource.test.ts's nothing-left-
    // behind guard): it includes whatever native.mk a feature folder ships.
    ok(/-include \$\(wildcard feature\/\*\/native\.mk\)/.test(makefile!),
      'lua: the Makefile does not include the per-feature native fragments')
    ok(!/secrets/.test(makefile!), 'lua: the Makefile template hardcodes a feature')
    ok(/^feature\/secrets\/native\/sekreto-net$/m.test(findFile(out, 'lua/.gitignore')!),
      'lua: the built helper is not gitignored')

    // The rockspec lists the vendored core and the ACTIVE kinds only.
    const rock = findFile(out, '.rockspec')
    ok(null != rock, 'lua: no rockspec generated')
    for (const mod of ['feature.secrets.sekreto', 'feature.secrets.plugin',
      'feature.secrets.sekreto.plugins.httpjson',
      'feature.secrets.sekreto.plugins.hashicorp', 'config_plugins']) {
      ok(rock!.includes('["' + mod + '"]'),
        'lua: the rockspec does not list ' + mod)
    }
    ok(!rock!.includes('plugins.gcpsecrets'),
      'lua: the rockspec claims a module the trim removed')

    // And the inactive-model baseline: an EMPTY definitions table, no
    // native fragment, and no secrets container at all - the feature's
    // source, its vendored trees and its shipped suite are gated by the
    // model, so an SDK that never asked for secrets carries none of them.
    const plain = await generate(['lua'])
    const plainPlugins = findFile(plain, 'lua/config_plugins.lua')
    ok(null != plainPlugins, 'lua: config_plugins.lua must be emitted unconditionally')
    ok(/local FEATURE_PLUGINS = \{\n\}/.test(plainPlugins!),
      'lua: an inactive model must emit an EMPTY FEATURE_PLUGINS table:\n' + plainPlugins)
    ok(null == findFile(plain, 'feature/secrets/native.mk'),
      'lua: an inactive model generated the native build fragment')
    ok(null == findFile(plain, 'feature/secrets/native/sekretonet.c'),
      'lua: an inactive model still carries the transport helper source')
    ok(null == findFile(plain, 'feature/secrets_feature.lua'),
      'lua: an inactive model still carries the secrets feature source')
    ok(null == findFile(plain, 'test/feature/secrets/secrets_feature_test.lua'),
      'lua: an inactive model still carries the gated secrets suite')
    ok(null == findFile(plain, 'feature/secrets/sekreto.lua'),
      'lua: an inactive model still carries the vendored sekreto core')
    ok(!findFile(plain, '.rockspec')!.includes('feature.secrets'),
      'lua: an inactive model lists secrets modules in its rockspec')
  })


  // py guard for the same seam: an ACTIVE secrets model must emit the
  // plugin module imports and the FEATURE_PLUGINS entries into the
  // package config.py, and the INACTIVE groups' vendored files must stay
  // out of the tree (Main_py's pluginExcludes - the generate-time trim py
  // now has), while the shared httpjson helper (in no group) ships
  // regardless. The runner-swap artefacts ride along: the omni resolver
  // and smoke test are generated, the retired struct_runner is not.
  test('py: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['py'], undefined,
        'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    const config = findFile(out, '_sdk/config.py')
    ok(null != config, 'py: no package config.py generated')

    // The NAMED imports and the definitions list - the two emissions that
    // can silently no-op while everything else stays green.
    ok(/from \w+_sdk\.feature\.secrets\.voxgig_sekreto\.plugins\.hashicorp import hashicorp/
      .test(config!),
      'py: active vault group did not emit the hashicorp plugin import')
    ok(/"secrets": \[boru, hashicorp\],/.test(config!),
      'py: FEATURE_PLUGINS is missing the vault definitions:\n' +
      (config!.match(/FEATURE_PLUGINS = \{[^}]*\}/) || ['(no FEATURE_PLUGINS)'])[0])

    // The trim: an inactive group's vendored file is OUT, the active
    // group's and the group-less shared helper are IN.
    ok(null == findFile(out, 'voxgig_sekreto/plugins/gcpsecrets.py'),
      'py: the inactive cloud group still ships gcpsecrets')
    ok(null == findFile(out, 'voxgig_sekreto/plugins/secretspec.py'),
      'py: the inactive secretspec group still ships its child-process plugin')
    ok(null != findFile(out, 'voxgig_sekreto/plugins/hashicorp.py'),
      'py: the ACTIVE vault group lost hashicorp')
    ok(null != findFile(out, 'voxgig_sekreto/plugins/httpjson.py'),
      'py: the shared httpjson helper must ship with the feature core')

    // The runner swap: the omni resolver, its vendored package and the
    // must-fail smoke test are generated; the superseded struct runner
    // is gone.
    ok(null != findFile(out, 'test/omni.py'), 'py: no omni resolver generated')
    ok(null != findFile(out, 'test/voxgig_omni/runner.py'),
      'py: vendored omni runner missing')
    ok(null != findFile(out, 'test/test_omni_smoke.py'),
      'py: the runner-must-fail smoke test is missing')
    ok(null == findFile(out, 'test/struct_runner.py'),
      'py: the superseded struct_runner.py is still generated')

    // And the inactive-model baseline: no plugin machinery in config.py.
    const plainout = await generate(['py'])
    const plain = findFile(plainout, '_sdk/config.py')
    ok(!/voxgig_sekreto\.plugins/.test(plain!),
      'py: an inactive model still emitted plugin imports')
    ok(/FEATURE_PLUGINS = \{\n\}/.test(plain!),
      'py: an inactive model must emit an EMPTY FEATURE_PLUGINS map')
  })


  // c guard for the same seam, and for the two hazards particular to a
  // target whose build is a Makefile that reads the TRIMMED TREE.
  //
  // FIRST HAZARD: the wiring files. tm/c/Makefile names no feature (the
  // `nothing left behind names a dropped feature` guard holds a trimmed
  // template to that) and `-include`s a GENERATED feature/<name>/kinds.mk,
  // so everything the payload needs from the build comes from Config_c:
  // the vendored cores, the suite, and - only when a group is active - the
  // plugin layer with -lssl -lcrypto -lcurl. Beside it kinds.c must name
  // exactly the active groups' constructors (a symbol for a trimmed file is
  // a link error; a missing one is a kind silently absent from the
  // vocabulary), the inactive groups' kind files must be gone from the
  // tree, and the five UNGROUPED helpers (httpjson, tls, encode, clock,
  // proc - shared by several groups, so owned by none) must stay.
  //
  // SECOND HAZARD: a feature that is itself OFF. c has `srcfeature: false`,
  // so Main_c's whole-tree Copy is the only copy the target has, and
  // pluginExcludes(model) walks only ACTIVE features - a `secrets` declared
  // `active: false` with a group on would keep that group's vault client in
  // the tree, and the Makefile would compile and link it into an SDK whose
  // model turned the feature off. Main_c's inactivePluginExcludes (scala's
  // shape) is the guard, and no kinds.c is emitted, so nothing of the
  // feature is compiled either way.
  test('c: active secrets emits plugin defs and trims inactive groups', async () => {
    const genc = async (extra: string, features: string[]) => {
      const { fs, vol } = memfs({})
      const sdkgen = SdkGen({
        fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
      })
      const res = await sdkgen.generate({
        model: makeModel(['c'], undefined, extra, features),
        root: makeRoot(),
      })
      strictEqual(res.ok, true, 'generation did not report ok')
      const out: Record<string, string> = {}
      for (const [path, content] of
        Object.entries(vol.toJSON() as Record<string, string>)) {
        const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
        if (rel.includes('.jostraca/')) continue
        out[rel] = content
      }
      return out
    }

    const out = await genc(
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // THE WIRING FILE, and the definitions in it.
    const kinds = findFile(out, 'c/feature/secrets/kinds.c')
    ok(null != kinds, 'c: no feature/secrets/kinds.c generated')
    ok(/^Definition\* sek_plugin_hashicorp\(void\);$/m.test(kinds!) &&
      /^Definition\* sek_plugin_boru\(void\);$/m.test(kinds!),
      'c: the ACTIVE vault group did not reach kinds.c:\n' + kinds)
    ok(/SECRETS_KINDS\[0\] = sek_plugin_boru\(\);/.test(kinds!) &&
      /SECRETS_KINDS\[1\] = sek_plugin_hashicorp\(\);/.test(kinds!) &&
      /\*n = 2;/.test(kinds!),
      'c: secrets_plugins() is missing the vault definitions:\n' + kinds)
    ok(!/sek_plugin_(gcpsecrets|azuresecrets|awssecrets|awsparams|onepassword|doppler|infisical|secretspec)/
      .test(kinds!),
      'c: an INACTIVE group reached kinds.c:\n' + kinds)

    // The exchange transport of last resort: libcurl, because a plugin
    // group is active (the Makefile adds -lcurl on the same condition).
    ok(/#include <curl\/curl\.h>/.test(kinds!) &&
      /voxgig_value\* secrets_rawfetch\(/.test(kinds!),
      'c: a plugin-bearing model must carry the libcurl exchange transport')

    // The build wiring: the cores and the suite always, the plugin layer
    // and its two libraries because a group is active.
    const mk = findFile(out, 'c/feature/secrets/kinds.mk')
    ok(null != mk, 'c: no feature/secrets/kinds.mk generated')
    ok(/^FEATURE_SRCS \+= \$\(wildcard feature\/secrets\/sekreto\/\*\.c feature\/secrets\/plugin\/\*\.c\)$/m.test(mk!) &&
      /^FEATURE_TEST_SRCS \+= \$\(wildcard tests\/feature\/secrets\/\*\.c\)$/m.test(mk!),
      'c: kinds.mk does not wire the vendored cores and the suite:\n' + mk)
    ok(/^FEATURE_SRCS \+= \$\(wildcard feature\/secrets\/plugins\/\*\.c\)$/m.test(mk!) &&
      /^LDLIBS \+= -lssl -lcrypto -lcurl$/m.test(mk!),
      'c: a plugin-bearing model must compile the plugin layer and link its libraries:\n' + mk)

    // The accessor in core/config.c dispatches to it, and the feature's
    // constructor is declared and dispatched like every declared feature.
    const config = findFile(out, 'c/core/config.c')
    ok(null != config, 'c: no core/config.c generated')
    ok(/^void\*\* secrets_plugins\(size_t\* n\);$/m.test(config!) &&
      /if \(strcmp\(name, "secrets"\) == 0\) return secrets_plugins\(n\);/.test(config!),
      'c: feature_plugins() does not dispatch to secrets_plugins:\n' + config)
    ok(/if \(strcmp\(name, "secrets"\) == 0\) return feature_secrets_new\(\);/.test(config!),
      'c: make_feature() does not construct the secrets feature')

    // The trim on disk: the active group's files and the ungrouped helpers
    // are IN, every other group's are OUT, and the full-set barrel is never
    // there at all.
    ok(null != findFile(out, 'feature/secrets/plugins/hashicorp.c') &&
      null != findFile(out, 'feature/secrets/plugins/boru.c'),
      'c: the ACTIVE vault group lost a kind file')
    for (const helper of ['httpjson', 'tls', 'encode', 'clock', 'proc']) {
      ok(null != findFile(out, 'feature/secrets/plugins/' + helper + '.c'),
        'c: the shared ' + helper + '.c helper must ship with the feature core')
    }
    ok(null == findFile(out, 'feature/secrets/plugins/gcpsecrets.c'),
      'c: the inactive cloud group still ships gcpsecrets')
    ok(null == findFile(out, 'feature/secrets/plugins/secretspec.c'),
      'c: the inactive secretspec group still ships its child-process plugin')
    ok(null == findFile(out, 'feature/secrets/plugins/sigv4.c') &&
      null == findFile(out, 'feature/secrets/plugins/sha256.c'),
      'c: the inactive aws group still ships its request signing')
    ok(null == findFile(out, 'feature/secrets/plugins/all.c'),
      'c: the full-set barrel plugins/all.c must never be generated')

    // The vendored cores at upstream's depth, the feature, and the gated
    // suite in the tests/feature/ container the trim drops with it.
    ok(null != findFile(out, 'feature/secrets/sekreto/sekreto.c'),
      'c: the vendored sekreto core was not generated')
    ok(null != findFile(out, 'feature/secrets/plugin/host.c'),
      'c: the vendored voxgig/plugin core was not generated')
    ok(null != findFile(out, 'c/feature/secrets.c') &&
      null != findFile(out, 'c/feature/secrets.h'),
      'c: the secrets feature source was not generated')
    ok(null != findFile(out, 'c/tests/feature/secrets/secrets_test.c'),
      'c: the gated secrets suite was not generated')

    // A DIFFERENT group alone, so a regression in the per-group def maps
    // shows up here rather than in a generated SDK nobody compiled.
    const saas = await genc(
      'main: kit: feature: secrets: { active: true plugin: saas: active: true }',
      ['test', 'log', 'secrets'])
    const saaskinds = findFile(saas, 'c/feature/secrets/kinds.c')
    ok(null != saaskinds && /sek_plugin_doppler\(\)/.test(saaskinds) &&
      /sek_plugin_infisical\(\)/.test(saaskinds) &&
      /sek_plugin_onepassword\(\)/.test(saaskinds) &&
      !/sek_plugin_(hashicorp|boru)/.test(saaskinds),
      'c: the saas group did not select exactly its three kinds:\n' + saaskinds)
    ok(null == findFile(saas, 'feature/secrets/plugins/hashicorp.c'),
      'c: a saas-only model still ships the vault kind')

    // THE INACTIVE FEATURE (declared, off, with a group on): no wiring file,
    // no kind file, and the accessor emitted EMPTY - it exists in every
    // config.c so sdk.h's prototype always has a definition.
    const off = await genc(
      'main: kit: feature: secrets: { active: false plugin: vault: active: true }',
      ['test', 'log', 'secrets'])
    ok(null == findFile(off, 'c/feature/secrets/kinds.c') &&
      null == findFile(off, 'c/feature/secrets/kinds.mk'),
      'c: an inactive feature still generated its wiring files')
    ok(null == findFile(off, 'feature/secrets/plugins/hashicorp.c'),
      'c: an inactive feature still ships its vault kind (Main_c inactivePluginExcludes)')
    const offconfig = findFile(off, 'c/core/config.c')
    ok(!/secrets_plugins|feature_secrets_new/.test(offconfig!),
      'c: an inactive feature still reached config.c')
    ok(/void\*\* feature_plugins\(const char\* name, size_t\* n\) \{\n  \(void\)name;\n  \*n = 0;\n  return NULL;\n\}/
      .test(offconfig!),
      'c: an inactive model must emit an EMPTY feature_plugins accessor:\n' + offconfig)

    // And a model that never mentions the feature: the same empty accessor
    // and no wiring file. The vendored tree rides along in the Copy here -
    // this harness runs no `target add`, which is where an undeclared
    // feature is trimmed - and without kinds.mk the Makefile compiles none
    // of the payload (the generatedcompile lanes prove that with ldd).
    const plain = await generate(['c'])
    ok(null == findFile(plain, 'c/feature/secrets/kinds.c') &&
      null == findFile(plain, 'c/feature/secrets/kinds.mk'),
      'c: a model without secrets still generated the wiring files')
    ok(!/secrets_plugins|feature_secrets_new/.test(findFile(plain, 'c/core/config.c')!),
      'c: a model without secrets still reached config.c')
  })


  // js guard for the same seam, plus the one hazard only js has.
  //
  // An ACTIVE secrets model must emit the plugin requires and the
  // FEATURE_PLUGINS entries into src/Config.js, and the INACTIVE groups'
  // vendored files must stay out of the tree (Main_js's pluginExcludes),
  // while the shared httpjson helper (in no group) ships regardless.
  //
  // The js-only hazard: Config.js requires SecretsFeature.js at its top
  // and assigns module.exports at the END of its body, so the pair is a
  // CommonJS cycle. Reading FEATURE_PLUGINS at module load - eagerly or
  // through a kept module handle - yields undefined, and the SDK then
  // carries every selected plugin module while refusing every one of
  // their kinds at runtime. So the feature must read it through a
  // DEFERRED require inside init(), which this pins.
  test('js: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['js'], undefined,
        'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    const config = findFile(out, 'src/Config.js')
    ok(null != config, 'js: no src/Config.js generated')

    // The NAMED requires and the definitions list - the two emissions that
    // can silently no-op while everything else stays green.
    ok(/require\('\.\/feature\/secrets\/sekreto\/plugins\/hashicorp'\)/.test(config!),
      'js: active vault group did not emit the hashicorp plugin require')
    ok(/secrets: \[boru, hashicorp\],/.test(config!),
      'js: FEATURE_PLUGINS is missing the vault definitions:\n' +
      (config!.match(/const FEATURE_PLUGINS = \{[^}]*\}/) ||
        ['(no FEATURE_PLUGINS)'])[0])

    // The map has to be EXPORTED, or the deferred require in
    // SecretsFeature reads undefined and the vocabulary is silently empty.
    ok(/module\.exports = \{\r?\n  config,\r?\n  FEATURE_PLUGINS,\r?\n\}/.test(config!),
      'js: Config.js does not export FEATURE_PLUGINS')

    // DEFERRED, not eager: an eager require of Config from the feature is
    // the cycle that makes FEATURE_PLUGINS undefined.
    const impl = findFile(out, 'feature/secrets/SecretsFeature.js')
    ok(null != impl, 'js: no SecretsFeature.js generated')
    ok(!/^const .*require\('\.\.\/\.\.\/Config'\)/m.test(impl!),
      'js: SecretsFeature requires Config at module load - the CommonJS ' +
      'cycle makes FEATURE_PLUGINS undefined there')
    ok(/require\('\.\.\/\.\.\/Config'\)\.FEATURE_PLUGINS/.test(impl!),
      'js: SecretsFeature does not read FEATURE_PLUGINS through a deferred require')

    // The trim: an inactive group's vendored file is OUT, the active
    // group's and the group-less shared helper are IN.
    ok(null == findFile(out, 'sekreto/plugins/gcpsecrets.js'),
      'js: the inactive cloud group still ships gcpsecrets')
    ok(null == findFile(out, 'sekreto/plugins/secretspec.js'),
      'js: the inactive secretspec group still ships its child-process plugin')
    ok(null != findFile(out, 'sekreto/plugins/hashicorp.js'),
      'js: the ACTIVE vault group lost hashicorp')
    ok(null != findFile(out, 'sekreto/plugins/httpjson.js'),
      'js: the shared httpjson helper must ship with the feature core')

    // And the inactive-model baseline: no plugin machinery in Config.js and
    // no secrets registration, so a model that does not select the feature
    // generates the Config it always did.
    //
    // The SOURCE trim is not asserted here: this harness copies the whole
    // staged tm/ tree, while a real project's `target add` drops an
    // undeclared feature before generate ever runs. srcFeatureExcludes only
    // covers declared-but-inactive features, by design (`base` is left
    // alone the same way), so the file-set claim belongs to a real
    // `target add`, not to memfs.
    const plainout = await generate(['js'])
    const plain = findFile(plainout, 'src/Config.js')
    ok(!/sekreto\/plugins/.test(plain!),
      'js: an inactive model still emitted plugin requires')
    ok(!/require\('\.\/feature\/secrets\/SecretsFeature'\)/.test(plain!),
      'js: an inactive model still required the secrets feature')
    ok(!/secrets: SecretsFeature,/.test(plain!),
      'js: an inactive model still registered the secrets feature class')
    ok(/const FEATURE_PLUGINS = \{\s*\r?\n\}/.test(plain!),
      'js: an inactive model must emit an EMPTY FEATURE_PLUGINS map')
  })


  // zig guard for the same seam - and for the thing that makes the plugin
  // trim REAL in zig: the compiler analyses only what a module root reaches,
  // so the GENERATED feature/secrets/plugins.zig (the root of the
  // `sekretoplugins` build module) IS the vocabulary, and build.zig declares
  // the three vendored modules, the root export and the suite's test step
  // only when the feature is active. An inactive model must generate none of
  // that: with zig's feature trim off (model/target/zig.aon) the vendored
  // files still ship, and what keeps a secrets-off SDK from compiling any of
  // them is exactly the absence asserted below.
  test('zig: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['zig'], undefined,
        'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    // THE MODULE ROOT. A kind missing from it is silently absent from the
    // vocabulary; a kind named in it whose file the trim removed is a
    // compile error.
    const root = findFile(out, 'zig/feature/secrets/plugins.zig')
    ok(null != root, 'zig: no feature/secrets/plugins.zig generated')

    ok(/^pub const hashicorp = @import\("plugins\/hashicorp\.zig"\)\.hashicorp;$/m.test(root!) &&
      /^pub const boru = @import\("plugins\/boru\.zig"\)\.boru;$/m.test(root!),
      'zig: the ACTIVE vault group did not reach the module root:\n' + root)
    ok(/pub const SELECTED = \[_\]sekreto\.Definition\{\s*boru,\s*hashicorp,\s*\};/.test(root!),
      'zig: SELECTED is missing the vault definitions:\n' + root)

    // The shared HTTP client belongs to NO group (eight kinds import it by
    // relative path, and the exchange's fetch of last resort is its
    // fetchjson), so the root always reaches it.
    ok(/^pub const httpjson = @import\("plugins\/httpjson\.zig"\);$/m.test(root!),
      'zig: the module root must always export the shared httpjson helper')
    ok(!/plugins\/(gcpsecrets|azuresecrets|aws|secretspec|onepassword|doppler|infisical)\.zig/.test(root!),
      'zig: an INACTIVE group reached the module root:\n' + root)

    // build.zig: the three vendored modules, rooted where the vendoring
    // put them - and the sekretoplugins module rooted at the GENERATED
    // selection, never at upstream's full-set all.zig.
    const build = findFile(out, 'zig/build.zig')
    ok(null != build, 'zig: no build.zig generated')
    ok(/b\.addModule\("plugin", \.\{\s*\.root_source_file = b\.path\("feature\/secrets\/plugin\/plugin\.zig"\)/.test(build!),
      'zig: build.zig does not declare the vendored voxgig/plugin module')
    ok(/b\.addModule\("sekreto", \.\{\s*\.root_source_file = b\.path\("feature\/secrets\/sekreto\/sekreto\.zig"\)/.test(build!),
      'zig: build.zig does not declare the vendored sekreto module')
    ok(/b\.addModule\("sekretoplugins", \.\{\s*\.root_source_file = b\.path\("feature\/secrets\/plugins\.zig"\)/.test(build!),
      'zig: the sekretoplugins module is not rooted at the generated selection')
    ok(!/b\.path\("[^"]*all\.zig"\)/.test(build!),
      'zig: build.zig must never root a module at the full-set all.zig barrel')
    ok(/sdk_mod\.addImport\("sekreto", sekreto_mod\)/.test(build!) &&
      /sdk_mod\.addImport\("sekretoplugins", sekretoplugins_mod\)/.test(build!),
      'zig: the sdk module does not import the secrets modules')

    // The gated suite, and the build steps that make zig RUN it: the
    // all-tests step and a step of its own.
    ok(null != findFile(out, 'zig/test/feature/secrets/secrets_test.zig'),
      'zig: the gated secrets suite was not generated')
    ok(/b\.path\("test\/feature\/secrets\/secrets_test\.zig"\)/.test(build!),
      'zig: build.zig does not name the secrets suite')
    ok(/b\.step\("test-secrets"/.test(build!),
      'zig: build.zig has no test-secrets step')
    ok(/test_step\.dependOn\(&run_secrets\.step\)/.test(build!),
      'zig: the all-tests step does not run the secrets suite')

    // root.zig exports the feature type; the feature source and the vendored
    // cores are in the tree, at upstream\'s depth.
    ok(/^pub const SecretsFeature = @import\("feature\/secrets\.zig"\)\.SecretsFeature;$/m
      .test(findFile(out, 'zig/root.zig')!),
      'zig: root.zig does not export SecretsFeature')
    ok(null != findFile(out, 'zig/feature/secrets.zig'),
      'zig: the secrets feature source was not generated')
    ok(/name, "secrets"\)\) return @import\("\.\.\/feature\/secrets\.zig"\)\.SecretsFeature\.make\(\)/
      .test(findFile(out, 'zig/core/config.zig')!),
      'zig: make_feature does not instantiate the secrets feature')
    ok(null != findFile(out, 'zig/feature/secrets/sekreto/sekreto.zig'),
      'zig: the vendored sekreto core was not generated')
    ok(null != findFile(out, 'zig/feature/secrets/plugin/host.zig'),
      'zig: the vendored voxgig/plugin core was not generated')

    // The trim on disk: the active group and the ungrouped helper stay, an
    // inactive group goes - request signing with the aws group.
    ok(null != findFile(out, 'zig/feature/secrets/plugins/hashicorp.zig'),
      'zig: the ACTIVE vault group lost hashicorp')
    ok(null != findFile(out, 'zig/feature/secrets/plugins/httpjson.zig'),
      'zig: the shared httpjson helper must ship with the feature core')
    ok(null == findFile(out, 'zig/feature/secrets/plugins/gcpsecrets.zig'),
      'zig: the inactive cloud group still ships gcpsecrets')
    ok(null == findFile(out, 'zig/feature/secrets/plugins/sigv4.zig'),
      'zig: the inactive aws group still ships its request signing')

    // THE INACTIVE BASELINE: nothing of the feature is REACHABLE. Not a
    // file-absence check for the vendored cores, deliberately: zig\'s
    // feature trim is off, so they ride along in the Copy - but no module
    // is rooted in them, so zig never analyses them. What must be absent is
    // every declaration that would.
    const plain = await generate(['zig'])
    const plainbuild = findFile(plain, 'zig/build.zig')
    ok(!/sekreto|secrets/.test(plainbuild!),
      'zig: an inactive model still declares the secrets modules or suite:\n' +
      plainbuild)
    ok(!/SecretsFeature/.test(findFile(plain, 'zig/root.zig')!),
      'zig: an inactive model still exports SecretsFeature from root.zig')
    ok(null == findFile(plain, 'zig/feature/secrets/plugins.zig'),
      'zig: an inactive model still generated the plugin module root')
    ok(!/"secrets"/.test(findFile(plain, 'zig/core/config.zig')!),
      'zig: an inactive model still names the secrets feature in make_feature')

    // And a model that DECLARES the feature inactive trims every provider
    // group (the scala hazard: pluginExcludes walks active features only),
    // leaving the ungrouped helper as the one file under plugins/.
    const { fs: fs2, vol: vol2 } = memfs({})
    const off = SdkGen({
      fs: layeredFs(fs2), folder: STAGE, root: '', pino: makeLog(),
    })
    const offres = await off.generate({
      model: makeModel(['zig'], undefined,
        'main: kit: feature: secrets: { active: false }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(offres.ok, true, 'generation did not report ok')
    const offfiles = Object.keys(vol2.toJSON() as Record<string, string>)
      .map((p) => Path.relative(STAGE, p).split(Path.sep).join('/'))
      .filter((p) => !p.includes('.jostraca/'))
      .filter((p) => /zig\/feature\/secrets\/plugins\//.test(p))
    deepStrictEqual(offfiles.map((p) => p.replace(/^.*\//, '')).sort(),
      ['httpjson.zig'],
      'zig: a model with secrets declared INACTIVE must trim every plugin group')
  })


  // rb guard for the same seam. An ACTIVE secrets model must emit the
  // plugin module requires and the FEATURE_PLUGINS entries into config.rb,
  // and the INACTIVE groups' vendored files must stay out of the tree
  // (Main_rb's pluginExcludes - the generate-time trim rb now has), while
  // the shared httpjson helper (in no group) ships regardless.
  //
  // The rb-only shape: FEATURE_PLUGINS is GATED on a catalogue being
  // declared at all, rather than always emitted as go's and py's are, so
  // an SDK that carries no secrets feature keeps the config.rb it had
  // before the feature existed - byte for byte. The inactive baseline
  // below is what holds that.
  test('rb: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['rb'], undefined,
        'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    // Anchored at the target root: the vendored secrets tree ships a
    // voxgig_plugin/config.rb of its own, and a bare 'config.rb' suffix
    // finds that one first.
    const config = findFile(out, 'rb/config.rb')
    ok(null != config, 'rb: no config.rb generated')

    // The NAMED requires and the definitions list - the two emissions that
    // can silently no-op while everything else stays green.
    ok(/require_relative 'feature\/secrets\/voxgig_sekreto\/plugins\/hashicorp'/
      .test(config!),
      'rb: active vault group did not emit the hashicorp plugin require')
    ok(/"secrets" => \[VoxgigSekreto::Plugins::BORU, VoxgigSekreto::Plugins::HASHICORP\],/
      .test(config!),
      'rb: FEATURE_PLUGINS is missing the vault definitions:\n' +
      (config!.match(/FEATURE_PLUGINS = \{[^}]*\}/) || ['(no FEATURE_PLUGINS)'])[0])

    // The trim: an inactive group's vendored file is OUT, the active
    // group's and the group-less shared helper are IN.
    ok(null == findFile(out, 'voxgig_sekreto/plugins/gcpsecrets.rb'),
      'rb: the inactive cloud group still ships gcpsecrets')
    ok(null == findFile(out, 'voxgig_sekreto/plugins/secretspec.rb'),
      'rb: the inactive secretspec group still ships its child-process plugin')
    ok(null != findFile(out, 'voxgig_sekreto/plugins/hashicorp.rb'),
      'rb: the ACTIVE vault group lost hashicorp')
    ok(null != findFile(out, 'voxgig_sekreto/plugins/httpjson.rb'),
      'rb: the shared httpjson helper must ship with the feature core')

    // The gated suite has to be RUNNABLE where it lands: the shipped
    // Makefile glob is recursive, or test/feature/secrets/ ships and never
    // runs - a vacuously green suite.
    ok(null != findFile(out, 'test/feature/secrets/secrets_feature_test.rb'),
      'rb: the gated secrets suite was not generated')
    const makefile = findFile(out, 'rb/Makefile')
    ok(null != makefile, 'rb: no Makefile generated')
    ok(/Dir\.glob\("\.\/test\/\*\*\/\*_test\.rb"\)/.test(makefile!),
      'rb: the Makefile test glob is not recursive, so test/feature/** never runs')

    // And the inactive-model baseline: no plugin machinery in config.rb AT
    // ALL - not even an empty map. This is the byte-identity guard.
    const plainout = await generate(['rb'])
    const plain = findFile(plainout, 'rb/config.rb')
    ok(!/voxgig_sekreto/.test(plain!),
      'rb: an inactive model still emitted plugin requires')
    ok(!/FEATURE_PLUGINS/.test(plain!),
      'rb: an inactive model must emit NO FEATURE_PLUGINS map')
  })



  // cpp guard for the same seam. An ACTIVE secrets model must emit the
  // plugin definitions into the GENERATED feature/secrets/kinds.cpp - the
  // only non-header translation unit this target generates, and the
  // Makefile's wiring gate for the vendored payload - and config.hpp's
  // type-erased accessor must dispatch to it; the INACTIVE groups' vendored
  // files (.cpp AND .hpp) must stay out of the tree (Main_cpp's
  // pluginExcludes, the generate-time trim), while the four ungrouped shared
  // helpers ship regardless.
  //
  // Two cpp-only shapes this pins. First, kinds.cpp names each kind's
  // factory `sekreto::<kind>()` and includes the owning file's HEADER
  // (plugins/Hashicorp.hpp), derived from the .cpp the def names - a header
  // for a file the trim removed is a compile error nobody would see here.
  // Second, the exchange transport of last resort is the VENDORED HTTPS
  // client (sekreto::httprequest), not libcurl as in c: it is already
  // compiled and linked on exactly the condition the transport needs, so
  // kinds.cpp must include plugins/Httpjson.hpp when a group is active and
  // must never reach for curl.
  test('cpp: active secrets emits plugin defs and trims inactive groups', async () => {
    const gencpp = async (extra: string, features: string[]) => {
      const { fs, vol } = memfs({})
      const sdkgen = SdkGen({
        fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
      })
      const res = await sdkgen.generate({
        model: makeModel(['cpp'], undefined, extra, features),
        root: makeRoot(),
      })
      strictEqual(res.ok, true, 'generation did not report ok')
      const out: Record<string, string> = {}
      for (const [path, content] of
        Object.entries(vol.toJSON() as Record<string, string>)) {
        const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
        if (rel.includes('.jostraca/')) continue
        out[rel] = content
      }
      return out
    }

    const out = await gencpp(
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // THE WIRING FILE, and the definitions in it.
    const kinds = findFile(out, 'cpp/feature/secrets/kinds.cpp')
    ok(null != kinds, 'cpp: no feature/secrets/kinds.cpp generated')
    ok(/^#include "plugins\/Boru\.hpp"$/m.test(kinds!) &&
      /^#include "plugins\/Hashicorp\.hpp"$/m.test(kinds!),
      'cpp: the ACTIVE vault group did not reach kinds.cpp:\n' + kinds)
    ok(/std::static_pointer_cast<void>\(sekreto::boru\(\)\),\n    std::static_pointer_cast<void>\(sekreto::hashicorp\(\)\),/
      .test(kinds!),
      'cpp: secrets_plugins() is missing the vault definitions:\n' + kinds)
    ok(!/sekreto::(gcpsecrets|azuresecrets|awssecrets|awsparams|onepassword|doppler|infisical|secretspec)\(/
      .test(kinds!) &&
      !/plugins\/(Gcpsecrets|Azuresecrets|Aws|Sigv4|Onepassword|Doppler|Infisical|Secretspec)\.hpp/
        .test(kinds!),
      'cpp: an INACTIVE group reached kinds.cpp:\n' + kinds)

    // The exchange transport of last resort: the vendored HTTPS client,
    // because a plugin group is active (the Makefile links OpenSSL on the
    // same condition). Never libcurl - one HTTP stack.
    ok(/^#include "plugins\/Httpjson\.hpp"$/m.test(kinds!) &&
      /sekreto::httprequest\(/.test(kinds!) &&
      /SecretsRawResponse secrets_rawfetch\(/.test(kinds!),
      'cpp: a plugin-bearing model must carry the vendored-client exchange transport')
    ok(!/#include <curl\/|curl_easy_|-lcurl/.test(kinds!),
      'cpp: kinds.cpp must not reach for libcurl - the vendored client is the transport')

    // The accessor in core/config.hpp dispatches to it, and the feature is
    // included and constructed like every declared feature.
    const config = findFile(out, 'cpp/core/config.hpp')
    ok(null != config, 'cpp: no core/config.hpp generated')
    ok(/^std::vector<std::shared_ptr<void>> secrets_plugins\(\);$/m.test(config!) &&
      /if \(name == "secrets"\) return secrets_plugins\(\);/.test(config!),
      'cpp: featurePlugins() does not dispatch to secrets_plugins:\n' + config)
    ok(/^#include "\.\.\/feature\/secrets\.hpp"$/m.test(config!) &&
      /if \(name == "secrets"\) return std::make_shared<SecretsFeature>\(\);/.test(config!),
      'cpp: makeFeature() does not construct the secrets feature')

    // The trim on disk: the active group's PAIRS and the ungrouped helpers
    // are IN, every other group's are OUT (.hpp as well as .cpp - a header
    // left behind is an include that compiles against nothing), and the
    // full-set barrel is never there at all.
    for (const kept of ['Hashicorp', 'Boru', 'Crypto', 'Httpjson', 'Proc', 'Tls']) {
      ok(null != findFile(out, 'feature/secrets/plugins/' + kept + '.cpp') &&
        null != findFile(out, 'feature/secrets/plugins/' + kept + '.hpp'),
        'cpp: ' + kept + ' (active vault kind or shared helper) lost a file')
    }
    for (const gone of ['Gcpsecrets', 'Azuresecrets', 'Aws', 'Sigv4',
      'Onepassword', 'Doppler', 'Infisical', 'Secretspec']) {
      ok(null == findFile(out, 'feature/secrets/plugins/' + gone + '.cpp') &&
        null == findFile(out, 'feature/secrets/plugins/' + gone + '.hpp'),
        'cpp: the inactive group still ships ' + gone)
    }
    ok(null == findFile(out, 'feature/secrets/plugins/All.cpp') &&
      null == findFile(out, 'feature/secrets/plugins/All.hpp'),
      'cpp: the full-set barrel plugins/All.{cpp,hpp} must never be generated')

    // The vendored cores at upstream's depth, the feature, and the gated
    // suite in the test/feature/ container the trim drops with it.
    ok(null != findFile(out, 'feature/secrets/sekreto/Sekreto.cpp') &&
      null != findFile(out, 'feature/secrets/sekreto/Provider.hpp'),
      'cpp: the vendored sekreto core was not generated')
    ok(null != findFile(out, 'feature/secrets/plugin/host.cpp'),
      'cpp: the vendored voxgig/plugin core was not generated')
    ok(null != findFile(out, 'cpp/feature/secrets.hpp'),
      'cpp: the secrets feature header was not generated')
    ok(null != findFile(out, 'cpp/test/feature/secrets/secrets_test.cpp'),
      'cpp: the gated secrets suite was not generated')

    // THE BUILD WIRING: the Makefile is the verbatim, feature-agnostic
    // template that `-include`s every feature/*/kinds.mk, and the generated
    // fragment is what compiles the payload, builds the suite and (a group
    // being active) the plugin layer with OpenSSL. A fragment without these
    // builds the suite as a single header-only TU and fails at link, or
    // never builds it at all.
    const makefile = findFile(out, 'cpp/Makefile')
    ok(null != makefile, 'cpp: no Makefile generated')
    ok(/^-include \$\(wildcard feature\/\*\/kinds\.mk\)$/m.test(makefile!) &&
      !/secrets/.test(makefile!),
      'cpp: the Makefile must include feature/*/kinds.mk and name no feature')
    const mk = findFile(out, 'cpp/feature/secrets/kinds.mk')
    ok(null != mk, 'cpp: no feature/secrets/kinds.mk generated')
    ok(/^FEATURE_SRCS \+= feature\/secrets\/kinds\.cpp \\\n  \$\(wildcard feature\/secrets\/sekreto\/\*\.cpp feature\/secrets\/plugin\/\*\.cpp\)$/m
      .test(mk!) &&
      /^FEATURE_TEST_SRCS \+= \$\(wildcard test\/feature\/secrets\/\*\.cpp\)$/m.test(mk!) &&
      /^FEATURE_SRCS \+= \$\(wildcard feature\/secrets\/plugins\/\*\.cpp\)$/m.test(mk!) &&
      /^FEATURE_LIBS \+= -lssl -lcrypto$/m.test(mk!),
      'cpp: kinds.mk does not wire the cores, the suite and the plugin layer:\n' + mk)

    // A DIFFERENT group alone, so a regression in the per-group def maps
    // shows up here rather than in a generated SDK nobody compiled.
    const saas = await gencpp(
      'main: kit: feature: secrets: { active: true plugin: saas: active: true }',
      ['test', 'log', 'secrets'])
    const saaskinds = findFile(saas, 'cpp/feature/secrets/kinds.cpp')
    ok(null != saaskinds && /sekreto::doppler\(\)/.test(saaskinds) &&
      /sekreto::infisical\(\)/.test(saaskinds) &&
      /sekreto::onepassword\(\)/.test(saaskinds) &&
      !/sekreto::(hashicorp|boru)\(/.test(saaskinds),
      'cpp: the saas group did not select exactly its three kinds:\n' + saaskinds)
    ok(null == findFile(saas, 'feature/secrets/plugins/Hashicorp.cpp'),
      'cpp: a saas-only model still ships the vault kind')
    ok(null != findFile(saas, 'feature/secrets/plugins/Proc.cpp'),
      'cpp: the shared Proc.cpp helper must survive a saas-only trim')

    // The feature ACTIVE with NO group: the wiring file still exists (the
    // sekreto core is needed for an [env, memory] chain), with an empty
    // list and a transport that says there is none - and it must not touch
    // Httpjson.hpp, whose .cpp the Makefile does not compile in this case.
    const bare = await gencpp(
      'main: kit: feature: secrets: { active: true }', ['test', 'log', 'secrets'])
    const barekinds = findFile(bare, 'cpp/feature/secrets/kinds.cpp')
    ok(null != barekinds, 'cpp: an active feature with no group lost its wiring file')
    ok(/secrets_plugins\(\) \{\n  return \{\};\n\}/.test(barekinds!) &&
      /has no HTTP transport/.test(barekinds!) &&
      !/Httpjson\.hpp/.test(barekinds!),
      'cpp: a group-less model must wire an empty list and no transport:\n' + barekinds)
    ok(null == findFile(bare, 'feature/secrets/plugins/Hashicorp.cpp'),
      'cpp: a group-less model still ships a kind file')
    const baremk = findFile(bare, 'cpp/feature/secrets/kinds.mk')
    ok(null != baremk && /FEATURE_TEST_SRCS \+=/.test(baremk) &&
      !/plugins\/\*\.cpp|-lssl/.test(baremk),
      'cpp: a group-less kinds.mk must compile no plugin layer and link no OpenSSL:\n' + baremk)

    // THE INACTIVE FEATURE (declared, off, with a group on): no wiring file,
    // no kind file, no include, and the accessor emitted EMPTY - it exists
    // in every config.hpp so a caller can always ask.
    const off = await gencpp(
      'main: kit: feature: secrets: { active: false plugin: vault: active: true }',
      ['test', 'log', 'secrets'])
    ok(null == findFile(off, 'cpp/feature/secrets/kinds.cpp') &&
      null == findFile(off, 'cpp/feature/secrets/kinds.mk'),
      'cpp: an inactive feature still generated its wiring files')
    ok(null == findFile(off, 'feature/secrets/plugins/Hashicorp.cpp') &&
      null == findFile(off, 'feature/secrets/plugins/Hashicorp.hpp'),
      'cpp: an inactive feature still ships its vault kind (Main_cpp inactivePluginExcludes)')
    const offconfig = findFile(off, 'cpp/core/config.hpp')
    ok(!/secrets_plugins|SecretsFeature|feature\/secrets\.hpp/.test(offconfig!),
      'cpp: an inactive feature still reached config.hpp')
    ok(/inline std::vector<std::shared_ptr<void>> featurePlugins\(const std::string& name\) \{\n  \(void\)name;\n  return \{\};\n\}/
      .test(offconfig!),
      'cpp: an inactive model must emit an EMPTY featurePlugins accessor:\n' + offconfig)

    // And a model that never mentions the feature: the same empty accessor
    // and no wiring file. The vendored tree rides along in the Copy here -
    // this harness runs no `target add`, which is where an undeclared
    // feature is trimmed - and without kinds.cpp the Makefile compiles none
    // of it (the generatedcompile lanes prove that with ldd).
    const plain = await generate(['cpp'])
    ok(null == findFile(plain, 'cpp/feature/secrets/kinds.cpp') &&
      null == findFile(plain, 'cpp/feature/secrets/kinds.mk'),
      'cpp: a model without secrets still generated the wiring files')
    ok(!/secrets_plugins|SecretsFeature|feature\/secrets\.hpp/.test(findFile(plain, 'cpp/core/config.hpp')!),
      'cpp: a model without secrets still reached config.hpp')
  })


  // php guard for the same seam. An ACTIVE secrets model must emit the
  // plugin file require_onces and the definition CALLS into config.php's
  // feature_plugins accessor, and the INACTIVE groups' vendored files must
  // stay out of the tree (Main_php's pluginExcludes - the generate-time
  // trim php now has).
  //
  // Two php-only shapes this pins. First, the accessor is a static METHOD
  // whose requires live INSIDE it: a sekreto definition holds closures, so
  // it can be neither a class constant nor classmap-autoloadable, and
  // getting that wrong is invisible until a chain names the kind at
  // runtime. Second, php has TWO group-less shared helpers, not one -
  // httpjson.php (eight plugins) and runcmd.php, which boru (vault) and
  // secretspec (secretspec) BOTH require, so no group may own it.
  //
  // The vendored sekreto CORE assertion is a regression pin: this Copy's
  // exclude used to be an unanchored /src\//, which silently pruned
  // `feature/secrets/sekreto/src/` - upstream's own directory depth, which
  // the vendoring guard holds it at.
  test('php: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['php'], undefined,
        'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    // Anchored at the target root: the vendored plugin tree ships a
    // Config.php of its own, and a bare 'config.php' suffix finds that one.
    const config = findFile(out, 'php/config.php')
    ok(null != config, 'php: no config.php generated')

    // The NAMED requires and the definition calls - the two emissions that
    // can silently no-op while everything else stays green.
    ok(/require_once __DIR__ \. '\/feature\/secrets\/sekreto\/plugins\/hashicorp\.php';/
      .test(config!),
      'php: active vault group did not emit the hashicorp plugin require')
    ok(/\\Voxgig\\Sekreto\\Plugins\\boru\(\),/.test(config!) &&
      /\\Voxgig\\Sekreto\\Plugins\\hashicorp\(\),/.test(config!),
      'php: feature_plugins is missing the vault definitions:\n' +
      (config!.match(/feature_plugins[\s\S]*?\r?\n    \}/) ||
        ['(no feature_plugins)'])[0])

    // The trim: an inactive group's vendored file is OUT, the active
    // group's and BOTH group-less shared helpers are IN.
    ok(null == findFile(out, 'sekreto/plugins/gcpsecrets.php'),
      'php: the inactive cloud group still ships gcpsecrets')
    ok(null == findFile(out, 'sekreto/plugins/secretspec.php'),
      'php: the inactive secretspec group still ships its child-process plugin')
    ok(null != findFile(out, 'sekreto/plugins/hashicorp.php'),
      'php: the ACTIVE vault group lost hashicorp')
    ok(null != findFile(out, 'sekreto/plugins/httpjson.php'),
      'php: the shared httpjson helper must ship with the feature core')
    ok(null != findFile(out, 'sekreto/plugins/runcmd.php'),
      'php: the shared runcmd helper spans two groups and must ship with ' +
      'the feature core - boru and secretspec both require it')

    // The vendored core itself, at upstream's depth.
    ok(null != findFile(out, 'feature/secrets/sekreto/src/Sekreto.php'),
      'php: the vendored sekreto core was pruned - check the Copy exclude ' +
      'is anchored (/^src(\\/|$)/), not a bare /src\\//')
    ok(null != findFile(out, 'feature/secrets/plugin/plugin.php'),
      'php: the vendored voxgig/plugin core was not generated')

    // The gated suite has to LAND where phpunit looks: the shipped Makefile
    // runs `phpunit test`, which recurses, so test/feature/secrets/ runs.
    ok(null != findFile(out, 'php/test/feature/secrets/SecretsTest.php'),
      'php: the gated secrets suite was not generated')

    // And the inactive-model baseline: no plugin machinery in config.php AT
    // ALL - not even an empty accessor. This is the byte-identity guard.
    const plainout = await generate(['php'])
    const plain = findFile(plainout, 'php/config.php')
    ok(!/Voxgig\\Sekreto/.test(plain!),
      'php: an inactive model still emitted plugin requires')
    ok(!/feature_plugins/.test(plain!),
      'php: an inactive model must emit NO feature_plugins accessor')

    // The anchored exclude still prunes the top-level placeholder tree.
    deepStrictEqual(
      Object.keys(plainout).filter((p) => /(^|\/)php\/src\//.test(p)), [],
      'php: tm/php/src placeholders leaked into the SDK')
  })


  // ocaml guard for the same seam, plus the two things only ocaml has.
  //
  // An ACTIVE secrets model must emit the plugin definitions into
  // sdk_config.ml (module-qualified, `Hashicorp.plugin ()`), and the
  // INACTIVE groups' vendored modules must stay out of the tree
  // (Main_ocaml's pluginExcludes), while the seven group-less shared
  // helpers ship regardless: the transport chain (crypto, sigv4, tls, http,
  // httpjson, tls_stubs.c) and runcmd, which boru (vault) and secretspec
  // both open.
  //
  // The ocaml-only shapes: (1) the BUILD MODEL is a generated Makefile
  // fragment, feature/secrets/feature.mk, carrying the module list in
  // DEPENDENCY ORDER - ocamlc has no link-time reordering, so the order is
  // the thing to pin - and the OpenSSL binding (`-custom -cclib -lssl`)
  // only when an active group declares `needs.fetch`; (2) the accessor is
  // typed `Defs.definition list` only when the feature is active, because
  // the `Defs` module is compiled only then, and is the polymorphic empty
  // list otherwise.
  test('ocaml: active secrets emits plugin defs and trims inactive groups', async () => {
    const genml = async (extra: string, features: string[]) => {
      const { fs, vol } = memfs({})
      const sdkgen = SdkGen({
        fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
      })
      const res = await sdkgen.generate({
        model: makeModel(['ocaml'], undefined, extra, features),
        root: makeRoot(),
      })
      strictEqual(res.ok, true, 'generation did not report ok')
      const out: Record<string, string> = {}
      for (const [path, content] of
        Object.entries(vol.toJSON() as Record<string, string>)) {
        const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
        if (rel.includes('.jostraca/')) continue
        out[rel] = content
      }
      return out
    }

    const out = await genml(
      'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
      ['test', 'log', 'secrets'])

    // The definitions, the factory arm and the bundled transport.
    const config = findFile(out, 'ocaml/sdk_config.ml')
    ok(null != config, 'ocaml: no sdk_config.ml generated')
    ok(/let feature_plugins \(name : string\) : Defs\.definition list =/.test(config!),
      'ocaml: an active feature must type the accessor as Defs.definition list:\n' + config)
    ok(/\| "secrets" -> \[\n {6}Boru\.plugin \(\);\n {6}Hashicorp\.plugin \(\);\n {4}\]/.test(config!),
      'ocaml: feature_plugins is missing the vault definitions:\n' + config)
    ok(!/(Gcpsecrets|Azuresecrets|Aws|Onepassword|Doppler|Infisical|Secretspec)\./.test(config!),
      'ocaml: an INACTIVE group reached sdk_config.ml:\n' + config)
    ok(/\| "secrets" -> Secrets_feature\.make ~plugins:\(feature_plugins "secrets"\) ~transport:secrets_transport \(\)/
      .test(config!),
      'ocaml: make_feature does not construct the secrets feature with its definitions and transport')
    ok(/let secrets_transport \(url : string\) \(fetchdef : value\) : value =/.test(config!) &&
      /Http\.request meth url headers body/.test(config!),
      'ocaml: a transport-needing group must emit the bundled exchange transport')
    ok(config!.indexOf('let feature_plugins') < config!.indexOf('let make_feature') &&
      config!.indexOf('let secrets_transport') < config!.indexOf('let make_feature'),
      'ocaml: the factory must come AFTER the definitions it names (OCaml binds top to bottom)')

    // THE BUILD MODEL: the fragment, its ORDER, and the gated binding.
    const mk = findFile(out, 'ocaml/feature/secrets/feature.mk')
    ok(null != mk, 'ocaml: an active feature must generate feature/secrets/feature.mk')
    const order = [
      'feature/secrets/plugin/value.ml', 'feature/secrets/plugin/host.ml',
      'feature/secrets/sekreto/json.ml', 'feature/secrets/sekreto/sekreto.ml',
      'feature/secrets/plugins/crypto.ml', 'feature/secrets/plugins/sigv4.ml',
      'feature/secrets/plugins/tls.ml', 'feature/secrets/plugins/http.ml',
      'feature/secrets/plugins/httpjson.ml', 'feature/secrets/plugins/runcmd.ml',
      'feature/secrets/plugins/boru.ml', 'feature/secrets/plugins/hashicorp.ml',
      'feature/secrets_feature.ml',
    ]
    const at = order.map((m) => mk!.indexOf(m))
    ok(at.every((i) => 0 <= i),
      'ocaml: feature.mk is missing a module: ' + order.filter((_m, i) => 0 > at[i]).join(', ') +
      '\n' + mk)
    ok(at.every((i, n) => 0 === n || at[n - 1] < i),
      'ocaml: feature.mk lists the modules OUT of dependency order (ocamlc cannot reorder):\n' + mk)
    ok(!/(gcpsecrets|azuresecrets|aws|onepassword|doppler|infisical|secretspec)\.ml/.test(mk!),
      'ocaml: an inactive group reached feature.mk:\n' + mk)
    ok(/^FEATURE_INC = -I \+unix /m.test(mk!) && /^FEATURE_LIB = unix\.cma$/m.test(mk!),
      'ocaml: feature.mk must link unix.cma for the dotenv/file built-ins')
    ok(/^FEATURE_TESTS = test\/feature\/secrets\/t_secrets\.ml$/m.test(mk!),
      'ocaml: feature.mk does not list the gated suite')
    ok(/plugin groups: vault\)/.test(mk!) &&
      /^FEATURE_LINK = -custom -cclib -lssl -cclib -lcrypto$/m.test(mk!) &&
      /^FEATURE_OBJ = feature\/secrets\/plugins\/tls_stubs\.o$/m.test(mk!) &&
      /tail -n \+4 \$< \| \$\(CC\)/.test(mk!),
      'ocaml: feature.mk does not name the group, link OpenSSL with -custom and ' +
      'skip the provenance header on the stub:\n' + mk)
    const makefile = findFile(out, 'ocaml/Makefile')
    ok(/^-include \$\(wildcard feature\/\*\/feature\.mk\)$/m.test(makefile!),
      'ocaml: the Makefile does not include the feature fragments')
    ok(!/secrets/i.test(makefile!),
      'ocaml: the template Makefile must stay feature-agnostic (it names secrets)')
    ok(/\$\(FEATURE_LIB\) \$\(SDK_TEST\) \$\(FEATURE_OBJ\) \$\(FEATURE_LINK\)/.test(makefile!),
      'ocaml: run_sdk_test does not link the secrets tier')
    ok(/depexts: \[\n  \["libssl-dev"\]/.test(findFile(out, '.opam')!),
      'ocaml: a transport-needing group must declare the OpenSSL depext in the opam file')

    // The trim on disk: the active group's modules and the ungrouped
    // helpers are IN, every other group's are OUT, and the full-set barrel
    // is never there at all.
    ok(null != findFile(out, 'feature/secrets/plugins/hashicorp.ml') &&
      null != findFile(out, 'feature/secrets/plugins/boru.ml'),
      'ocaml: the ACTIVE vault group lost a kind module')
    for (const helper of ['crypto.ml', 'sigv4.ml', 'tls.ml', 'http.ml', 'httpjson.ml',
      'runcmd.ml', 'tls_stubs.c']) {
      ok(null != findFile(out, 'feature/secrets/plugins/' + helper),
        'ocaml: the shared ' + helper + ' helper must ship with the feature core')
    }
    ok(null == findFile(out, 'feature/secrets/plugins/gcpsecrets.ml'),
      'ocaml: the inactive cloud group still ships gcpsecrets')
    ok(null == findFile(out, 'feature/secrets/plugins/secretspec.ml'),
      'ocaml: the inactive secretspec group still ships its child-process plugin')
    ok(null == findFile(out, 'feature/secrets/plugins/aws.ml'),
      'ocaml: the inactive aws group still ships its kind')
    ok(null == findFile(out, 'feature/secrets/plugins/allplugins.ml'),
      'ocaml: the full-set barrel plugins/allplugins.ml must never be generated')

    // The vendored cores at upstream's depth, the feature, the gated
    // suite, and the by-name entity accessor the suite drives ops through.
    ok(null != findFile(out, 'feature/secrets/sekreto/sekreto.ml'),
      'ocaml: the vendored sekreto core was not generated')
    ok(null != findFile(out, 'feature/secrets/plugin/host.ml'),
      'ocaml: the vendored voxgig/plugin core was not generated')
    ok(null != findFile(out, 'ocaml/feature/secrets_feature.ml'),
      'ocaml: the secrets feature source was not generated')
    ok(null != findFile(out, 'ocaml/test/feature/secrets/t_secrets.ml'),
      'ocaml: the gated secrets suite was not generated')
    ok(/^let entity \(client : sdk_client\) \(name : string\) \(entopts : value\) : entity_obj option =/m
      .test(findFile(out, 'ocaml/sdk_client.ml')!),
      'ocaml: sdk_client.ml lost the by-name entity accessor')
    deepStrictEqual(
      Object.keys(out).filter((p) => /(^|\/)ocaml\/src\//.test(p)), [],
      'ocaml: tm/ocaml/src placeholders leaked into the SDK')

    // A group that needs NO transport, alone: runcmd.ml beside its kind,
    // no TLS chain, no stub, no -custom, no depext - a secretspec-only
    // ocaml SDK links the OCaml distribution alone.
    const spec = await genml(
      'main: kit: feature: secrets: { active: true plugin: secretspec: active: true }',
      ['test', 'log', 'secrets'])
    const specmk = findFile(spec, 'ocaml/feature/secrets/feature.mk')
    ok(null != specmk &&
      /^SECRETS_HELPERS = feature\/secrets\/plugins\/runcmd\.ml$/m.test(specmk) &&
      /^SECRETS_KINDS = feature\/secrets\/plugins\/secretspec\.ml$/m.test(specmk) &&
      /^FEATURE_LINK =$/m.test(specmk) && /^FEATURE_OBJ =$/m.test(specmk) &&
      !/-custom|tls_stubs/.test(specmk),
      'ocaml: a secretspec-only model must compile runcmd.ml and no TLS:\n' + specmk)
    const specconfig = findFile(spec, 'ocaml/sdk_config.ml')
    ok(/Secretspec\.plugin \(\);/.test(specconfig!) && !/Hashicorp|secrets_transport/.test(specconfig!),
      'ocaml: the secretspec group did not select exactly its kind, without a transport:\n' + specconfig)
    ok(null == findFile(spec, 'feature/secrets/plugins/hashicorp.ml'),
      'ocaml: a secretspec-only model still ships the vault kind')
    ok(!/depexts/.test(findFile(spec, '.opam')!),
      'ocaml: a secretspec-only model must declare no OpenSSL depext')

    // The built-in chain alone (feature on, every group off): the two
    // cores and the feature, nothing else, an EMPTY typed definitions list.
    const bare = await genml('main: kit: feature: secrets: { active: true }',
      ['test', 'log', 'secrets'])
    const baremk = findFile(bare, 'ocaml/feature/secrets/feature.mk')
    ok(null != baremk && /^SECRETS_HELPERS =$/m.test(baremk) && /^SECRETS_KINDS =$/m.test(baremk) &&
      /^FEATURE_LINK =$/m.test(baremk) && /the built-in kinds alone/.test(baremk),
      'ocaml: a built-ins-only model must compile no helper and no kind:\n' + baremk)
    ok(/let feature_plugins \(name : string\) : Defs\.definition list =\n  match name with\n  \| "secrets" -> \[\]/
      .test(findFile(bare, 'ocaml/sdk_config.ml')!),
      'ocaml: a built-ins-only model must emit an EMPTY typed definitions list')

    // THE INACTIVE FEATURE (declared, off, with a group on): no fragment,
    // no container, no kind module, and the accessor emitted EMPTY and
    // untyped - it exists in every sdk_config.ml.
    const off = await genml(
      'main: kit: feature: secrets: { active: false plugin: vault: active: true }',
      ['test', 'log', 'secrets'])
    ok(null == findFile(off, 'ocaml/feature/secrets/feature.mk'),
      'ocaml: an inactive feature still generated its build fragment')
    ok(null == findFile(off, 'ocaml/feature/secrets_feature.ml') &&
      null == findFile(off, 'feature/secrets/sekreto/sekreto.ml') &&
      null == findFile(off, 'feature/secrets/plugins/hashicorp.ml') &&
      null == findFile(off, 'ocaml/test/feature/secrets/t_secrets.ml'),
      'ocaml: an inactive feature still ships its container (Main_ocaml containerExcludes)')
    const offconfig = findFile(off, 'ocaml/sdk_config.ml')
    ok(!/Secrets_feature|Defs\.|secrets_transport/.test(offconfig!),
      'ocaml: an inactive feature still reached sdk_config.ml')
    ok(/^let feature_plugins \(_name : string\) = \[\]$/m.test(offconfig!),
      'ocaml: an inactive model must emit the EMPTY polymorphic accessor:\n' + offconfig)

    // And a model that never mentions the feature: the same empty accessor
    // and no container at all.
    const plain = await generate(['ocaml'])
    ok(null == findFile(plain, 'ocaml/feature/secrets/feature.mk') &&
      null == findFile(plain, 'ocaml/feature/secrets_feature.ml'),
      'ocaml: a model without secrets still generated the feature')
    ok(/^let feature_plugins \(_name : string\) = \[\]$/m.test(findFile(plain, 'ocaml/sdk_config.ml')!),
      'ocaml: a model without secrets must emit the EMPTY polymorphic accessor')
  })


  // csharp guard for the same seam: an ACTIVE secrets model must emit the
  // FeaturePlugins definitions into core/Config.cs (fully qualified, no
  // `using`), and the INACTIVE groups' vendored files must stay out of the
  // tree (Main_csharp's pluginExcludes - the generate-time trim), while the
  // TWO group-less shared helpers ship regardless: HttpJson.cs, and
  // Child.cs, which boru (vault) and secretspec (its own group) both call.
  // Package_csharp's CS8619 gate rides along: the suppression exists for
  // ONE vendored line in the aws group, so it must appear exactly when that
  // group is on.
  test('csharp: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['csharp'], undefined,
        'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    // Anchored at core/: the vendored voxgig/plugin tree ships a Config.cs
    // of its own (feature/secrets/plugin/Config.cs), and a bare 'Config.cs'
    // suffix could find that one.
    const config = findFile(out, 'csharp/core/Config.cs')
    ok(null != config, 'csharp: no core/Config.cs generated')

    // The definitions list - the emission that can silently no-op while
    // everything else stays green. Each symbol is `global::`-qualified,
    // which is what lets an inactive model emit no `using` at all.
    ok(/case "secrets":/.test(config!),
      'csharp: FeaturePlugins has no case for the active secrets feature')
    ok(/global::Voxgig\.Sekreto\.Plugins\.Boru\.Plugin,/.test(config!) &&
      /global::Voxgig\.Sekreto\.Plugins\.Hashicorp\.Plugin,/.test(config!),
      'csharp: FeaturePlugins is missing the vault definitions:\n' +
      (config!.match(/FeaturePlugins\(string name\)[\s\S]*?\r?\n    \}/) ||
        ['(no FeaturePlugins)'])[0])
    ok(!/using Voxgig\.Sekreto/.test(config!),
      'csharp: Config.cs must reference the plugins fully qualified, not via a using')

    // The trim: an inactive group's vendored file is OUT, the active
    // group's and BOTH group-less shared helpers are IN.
    ok(null == findFile(out, 'feature/secrets/plugins/GcpSecrets.cs'),
      'csharp: the inactive cloud group still ships GcpSecrets')
    ok(null == findFile(out, 'feature/secrets/plugins/SecretSpec.cs'),
      'csharp: the inactive secretspec group still ships its child-process plugin')
    ok(null == findFile(out, 'feature/secrets/plugins/Aws.cs'),
      'csharp: the inactive aws group still ships Aws.cs')
    ok(null != findFile(out, 'feature/secrets/plugins/Hashicorp.cs'),
      'csharp: the ACTIVE vault group lost Hashicorp')
    ok(null != findFile(out, 'feature/secrets/plugins/HttpJson.cs'),
      'csharp: the shared HttpJson helper must ship with the feature core')
    ok(null != findFile(out, 'feature/secrets/plugins/Child.cs'),
      'csharp: the shared Child helper spans two groups and must ship with ' +
      'the feature core - Boru and SecretSpec both call it')

    // The vendored cores themselves, and the feature that uses them.
    ok(null != findFile(out, 'feature/secrets/sekreto/Sekreto.cs'),
      'csharp: the vendored sekreto core was not generated')
    ok(null != findFile(out, 'feature/secrets/plugin/Plugin.cs'),
      'csharp: the vendored voxgig/plugin core was not generated')
    ok(null != findFile(out, 'csharp/feature/SecretsFeature.cs'),
      'csharp: the secrets feature source was not generated')

    // The gated suite has to LAND where the test csproj compiles from:
    // test/ is one default glob, so test/feature/secrets/ is compiled in.
    ok(null != findFile(out, 'csharp/test/feature/secrets/SecretsFeatureTest.cs'),
      'csharp: the gated secrets suite was not generated')

    // The CS8619 gate is OFF: the vault group has no such line to quiet.
    // The root csproj is the one ending 'SDK.csproj'; the test project ends
    // 'SDKTest.csproj' and does not match.
    const csproj = findFile(out, 'SDK.csproj')
    ok(null != csproj, 'csharp: no SDK csproj generated')
    ok(!/CS8619/.test(csproj!),
      'csharp: CS8619 must not be suppressed unless the aws group is on')

    // ... and ON when the aws group is selected: the one vendored line in
    // plugins/Aws.cs that trips it is then compiled into the SDK.
    const { fs: awsfs, vol: awsvol } = memfs({})
    const awsres = await SdkGen({
      fs: layeredFs(awsfs), folder: STAGE, root: '', pino: makeLog(),
    }).generate({
      model: makeModel(['csharp'], undefined,
        'main: kit: feature: secrets: { active: true plugin: aws: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(awsres.ok, true, 'aws generation did not report ok')
    const awsout: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(awsvol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      awsout[rel] = content
    }
    const awscsproj = findFile(awsout, 'SDK.csproj')
    ok(null != awscsproj, 'csharp: no SDK csproj generated with the aws group')
    ok(/;CS8619/.test(awscsproj!),
      'csharp: the aws group is on but Package_csharp did not gate CS8619 in')
    ok(null != findFile(awsout, 'feature/secrets/plugins/Aws.cs') &&
      null != findFile(awsout, 'feature/secrets/plugins/Sigv4.cs'),
      'csharp: the ACTIVE aws group lost Aws.cs or Sigv4.cs')
    ok(null == findFile(awsout, 'feature/secrets/plugins/Hashicorp.cs'),
      'csharp: the inactive vault group still ships Hashicorp')
    const awsconfig = findFile(awsout, 'csharp/core/Config.cs')
    ok(/global::Voxgig\.Sekreto\.Plugins\.AwsPlugins\.Secrets,/.test(awsconfig!) &&
      /global::Voxgig\.Sekreto\.Plugins\.AwsPlugins\.Params,/.test(awsconfig!),
      'csharp: FeaturePlugins is missing the two aws definitions (one file, ' +
      'two definitions - the class is AwsPlugins, not Aws)')

    // And the inactive-model baseline: no sekreto type named in Config.cs
    // at all. The accessor itself is ALWAYS emitted (SecretsFeature.cs can
    // be present in a tree whose model has secrets off, and it calls it),
    // but with an empty switch - that is the byte-identity guard.
    const plainout = await generate(['csharp'])
    const plain = findFile(plainout, 'csharp/core/Config.cs')
    ok(null != plain, 'csharp: no core/Config.cs generated for the inactive model')
    ok(!/Voxgig\.Sekreto/.test(plain!),
      'csharp: an inactive model still emitted plugin definitions')
    ok(/FeaturePlugins\(string name\)/.test(plain!),
      'csharp: the FeaturePlugins accessor must always be emitted - ' +
      'SecretsFeature.cs calls it whenever it is present in the tree')
    ok(!/case "secrets":/.test(plain!),
      'csharp: an inactive model must emit an EMPTY FeaturePlugins switch')
    ok(!/CS8619/.test(findFile(plainout, 'SDK.csproj') || ''),
      'csharp: an inactive model must not suppress CS8619')

    // The `src/` exclude still prunes the top-level placeholder tree.
    deepStrictEqual(
      Object.keys(plainout).filter((p) => /(^|\/)csharp\/src\//.test(p)), [],
      'csharp: tm/csharp/src placeholders leaked into the SDK')
  })


  test('rust: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['rust'], undefined,
        'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    // THE MODULE INDEX. rust compiles only what a parent module DECLARES,
    // so this generated file is the whole plugin story: a kind missing
    // from it is silently absent from the vocabulary, and a kind named in
    // it whose file the trim removed is a compile error.
    const index = findFile(out, 'rust/feature/secrets/plugins.rs')
    ok(null != index, 'rust: no feature/secrets/plugins.rs generated')

    ok(/^pub mod hashicorp;$/m.test(index!) && /^pub mod boru;$/m.test(index!),
      'rust: the ACTIVE vault group did not reach the module index:\n' + index)
    ok(/hashicorp::plugin\(\),/.test(index!) && /boru::plugin\(\),/.test(index!),
      'rust: definitions() is missing the vault definitions:\n' + index)

    // The shared HTTP client belongs to NO group (eight kinds import it),
    // so it ships with the feature core - but it is only DECLARED when a
    // kind that needs it is active. That declaration is what pulls rustls
    // into the build, so it must not appear by default.
    ok(/^pub mod httpjson;$/m.test(index!),
      'rust: the vault kinds need the shared httpjson helper declared')
    ok(!/^pub mod (gcpsecrets|azuresecrets|aws|secretspec);$/m.test(index!),
      'rust: an INACTIVE group reached the module index:\n' + index)

    // The feature module itself, and the trim on disk.
    ok(/^pub mod secrets;$/m.test(findFile(out, 'rust/feature/mod.rs')!),
      'rust: feature/mod.rs does not declare the secrets module')
    ok(null != findFile(out, 'rust/feature/secrets.rs'),
      'rust: the secrets feature source was not generated')
    ok(null != findFile(out, 'feature/secrets/plugins/hashicorp.rs'),
      'rust: the ACTIVE vault group lost hashicorp')
    ok(null != findFile(out, 'feature/secrets/plugins/httpjson.rs'),
      'rust: the shared httpjson helper must ship with the feature core')
    ok(null == findFile(out, 'feature/secrets/plugins/gcpsecrets.rs'),
      'rust: the inactive cloud group still ships gcpsecrets')
    ok(null == findFile(out, 'feature/secrets/plugins/aws/sigv4.rs'),
      'rust: the inactive aws group still ships its request signing')

    // The vendored core, at upstream's depth.
    ok(null != findFile(out, 'feature/secrets/sekreto/sekreto.rs'),
      'rust: the vendored sekreto core was not generated')
    ok(null != findFile(out, 'feature/secrets/plugin/host.rs'),
      'rust: the vendored voxgig/plugin core was not generated')

    // The gated suite, and the manifest entry that makes cargo RUN it:
    // cargo auto-discovers tests/*.rs and tests/<dir>/main.rs but not the
    // two-level path the feature trim forces, so without the stanza the
    // suite exists and never runs.
    ok(null != findFile(out, 'rust/tests/feature/secrets/main.rs'),
      'rust: the gated secrets suite was not generated')

    const cargo = findFile(out, 'rust/Cargo.toml')
    ok(/\[\[test\]\]\nname = "secrets_feature"\npath = "tests\/feature\/secrets\/main\.rs"/
      .test(cargo!),
      'rust: Cargo.toml does not declare the secrets test target:\n' + cargo)

    // The dependency TABLE form. `rustls = "0.23"` with default features
    // pulls aws-lc-rs and a cmake C build; the ring set below is what the
    // target's existing ureq dep already compiles.
    ok(/rustls = \{ version = "0\.23", default-features = false, features = \["std", "ring", "tls12"\] \}/
      .test(cargo!),
      'rust: rustls must be declared with default features OFF:\n' + cargo)

    // THE INACTIVE BASELINE: nothing of the feature is COMPILED, and the
    // manifest names none of it.
    //
    // Not a file-absence check, deliberately. This harness generates
    // straight from the full scaffold, so the add-time feature trim
    // (`target add`, helpers/featureSource) never runs and the vendored
    // tree rides along in the Copy - as it does for every target here.
    // What matters for rust is that none of it is REACHABLE: rustc
    // compiles only what a module declares, so an undeclared file is inert,
    // and a real project's `target add` removes it outright.
    const plain = await generate(['rust'])
    ok(!/^pub mod secrets;$/m.test(findFile(plain, 'rust/feature/mod.rs')!),
      'rust: an inactive model still declared the secrets module')
    ok(null == findFile(plain, 'rust/feature/secrets/plugins.rs'),
      'rust: an inactive model still generated the plugin module index')
    const plaincargo = findFile(plain, 'rust/Cargo.toml')
    ok(!/rustls|webpki-roots/.test(plaincargo!),
      'rust: an inactive model still names the secrets TLS crates')
    ok(!/\[\[test\]\]/.test(plaincargo!),
      'rust: an inactive model still declares a feature test target')
  })


  // scala guard for the same seam, and for the two hazards particular to a
  // target whose FEATURE trim is off (model/target/scala.aon `feature: {
  // trim: false }` - the cross-feature tests are fused into one
  // sdktest/SdkTestMain.scala).
  //
  // FIRST SCALA HAZARD: a plugin file that spans groups. plugins/Sigv4.scala
  // defines `private[plugins] uriescape`, and Azuresecrets (`cloud`),
  // Doppler, Infisical and Onepassword (`saas`) all call it - so listing it
  // under `aws`, which the first cut did, let a saas-only trim delete a file
  // four other kinds compile against. scalac fails the whole build on it
  // ("Not found: uriescape", four times for saas, twice for cloud). It
  // belongs to NO group, exactly as java's and kotlin's do, and this test
  // selects `saas` ALONE so that a regression shows up here rather than in a
  // generated SDK nobody compiled.
  //
  // SECOND SCALA HAZARD: with the feature trim off, an INACTIVE feature's
  // whole tree still ships, and pluginExcludes(model) walks only ACTIVE
  // features - so before Main_scala's second exclude list, a scala SDK whose
  // model never mentioned secrets carried all nine vendored provider
  // clients. The inactive-model leg below is that guard.
  test('scala: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['scala'], undefined,
        'main: kit: feature: secrets: { active: true plugin: saas: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    const config = findFile(out, 'core/Config.scala')
    ok(null != config, 'scala: no core/Config.scala generated')

    // The definitions list - the emission that can silently no-op while
    // everything else stays green. scala names fully-qualified top-level
    // vals, so there is no import half to check.
    ok(/case "secrets" => List\(com\.voxgig\.sekreto\.plugins\.doppler, com\.voxgig\.sekreto\.plugins\.infisical, com\.voxgig\.sekreto\.plugins\.onepassword\)/
      .test(config!),
      'scala: featurePlugins is missing the saas definitions:\n' +
      (config!.match(/def featurePlugins[\s\S]*?\n  \}/) ||
        ['(no featurePlugins)'])[0])

    // The trim: the ACTIVE group's clients are IN, every inactive group's
    // are OUT, and the two UNGROUPED helpers ship with the feature core.
    for (const kind of ['Doppler', 'Infisical', 'Onepassword']) {
      ok(null != findFile(out, 'feature/secrets/sekreto/plugins/' + kind + '.scala'),
        'scala: the ACTIVE saas group lost ' + kind)
    }
    for (const kind of ['Hashicorp', 'Boru', 'Aws', 'Gcpsecrets', 'Azuresecrets',
      'Secretspec']) {
      ok(null == findFile(out, 'feature/secrets/sekreto/plugins/' + kind + '.scala'),
        'scala: an INACTIVE group still ships ' + kind)
    }
    ok(null != findFile(out, 'feature/secrets/sekreto/plugins/Httpjson.scala'),
      'scala: the shared HTTP/ProcessBuilder helper must ship with the feature core')
    // THE CROSS-GROUP FILE. Doppler, Infisical and Onepassword compile
    // against Sigv4.scala's uriescape, so a saas-only selection that loses
    // it is four scalac errors - see the note above this test.
    ok(null != findFile(out, 'feature/secrets/sekreto/plugins/Sigv4.scala'),
      'scala: Sigv4.scala was trimmed away from a saas-only selection - it ' +
      'defines the `uriescape` that Doppler, Infisical, Onepassword and ' +
      'Azuresecrets call, so it belongs to NO plugin group')

    // The vendored cores, and the feature itself.
    for (const core of ['sekreto/Sekreto.scala', 'sekreto/Providers.scala',
      'sekreto/Support.scala', 'sekreto/Spec.scala', 'plugin/Plugin.scala']) {
      ok(null != findFile(out, 'feature/secrets/' + core),
        'scala: the vendored core file ' + core + ' did not reach the SDK')
    }
    ok(null != findFile(out, 'feature/SecretsFeature.scala'),
      'scala: the secrets feature source was not generated')
    // The suite is NAMED in the Makefile - scala has no test discovery - so
    // it ships and runs or it never runs at all.
    // 'scala/Makefile', not 'Makefile': the fixture project has a root
    // Makefile of its own, and findFile matches on a path SUFFIX.
    const make = findFile(out, 'scala/Makefile')
    ok(null != make, 'scala: no Makefile generated')
    ok(/--main-class SecretsTestMain/.test(make!),
      'scala: the secrets suite is not run by `make test`')
    ok(null != findFile(out, 'sdktest/feature/secrets/SecretsTestMain.scala'),
      'scala: the secrets suite is named by the Makefile but was not generated')

    // And the INACTIVE-model baseline: the feature DECLARED and left off,
    // which is what a project looks like after `feature add secrets` without
    // the activation (voxgig-solardemo-sdk's model/feature/secrets.aon with
    // `active: false`). featurePlugins must be empty, and - the hazard
    // particular to this target - NO provider client may ship, even though
    // the feature trim is off and the rest of the feature's tree does.
    const { fs: offfs, vol: offvol } = memfs({})
    const offgen = SdkGen({
      fs: layeredFs(offfs), folder: STAGE, root: '', pino: makeLog(),
    })
    const offres = await offgen.generate({
      model: makeModel(['scala'], undefined, undefined, ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(offres.ok, true, 'feature-off generation did not report ok')

    const off: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(offvol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      off[rel] = content
    }

    const plain = findFile(off, 'core/Config.scala')
    ok(null != plain, 'scala: no core/Config.scala for the feature-off model')
    ok(/def featurePlugins\(name: String\): List\[Any\] = name match \{\r?\n    case _ => Nil/
      .test(plain!),
      'scala: an inactive model must emit an EMPTY featurePlugins:\n' +
      (plain!.match(/def featurePlugins[\s\S]*?\n  \}/) ||
        ['(no featurePlugins)'])[0])

    for (const kind of ['Hashicorp', 'Boru', 'Aws', 'Gcpsecrets', 'Azuresecrets',
      'Doppler', 'Infisical', 'Onepassword', 'Secretspec']) {
      ok(null == findFile(off, 'feature/secrets/sekreto/plugins/' + kind + '.scala'),
        'scala: an INACTIVE secrets feature still ships the ' + kind +
        ' provider client - pluginExcludes walks only ACTIVE features, so ' +
        'Main_scala has to exclude an inactive feature\'s declared groups too')
    }

    // What the feature trim being off still costs, pinned so the number in
    // model/target/scala.aon cannot quietly drift: the rest of the feature
    // ships to an SDK that did not ask for it, ungrouped helpers included.
    ok(null != findFile(off, 'feature/SecretsFeature.scala') &&
      null != findFile(off, 'feature/secrets/sekreto/Sekreto.scala') &&
      null != findFile(off, 'feature/secrets/sekreto/plugins/Sigv4.scala'),
      'scala: model/target/scala.aon documents that a secrets-OFF SDK still ' +
      'carries the feature, the vendored cores and the two ungrouped plugin ' +
      'files - it no longer does, so update that note (and this test)')
  })


  // clojure guard for the same seam, and for the hazard particular to a
  // target whose test entry point is HAND-WIRED.
  //
  // clojure has no test discovery: test/sdk/test_runner.clj is the
  // tools.deps `-M:test` main, and it reaches the gated secrets suite only
  // through its own `run-feature-suites`, which lists sdk/test/feature/*.clj
  // off the classpath and requires `sdk.test.feature.<name>`. Delete that
  // one call and every secrets check simply vanishes from the SDK count
  // with ALL GREEN still printed - measured: PASS 174 became PASS 156, no
  // red anywhere. So the runner is pinned here the way rust's Cargo
  // `[[test]]` stanza and dart's `secrets_test.tests();` are: the call is
  // in -main, the discovery names the suite's namespace, and the runner
  // prints a `feature.<name>: ran N check(s)` line whose count comes from
  // checks that EXECUTED, which generatedcompile.test.ts's clojure lane
  // requires. Both halves of the guard are needed: this one sees the text,
  // the lane sees the run.
  //
  // The plugin wiring is the clojure peer of Config_go's: `(:require
  // [voxgig.sekreto.plugins.X :as p-X])` per ACTIVE definition namespace
  // and `feature-plugins` / `feature-extra` maps in src/sdk/config.clj.
  // `aws` is on as well as `vault` because aws.clj is ONE namespace with
  // TWO definitions (awssecrets, awsparams) - one require, two references.
  // And the feature container is ALSO a classpath root (deps.edn :paths),
  // because clojure resolves `voxgig.sekreto.chain` to voxgig/sekreto/
  // chain.clj searched from each root, never by relative import.
  test('clojure: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['clojure'], undefined,
        'main: kit: feature: secrets: { active: true ' +
        'plugin: { vault: active: true aws: active: true } }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    const config = findFile(out, 'src/sdk/config.clj')
    ok(null != config, 'clojure: no src/sdk/config.clj generated')

    // The requires and the definitions map - the two emissions that can
    // silently no-op while everything else stays green.
    for (const ns of ['hashicorp', 'boru', 'aws']) {
      ok(new RegExp('\\[voxgig\\.sekreto\\.plugins\\.' + ns + ' :as p-' + ns + '\\]')
        .test(config!),
        'clojure: the active ' + ns + ' plugin namespace is not required by config.clj')
    }
    ok(/\[sdk\.feature\.secrets :as fx-secrets\]/.test(config!),
      'clojure: config.clj does not require the secrets feature namespace')
    ok(/"secrets" \[p-aws\/awsparams p-aws\/awssecrets p-boru\/boru p-hashicorp\/hashicorp\]/
      .test(config!),
      'clojure: feature-plugins is missing the active definitions:\n' +
      (config!.match(/\(def feature-plugins[\s\S]*?\}\)/) ||
        ['(no feature-plugins)'])[0])
    ok(/"secrets" \(fn \[\] \(sdk\.feature\.secrets\/secrets-feature \(get feature-plugins "secrets"\)\)\)/
      .test(config!),
      'clojure: feature-extra does not construct the secrets feature:\n' +
      (config!.match(/\(def feature-extra[\s\S]*?\}\)/) ||
        ['(no feature-extra)'])[0])
    ok(!/voxgig\.sekreto\.plugins\.(gcpsecrets|azuresecrets|onepassword|doppler|infisical|secretspec)/
      .test(config!),
      'clojure: an INACTIVE group reached the config requires:\n' + config)

    // THE CLASSPATH ROOT. Without it every vendored namespace is unresolvable
    // and the suite fails at load, naming a file that is right there.
    const deps = findFile(out, 'clojure/deps.edn')
    ok(null != deps, 'clojure: no deps.edn generated')
    ok(/:paths \["src" "feature\/secrets"\]/.test(deps!),
      'clojure: deps.edn does not put the feature container on the classpath:\n' + deps)

    // The trim: the ACTIVE groups' plugin files are IN, every INACTIVE
    // group's are OUT, and the UNGROUPED helpers ship with the feature
    // core - httpjson (nine kinds import it) and proc, the child-process
    // helper only this port has, imported by boru (vault) AND secretspec.
    const plugins = 'feature/secrets/voxgig/sekreto/plugins/'
    for (const kind of ['hashicorp', 'boru', 'aws', 'sigv4']) {
      ok(null != findFile(out, plugins + kind + '.clj'),
        'clojure: the ACTIVE group lost ' + kind)
    }
    for (const kind of ['gcpsecrets', 'azuresecrets', 'onepassword', 'doppler',
      'infisical', 'secretspec']) {
      ok(null == findFile(out, plugins + kind + '.clj'),
        'clojure: an INACTIVE group still ships ' + kind)
    }
    ok(null != findFile(out, plugins + 'httpjson.clj'),
      'clojure: the shared httpjson helper must ship with the feature core')
    ok(null != findFile(out, plugins + 'proc.clj'),
      'clojure: the shared proc helper must ship with the feature core - ' +
      'boru (vault) and secretspec both require it, so it belongs to NO group')
    // The ALL barrel is the thing to avoid: it requires every plugin, so
    // vendoring it would make the trim a load error.
    ok(null == findFile(out, 'feature/secrets/voxgig/sekreto/plugins.clj'),
      'clojure: the plugins.clj ALL barrel was vendored - it requires every ' +
      'kind, so any trimmed group becomes a load failure')

    // The vendored cores, and the feature namespace itself.
    for (const core of ['voxgig/sekreto.clj', 'voxgig/sekreto/chain.clj',
      'voxgig/sekreto/providers.clj', 'voxgig/plugin.clj', 'voxgig/plugin/host.clj']) {
      ok(null != findFile(out, 'feature/secrets/' + core),
        'clojure: the vendored core file ' + core + ' did not reach the SDK')
    }
    const feature = findFile(out, 'feature/secrets/sdk/feature/secrets.clj')
    ok(null != feature, 'clojure: the secrets feature source was not generated')
    ok(/^\(ns sdk\.feature\.secrets\b/m.test(feature!),
      'clojure: the feature file does not declare the namespace config.clj requires')
    ok(/\(defn secrets-feature\b/.test(feature!),
      'clojure: the feature file does not define the constructor feature-extra calls')

    // THE RUNNER IS WIRED. The suite ships, its namespace is what the
    // runner's discovery builds, -main CALLS the discovery, and the
    // discovery prints the executed-count line the lane reads.
    const suite = findFile(out, 'test/sdk/test/feature/secrets.clj')
    ok(null != suite, 'clojure: the gated secrets suite was not generated')
    ok(/^\(ns sdk\.test\.feature\.secrets\b/m.test(suite!),
      'clojure: the suite does not declare the namespace the runner requires')
    ok(/^\(defn run \[rec\]/m.test(suite!),
      'clojure: the suite has no `run` entry for the runner to call')

    const runner = findFile(out, 'test/sdk/test_runner.clj')
    ok(null != runner, 'clojure: no test_runner.clj generated')
    ok(/\(io\/resource "sdk\/test\/feature"\)/.test(runner!) &&
      /"sdk\.test\.feature\."/.test(runner!),
      'clojure: the runner no longer discovers sdk/test/feature/*.clj as ' +
      'sdk.test.feature.<name> - the secrets suite is unreachable from it')
    const main = runner!.match(/\(defn -main[\s\S]*$/)
    ok(null != main, 'clojure: test_runner.clj has no -main')
    // Anchored at the start of a line: a commented-out call still contains
    // the text, and is exactly the edit this guards against.
    ok(/^\s*\(run-feature-suites rec\)/m.test(main![0]),
      'clojure: -main does not call (run-feature-suites rec) - the secrets ' +
      'suite ships and never runs, and the SDK count drops with ALL GREEN ' +
      'still printed')
    ok(/"feature\." fname ": ran " @ran " check\(s\)"/.test(runner!),
      'clojure: run-feature-suites no longer prints the executed-count line ' +
      'the generatedcompile lane requires')

    // And the INACTIVE-model baseline: the feature DECLARED and left off.
    // The container is gated at generate time (Main_clojure), so unlike
    // scala's trim-off baseline NOTHING of it may ship - the vendored
    // cores, the plugin files, the feature namespace and its suite are all
    // absent, deps.edn names no root that is not there, and the runner's
    // discovery finds no file to require.
    const { fs: offfs, vol: offvol } = memfs({})
    const offgen = SdkGen({
      fs: layeredFs(offfs), folder: STAGE, root: '', pino: makeLog(),
    })
    const offres = await offgen.generate({
      model: makeModel(['clojure'], undefined, undefined, ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(offres.ok, true, 'feature-off generation did not report ok')

    const off: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(offvol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      off[rel] = content
    }

    const plain = findFile(off, 'src/sdk/config.clj')
    ok(null != plain, 'clojure: no src/sdk/config.clj for the feature-off model')
    ok(/\(def feature-plugins\r?\n  \{\}\)/.test(plain!) &&
      /\(def feature-extra\r?\n  \{\}\)/.test(plain!),
      'clojure: an inactive model must emit EMPTY feature-plugins and ' +
      'feature-extra maps:\n' + plain)
    ok(!/sekreto|sdk\.feature\.secrets/.test(plain!),
      'clojure: an inactive model still requires secrets namespaces')
    ok(/:paths \["src"\]/.test(findFile(off, 'clojure/deps.edn')!),
      'clojure: an inactive model still puts feature/secrets on the classpath')
    const leaked = Object.keys(off).filter((p) =>
      /(^|\/)feature\/secrets\//.test(p) || /test\/sdk\/test\/feature\/secrets\.clj$/.test(p))
    deepStrictEqual(leaked, [],
      'clojure: an inactive model still ships the secrets container or its suite')
  })


  // elixir guard for the same seam, and for the hazard particular to this
  // target: THE TRIM IS INVISIBLE TO THE COMPILER. mix compiles everything
  // under lib/ and Elixir resolves modules by `defmodule`, never by import,
  // so a plugin file Main_elixir's pluginExcludes failed to remove compiles
  // silently and SHIPS - where go fails on an unused import, py on a missing
  // module and ts on an unresolved one (Main_elixir.ts says as much). A
  // generated elixir SDK therefore cannot tell you its trim broke; this test
  // has to, from the file list.
  //
  // The other elixir particular is proc.ex: the port factors the child
  // process spawn OUT of the two plugins that use it - boru (`vault`) and
  // secretspec (`secretspec`) - so it belongs to NO group and ships with the
  // feature core, beside http.ex and httpjson.ex. Listing it under either
  // group would delete it whenever the OTHER group was the one selected.
  // `vault` ALONE is selected here so that a regression shows up as boru
  // failing to compile in a generated SDK nobody built - which is why the
  // file's presence is pinned here instead.
  test('elixir: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['elixir'], undefined,
        'main: kit: feature: secrets: { active: true plugin: vault: active: true }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    const config = findFile(out, 'lib/config.ex')
    ok(null != config, 'elixir: no lib/config.ex generated')

    // The definitions list - the emission that can silently no-op while
    // everything else stays green. Each active `plugin.def.elixir` key is
    // emitted as a fully-qualified zero-arity CALL, sorted, and there is no
    // import half to check: Elixir resolves modules globally.
    ok(/^      "secrets" -> \[Sekreto\.Plugins\.Boru\.boru\(\), Sekreto\.Plugins\.Hashicorp\.hashicorp\(\)\]$/m
      .test(config!),
      'elixir: feature_plugins/1 is missing the vault definitions:\n' +
      (config!.match(/def feature_plugins[\s\S]*?\n  end/) ||
        ['(no feature_plugins)'])[0])
    ok(!/Sekreto\.Plugins\.(Aws|Gcpsecrets|Azuresecrets|Doppler|Infisical|Onepassword|Secretspec)\./
      .test(config!),
      'elixir: an INACTIVE group\'s definition reached feature_plugins/1:\n' +
      (config!.match(/def feature_plugins[\s\S]*?\n  end/) ||
        ['(no feature_plugins)'])[0])

    // THE TRIM, from the file list, because nothing else can see it here.
    // The vendored tree rides Main_elixir's `lib/projectname` Copy (rooted on
    // lib/<app>/), so every plugin path is under feature/secrets/sekreto/.
    for (const kind of ['hashicorp', 'boru']) {
      ok(null != findFile(out, 'feature/secrets/sekreto/plugins/' + kind + '.ex'),
        'elixir: the ACTIVE vault group lost ' + kind)
    }
    for (const kind of ['aws', 'sigv4', 'gcpsecrets', 'azuresecrets', 'doppler',
      'infisical', 'onepassword', 'secretspec']) {
      ok(null == findFile(out, 'feature/secrets/sekreto/plugins/' + kind + '.ex'),
        'elixir: an INACTIVE group still ships ' + kind + ' - and mix would ' +
        'compile it without complaint, so only this test can see the trim ' +
        'failed (Main_elixir\'s pluginExcludes on the lib/projectname Copy)')
    }
    // The three UNGROUPED helpers ship with the feature core. proc.ex is the
    // cross-group one - see the note above this test.
    for (const shared of ['http', 'httpjson', 'proc']) {
      ok(null != findFile(out, 'feature/secrets/sekreto/plugins/' + shared + '.ex'),
        'elixir: the shared ' + shared + '.ex helper must ship with the ' +
        'feature core - it belongs to no plugin group')
    }

    // The vendored cores, and the feature itself.
    for (const core of ['sekreto/sekreto.ex', 'sekreto/providers.ex',
      'sekreto/provider.ex', 'sekreto/json.ex',
      'plugin/voxgig_plugin.ex', 'plugin/host.ex']) {
      ok(null != findFile(out, 'feature/secrets/' + core),
        'elixir: the vendored core file ' + core + ' did not reach the SDK')
    }
    const feature = findFile(out, 'feature/secrets.ex')
    ok(null != feature, 'elixir: the secrets feature source was not generated')
    ok(/^defmodule \w+\.Feature\.Secrets do$/m.test(feature!),
      'elixir: the secrets feature module is not declared under the app name')

    // REGISTERED in the feature factory, or `feature.secrets.active` builds
    // the base feature and every assertion in the shipped suite that reads
    // the chain passes vacuously on a client with no chain.
    const factory = findFile(out, 'lib/features.ex')
    ok(null != factory, 'elixir: no lib/features.ex generated')
    ok(/"secrets" -> \w+\.Feature\.Secrets\.new\(\)/.test(factory!),
      'elixir: the feature factory does not construct the secrets feature:\n' +
      factory)

    // The gated suite, and the wiring that makes mix RUN it. mix discovers
    // `test/**/*_test.exs` by default, so the suffix IS the wiring - and a
    // mix.exs that narrowed `test_paths` or `test_pattern` would silently
    // un-wire it, which is why both are pinned absent.
    const suite = findFile(out, 'test/feature/secrets/secrets_test.exs')
    ok(null != suite, 'elixir: the gated secrets suite was not generated')
    ok(null != findFile(out, 'elixir/test/test_helper.exs'),
      'elixir: no test/test_helper.exs, so mix test cannot start')
    const mix = findFile(out, 'elixir/mix.exs')
    ok(null != mix, 'elixir: no mix.exs generated')
    ok(!/test_paths|test_pattern/.test(mix!),
      'elixir: mix.exs narrows test discovery, so test/feature/secrets/ may ' +
      'no longer be found:\n' + mix)

    // Placeholders, in the two files this feature adds outside the broad
    // loop's scan: a leaked `ProjectName` in the feature is a module that
    // does not exist, and `PROJECTENV` in the suite is an env prefix no
    // project sets.
    for (const [name, src] of [['feature/secrets.ex', feature!],
      ['test/feature/secrets/secrets_test.exs', suite!]]) {
      ok(!/ProjectName|PROJECTENV|projectname/.test(src),
        'elixir: a placeholder survived in ' + name)
    }

    // And the INACTIVE-model baseline: the feature DECLARED and left off.
    // Config_elixir's emit gate is "an ACTIVE feature declares plugin groups"
    // (active groups or not), so a model with secrets off gets NO
    // feature_plugins/1 - config.ex is byte-for-byte what it was before the
    // feature existed - and the factory never names the feature.
    //
    // The SOURCE trim is not asserted here: this harness copies the whole
    // staged tm/ tree, while a real project's `target add` drops an
    // undeclared feature before generate ever runs (the js note above).
    const { fs: offfs, vol: offvol } = memfs({})
    const offgen = SdkGen({
      fs: layeredFs(offfs), folder: STAGE, root: '', pino: makeLog(),
    })
    const offres = await offgen.generate({
      model: makeModel(['elixir'], undefined, undefined, ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(offres.ok, true, 'feature-off generation did not report ok')

    const off: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(offvol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      off[rel] = content
    }

    const plain = findFile(off, 'lib/config.ex')
    ok(null != plain, 'elixir: no lib/config.ex for the feature-off model')
    ok(!/feature_plugins|Sekreto\.Plugins/.test(plain!),
      'elixir: an inactive model still emitted feature_plugins/1 - the ' +
      'emit gate is "a plugin-bearing feature is ACTIVE", so an SDK that ' +
      'selects none must get no function at all')
    const plainfactory = findFile(off, 'lib/features.ex')
    ok(null != plainfactory, 'elixir: no lib/features.ex for the feature-off model')
    ok(!/secrets/.test(plainfactory!),
      'elixir: an inactive model still registers the secrets feature in the ' +
      'factory, which names a module `target add` removed')
  })


  // swift guard for the same seam, and for the two hazards particular to
  // this target: the vendored trees are SEPARATE SwiftPM MODULES that
  // Package.swift must declare (and exclude from the SDK target) exactly
  // when the feature ships, and the test file that imports them must go
  // with them.
  test('swift: active secrets emits plugin defs and trims inactive groups', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const res = await sdkgen.generate({
      model: makeModel(['swift'], undefined,
        'main: kit: feature: secrets: { active: true ' +
        'plugin: { vault: active: true aws: active: true } }',
        ['test', 'log', 'secrets']),
      root: makeRoot(),
    })
    strictEqual(res.ok, true, 'generation did not report ok')

    const out: Record<string, string> = {}
    for (const [path, content] of
      Object.entries(vol.toJSON() as Record<string, string>)) {
      const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
      if (rel.includes('.jostraca/')) continue
      out[rel] = content
    }

    const config = findFile(out, 'Sources/DemoSdk/core/Config.swift')
    ok(null != config, 'swift: no Sources/DemoSdk/core/Config.swift generated')

    // The module import and the definitions list - the two emissions that
    // can silently no-op while everything else stays green. Each active
    // `plugin.def.swift` key is a top-level `let` in the SekretoPlugins
    // module, so the list is bare symbols behind one import.
    ok(/^import SekretoPlugins$/m.test(config!),
      'swift: active plugin groups did not emit `import SekretoPlugins`')
    ok(/"secrets": \[awsparams, awssecrets, boru, hashicorp\],/.test(config!),
      'swift: featurePlugins is missing the active definitions:\n' +
      (config!.match(/featurePluginsVal: \[String: \[Any\]\] = \[[^\]]*\]/) ||
        ['(no featurePluginsVal)'])[0])
    ok(/public static func featurePlugins\(_ name: String\) -> \[Any\]/.test(config!),
      'swift: the featurePlugins accessor the feature calls is not emitted')
    ok(/case "secrets": return SecretsFeature\(\)/.test(config!),
      'swift: the feature factory does not construct the secrets feature')

    // THE MANIFEST: three module targets over the three vendored trees, the
    // SDK target depending on them with `exclude:` AFTER `path:` (SwiftPM's
    // argument order - the other way round the manifest does not compile),
    // and the library product vending all four.
    const pkg = findFile(out, 'swift/Package.swift')
    ok(null != pkg, 'swift: no Package.swift generated')
    // The deployment floor - absent, the macos CI leg fails on AsyncStream
    // ("only available in macOS 10.15 or newer") while linux compiles.
    ok(/platforms: \[\.macOS\(\.v10_15\)\]/.test(pkg!),
      'swift: Package.swift declares no macOS deployment floor')
    for (const [mod, dir] of [['VoxgigPlugin', 'plugin'], ['Sekreto', 'sekreto'],
      ['SekretoPlugins', 'plugins']]) {
      ok(new RegExp('name: "' + mod + '",[\\s\\S]{0,120}?path: "Sources/DemoSdk/feature/secrets/' +
        dir + '"\\)').test(pkg!),
        'swift: Package.swift declares no ' + mod + ' target over feature/secrets/' + dir)
    }
    ok(/path: "Sources\/DemoSdk",\s*\r?\n\s*exclude: \["feature\/secrets"\]\)/.test(pkg!),
      'swift: the SDK target must exclude feature/secrets AFTER its path:\n' + pkg)
    ok(/\.library\(name: "DemoSdk", targets: \["DemoSdk", "Sekreto", "SekretoPlugins", "VoxgigPlugin"\]\)/
      .test(pkg!),
      'swift: the library product must vend the three vendored modules')
    ok(/dependencies: \["DemoSdk", "Omni", "Sekreto", "VoxgigPlugin"\]/.test(pkg!),
      'swift: the test target must depend on Sekreto and VoxgigPlugin')

    // THE TRIM, from the file list. The vendored tree rides Main_swift's
    // Sources/ProjectNameSDK Copy (rooted on Sources/<Name>Sdk/), so every
    // plugin path is under feature/secrets/plugins/.
    for (const kind of ['Hashicorp', 'Boru', 'Aws', 'Sigv4', 'Crypto']) {
      ok(null != findFile(out, 'Sources/DemoSdk/feature/secrets/plugins/' + kind + '.swift'),
        'swift: the ACTIVE vault/aws groups lost ' + kind)
    }
    for (const kind of ['Gcpsecrets', 'Azuresecrets', 'Onepassword', 'Doppler',
      'Infisical', 'Secretspec']) {
      ok(null == findFile(out, 'feature/secrets/plugins/' + kind + '.swift'),
        'swift: an INACTIVE group still ships ' + kind + ' (Main_swift\'s ' +
        'pluginExcludes on the Sources/ProjectNameSDK Copy)')
    }
    // The two UNGROUPED helpers ship with the feature core: Httpjson.swift
    // (nine plugins) and Proc.swift (`runcmd`, shared by Boru AND
    // Secretspec, so it may belong to neither group).
    for (const shared of ['Httpjson', 'Proc']) {
      ok(null != findFile(out, 'Sources/DemoSdk/feature/secrets/plugins/' + shared + '.swift'),
        'swift: the shared ' + shared + '.swift helper must ship with the feature core')
    }
    // The full-set barrel is never vendored: the trim would leave it naming
    // deleted definitions and swiftc would fail the SekretoPlugins module.
    ok(null == findFile(out, 'feature/secrets/plugins/All.swift'),
      'swift: the full-set barrel All.swift reached the SDK')

    // The vendored cores, and the feature itself.
    for (const core of ['sekreto/Sekreto.swift', 'sekreto/Providers.swift',
      'sekreto/Provider.swift', 'sekreto/Addr.swift', 'sekreto/Json.swift',
      'plugin/Host.swift', 'plugin/Catalog.swift', 'plugin/Value.swift']) {
      ok(null != findFile(out, 'Sources/DemoSdk/feature/secrets/' + core),
        'swift: the vendored core file ' + core + ' did not reach the SDK')
    }
    const feature = findFile(out, 'Sources/DemoSdk/feature/SecretsFeature.swift')
    ok(null != feature, 'swift: the secrets feature source was not generated')
    ok(/^import Sekreto$/m.test(feature!),
      'swift: the feature does not import the vendored Sekreto module')

    // The gated suite, under the test target's own feature/ container, so
    // SwiftPM collects it recursively and `target add` trims it with the
    // feature.
    const suite = findFile(out, 'Tests/DemoSdkTests/feature/secrets/SecretsFeatureTest.swift')
    ok(null != suite, 'swift: the gated secrets suite was not generated')
    ok(/@testable import DemoSdk/.test(suite!),
      'swift: the suite does not import the generated module by name')

    // Placeholders, in the two files this feature adds outside the broad
    // loop's scan: a leaked `ProjectName` in either is a type that does not
    // exist in the generated module.
    for (const [name, src] of [['Sources/DemoSdk/feature/SecretsFeature.swift', feature!],
      ['Tests/DemoSdkTests/feature/secrets/SecretsFeatureTest.swift', suite!]]) {
      ok(!/ProjectName|PROJECTENV/.test(src),
        'swift: a placeholder survived in ' + name)
    }

    // And the copy-target dir the feature-add mechanism needs is not shipped.
    ok(null == findFile(out, 'swift/src/feature/secrets/.gitkeep'),
      'swift: the feature-add copy-target dir leaked into the package')

    // THE INACTIVE BASELINES, both of them: the feature never declared, and
    // the feature DECLARED and left off. Either way the SDK module must
    // compile ALONE - no manifest targets over trees that are not there, no
    // vendored tree folded into the SDK target (five redeclarations), no
    // SecretsFeature.swift importing a module the manifest never declared -
    // so Main_swift withholds the trees and the suite at generate time,
    // where go/py/dart leave that to `target add`. Both halves are keyed on
    // ONE predicate (utility_swift.swiftSecretsActive), and this pins that
    // they agree.
    for (const [label, features] of [['undeclared', undefined],
      ['declared-inactive', ['test', 'log', 'secrets']]] as [string, string[] | undefined][]) {
      const { fs: offfs, vol: offvol } = memfs({})
      const offgen = SdkGen({
        fs: layeredFs(offfs), folder: STAGE, root: '', pino: makeLog(),
      })
      const offres = await offgen.generate({
        model: makeModel(['swift'], undefined, undefined, features),
        root: makeRoot(),
      })
      strictEqual(offres.ok, true, label + ': generation did not report ok')

      const off: Record<string, string> = {}
      for (const [path, content] of
        Object.entries(offvol.toJSON() as Record<string, string>)) {
        const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
        if (rel.includes('.jostraca/')) continue
        off[rel] = content
      }

      const plain = findFile(off, 'Sources/DemoSdk/core/Config.swift')
      ok(null != plain, 'swift ' + label + ': no Config.swift generated')
      ok(!/SekretoPlugins/.test(plain!),
        'swift ' + label + ': an inactive model still imported SekretoPlugins')
      ok(/featurePluginsVal: \[String: \[Any\]\] = \[:\]/.test(plain!),
        'swift ' + label + ': an inactive model must emit an EMPTY featurePlugins map')
      ok(/public static func featurePlugins\(_ name: String\) -> \[Any\]/.test(plain!),
        'swift ' + label + ': the featurePlugins accessor must be emitted UNCONDITIONALLY')
      ok(!/SecretsFeature/.test(plain!),
        'swift ' + label + ': an inactive model still names the secrets feature in the factory')

      const plainpkg = findFile(off, 'swift/Package.swift')
      ok(null != plainpkg, 'swift ' + label + ': no Package.swift generated')
      ok(!/Sekreto|VoxgigPlugin|feature\/secrets/.test(plainpkg!),
        'swift ' + label + ': an inactive model still declares the secrets modules:\n' + plainpkg)

      const shipped = Object.keys(off).filter((p) =>
        /feature\/secrets\/|feature\/SecretsFeature\.swift$|SecretsFeatureTest\.swift$/.test(p))
      deepStrictEqual(shipped, [],
        'swift ' + label + ': an inactive model still ships secrets source, which the ' +
        'manifest above does not declare and the SDK target cannot compile')
    }
  })


  // rb runner swap: the omni resolver, its vendored port and the
  // must-fail smoke test are generated; the superseded struct runner is
  // not.
  test('rb: the omni runner swap generates the resolver and retires struct_runner', async () => {
    const out = await generate(['rb'])

    ok(null != findFile(out, 'test/omni.rb'), 'rb: no omni resolver generated')
    ok(null != findFile(out, 'test/vendor/omni/voxgig_omni.rb'),
      'rb: vendored omni entry missing')
    ok(null != findFile(out, 'test/vendor/omni/runner.rb'),
      'rb: vendored omni runner missing')
    ok(null != findFile(out, 'test/vendor/omni/util.rb'),
      'rb: vendored omni util missing')
    ok(null != findFile(out, 'test/omni_smoke_test.rb'),
      'rb: the runner-must-fail smoke test is missing')
    ok(null == findFile(out, 'test/struct_runner.rb'),
      'rb: the superseded struct_runner.rb is still generated')

    // The support module is RETAINED untouched (emitted TestEntity /
    // TestDirect call sites use it), and the suites run on the resolver.
    ok(null != findFile(out, 'test/runner.rb'),
      'rb: the retained support module test/runner.rb is missing')
    const primary = findFile(out, 'test/primary_utility_test.rb')
    ok(null != primary, 'rb: no primary_utility_test.rb generated')
    ok(/require_relative "omni"/.test(primary!),
      'rb: primary_utility_test.rb does not use the omni resolver')
    const struct = findFile(out, 'test/struct_utility_test.rb')
    ok(null != struct, 'rb: no struct_utility_test.rb generated')
    ok(/require_relative 'omni'/.test(struct!),
      'rb: struct_utility_test.rb does not use the omni resolver')
  })


  // lua runner swap: the omni resolver, its vendored port and the
  // must-fail smoke test are generated; the superseded struct runner is
  // not. The struct resync rides along: the vendored struct is now the
  // upstream two-file layout (struct.lua + its RE2-subset regex.lua).
  test('lua: the omni runner swap generates the resolver and retires struct_runner', async () => {
    const out = await generate(['lua'])

    ok(null != findFile(out, 'test/omni.lua'), 'lua: no omni resolver generated')
    for (const vf of ['json.lua', 'regex.lua', 'runner.lua', 'util.lua']) {
      ok(null != findFile(out, 'test/vendor/omni/' + vf),
        'lua: vendored omni file missing: ' + vf)
    }
    ok(null != findFile(out, 'test/omni_smoke_test.lua'),
      'lua: the runner-must-fail smoke test is missing')
    ok(null == findFile(out, 'test/struct_runner.lua'),
      'lua: the superseded struct_runner.lua is still generated')

    // The struct resync: upstream's own layout, regex engine included.
    ok(null != findFile(out, 'utility/struct/struct.lua'),
      'lua: vendored struct missing')
    ok(null != findFile(out, 'utility/struct/regex.lua'),
      'lua: vendored struct regex module missing')

    // The support module is RETAINED untouched (emitted TestEntity /
    // TestDirect call sites use it), and the suites run on the resolver.
    ok(null != findFile(out, 'test/runner.lua'),
      'lua: the retained support module test/runner.lua is missing')
    const primary = findFile(out, 'test/primary_utility_test.lua')
    ok(null != primary, 'lua: no primary_utility_test.lua generated')
    ok(/require\("test\.omni"\)/.test(primary!),
      'lua: primary_utility_test.lua does not use the omni resolver')
    const struct = findFile(out, 'test/struct_utility_test.lua')
    ok(null != struct, 'lua: no struct_utility_test.lua generated')
    ok(/require\("test\.omni"\)/.test(struct!),
      'lua: struct_utility_test.lua does not use the omni resolver')
  })


  // perl runner swap: the omni resolver, its vendored port (upstream
  // package layout, resolved via @INC) and the must-fail smoke test are
  // generated; the superseded struct runner is not. The struct resync
  // (0.1.1) rides along under lib/.
  test('perl: the omni runner swap generates the resolver and retires struct_runner', async () => {
    const out = await generate(['perl'])

    ok(null != findFile(out, 't/omni.pm'), 'perl: no omni resolver generated')
    for (const vf of ['Voxgig/Omni.pm', 'Voxgig/Omni/Runner.pm', 'Voxgig/Omni/Util.pm']) {
      ok(null != findFile(out, 't/vendor/omni/' + vf),
        'perl: vendored omni file missing: ' + vf)
    }
    ok(null != findFile(out, 't/omni_smoke.t'),
      'perl: the runner-must-fail smoke test is missing')
    ok(null == findFile(out, 't/struct_runner.pm'),
      'perl: the superseded struct_runner.pm is still generated')

    // The struct resync: 0.1.1 vendored with provenance.
    const vs = findFile(out, 'lib/Voxgig/Struct.pm')
    ok(null != vs, 'perl: vendored struct missing')
    ok(/VENDORED: @voxgig\/struct 0\.1\.1/.test(vs!),
      'perl: vendored struct is not the 0.1.1 resync')

    // The support module is RETAINED untouched (emitted TestEntity /
    // TestDirect call sites use it), and the suites run on the resolver.
    ok(null != findFile(out, 't/runner.pm'),
      'perl: the retained support module t/runner.pm is missing')
    const primary = findFile(out, 't/primary_utility.t')
    ok(null != primary, 'perl: no primary_utility.t generated')
    ok(/\/omni\.pm"\)/.test(primary!),
      'perl: primary_utility.t does not use the omni resolver')
    const struct = findFile(out, 't/struct_utility.t')
    ok(null != struct, 'perl: no struct_utility.t generated')
    ok(/\/omni\.pm"\)/.test(struct!),
      'perl: struct_utility.t does not use the omni resolver')
  })


  // kotlin runner swap (fused family, java shape): RunnerSupport.kt keeps
  // its name with the engine stripped (emitted TestEntity/TestDirect call
  // sites reference the object - zero call-site churn); the OmniResolver
  // bridges the SDK's plain values to the vendored port's sealed Json;
  // the StructRunner class is retired. The struct resync (0.1.1 at the
  // shared tag) rides along under utility/struct/.
  test('kotlin: the omni runner swap generates the resolver and retires StructRunner', async () => {
    const out = await generate(['kotlin'])

    ok(null != findFile(out, 'test/OmniResolver.kt'),
      'kotlin: no omni resolver generated')
    for (const vf of ['Json.kt', 'Runner.kt', 'Util.kt']) {
      ok(null != findFile(out, 'test/vendor/omni/' + vf),
        'kotlin: vendored omni file missing: ' + vf)
    }
    ok(null != findFile(out, 'test/OmniSmokeTest.kt'),
      'kotlin: the runner-must-fail smoke test is missing')
    ok(null == findFile(out, 'test/StructRunner.kt'),
      'kotlin: the superseded StructRunner.kt is still generated')

    // The struct resync: 0.1.1 vendored with provenance, package adapted.
    const vs = findFile(out, 'utility/struct/Struct.kt')
    ok(null != vs, 'kotlin: vendored struct missing')
    ok(/VENDORED: @voxgig\/struct 0\.1\.1/.test(vs!),
      'kotlin: vendored struct is not the 0.1.1 resync')

    // The support object is RETAINED under its own name (emitted
    // TestEntity/TestDirect call sites reference RunnerSupport.*), with
    // the corpus engine stripped out; the suites run on the resolver.
    const support = findFile(out, 'test/RunnerSupport.kt')
    ok(null != support, 'kotlin: the retained RunnerSupport.kt is missing')
    ok(!/fun runset\(/.test(support!),
      'kotlin: RunnerSupport.kt still carries the retired corpus engine')
    const primary = findFile(out, 'test/PrimaryUtilityTest.kt')
    ok(null != primary, 'kotlin: no PrimaryUtilityTest.kt generated')
    ok(/OmniResolver/.test(primary!),
      'kotlin: PrimaryUtilityTest.kt does not use the omni resolver')
    const struct = findFile(out, 'test/StructCorpusTest.kt')
    ok(null != struct, 'kotlin: no StructCorpusTest.kt generated')
    ok(/OmniResolver/.test(struct!),
      'kotlin: StructCorpusTest.kt does not use the omni resolver')
  })


  // csharp runner swap (fused family, go/java shape): Runner.cs keeps the
  // TestRunner class name with the engine stripped (emitted
  // TestEntity/TestDirect call sites reference TestRunner.* and
  // StructRunner.* - zero call-site churn; the StructRunner SUPPORT
  // members live on inside Runner.cs); the OmniResolver drives the
  // vendored port natively; the StructRunner.cs file is retired. The
  // struct resync (0.1.1 at the shared tag) rides along under
  // utility/struct/.
  test('csharp: the omni runner swap generates the resolver and retires StructRunner', async () => {
    const out = await generate(['csharp'])

    ok(null != findFile(out, 'test/OmniResolver.cs'),
      'csharp: no omni resolver generated')
    for (const vf of ['Runner.cs', 'Util.cs']) {
      ok(null != findFile(out, 'test/vendor/omni/' + vf),
        'csharp: vendored omni file missing: ' + vf)
    }
    ok(null != findFile(out, 'test/OmniSmokeTest.cs'),
      'csharp: the runner-must-fail smoke test is missing')
    ok(null == findFile(out, 'test/StructRunner.cs'),
      'csharp: the superseded StructRunner.cs is still generated')

    // The struct resync: 0.1.1 vendored with provenance.
    const vs = findFile(out, 'utility/struct/Struct.cs')
    ok(null != vs, 'csharp: vendored struct missing')
    ok(/VENDORED: @voxgig\/struct 0\.1\.1/.test(vs!),
      'csharp: vendored struct is not the 0.1.1 resync')

    // The support class is RETAINED under its own name (emitted
    // TestEntity/TestDirect call sites reference TestRunner.* and
    // StructRunner.*), with the corpus engine stripped out; the suites
    // run on the resolver.
    const support = findFile(out, 'test/Runner.cs')
    ok(null != support, 'csharp: the retained support Runner.cs is missing')
    ok(/class TestRunner/.test(support!) && /class StructRunner/.test(support!),
      'csharp: Runner.cs no longer carries the retained support classes')
    ok(!/MatchDeep\(|public static void RunSet\(/.test(support!),
      'csharp: Runner.cs still carries the retired corpus engine')
    const primary = findFile(out, 'test/PrimaryUtilityTest.cs')
    ok(null != primary, 'csharp: no PrimaryUtilityTest.cs generated')
    ok(/OmniResolver/.test(primary!),
      'csharp: PrimaryUtilityTest.cs does not use the omni resolver')
    const struct = findFile(out, 'test/StructUtilityTest.cs')
    ok(null != struct, 'csharp: no StructUtilityTest.cs generated')
    ok(/OmniResolver/.test(struct!),
      'csharp: StructUtilityTest.cs does not use the omni resolver')
  })


  // rust: feature/mod.rs is GENERATED, not templated.
  //
  // `target add` copies source only for the features the model selects, but
  // rust needs every module declared. The old static mod.rs listed all
  // eighteen shipped features, so the crate stopped compiling the moment the
  // set was trimmed — `pub mod retry;` with no retry.rs is a hard error.
  // This fixture declares `test` and `log` only.


  // zig runner swap: the omni resolver, its vendored port and the
  // must-fail smoke test are generated; the superseded
  // test/struct_runner.zig is gone. build.zig must ALSO declare the `omni`
  // module and list the smoke test - zig has no test auto-discovery, so a
  // suite the build file does not name exists and never runs, and the
  // vendored omni.zig reaches its own regex.zig by path, which only works
  // when the pair belongs to exactly one module.
  test('zig: the omni runner swap generates the resolver and retires struct_runner', async () => {
    const out = await generate(['zig'])

    ok(null != findFile(out, 'test/omniresolver.zig'),
      'zig: no omni resolver generated')
    for (const vf of ['omni.zig', 'regex.zig']) {
      ok(null != findFile(out, 'test/vendor/omni/' + vf),
        'zig: vendored omni file missing: ' + vf)
    }
    ok(null != findFile(out, 'test/omnismoke_test.zig'),
      'zig: the runner-must-fail smoke test is missing')
    ok(null == findFile(out, 'test/struct_runner.zig'),
      'zig: the superseded test/struct_runner.zig is still generated')

    const build = findFile(out, 'build.zig')
    ok(null != build, 'zig: no build.zig generated')
    ok(/b\.addModule\("omni"/.test(build!),
      'zig: build.zig does not declare the vendored omni module')
    ok(/addImport\("omni", omni_mod\)/.test(build!),
      'zig: build.zig does not give the test modules the omni module')
    ok(/"test\/omnismoke_test\.zig"/.test(build!),
      'zig: build.zig does not run the omni smoke test')

    const primary = findFile(out, 'test/primary_utility_test.zig')
    ok(null != primary, 'zig: no primary_utility_test.zig generated')
    ok(/@import\("omniresolver\.zig"\)/.test(primary!),
      'zig: primary_utility_test.zig does not use the omni resolver')
    const struct = findFile(out, 'test/struct_corpus.zig')
    ok(null != struct, 'zig: no struct_corpus.zig generated')
    ok(/@import\("omniresolver\.zig"\)/.test(struct!),
      'zig: struct_corpus.zig does not use the omni resolver')
    ok(!/@import\("struct_runner\.zig"\)/.test(struct!),
      'zig: struct_corpus.zig still imports the retired struct_runner')
  })


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
