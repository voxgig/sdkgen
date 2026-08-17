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


// Targets that consume ANOTHER target's output rather than generating an SDK
// of their own: go-cli/go-mcp wrap `go`, py-data wraps `py`, and
// seneca-provider wraps `ts`. They switch the standard phases off and are
// driven by the wrapped target's model, so generating them standalone proves
// nothing — and each fails outright without its sibling, deliberately.
// Mirrors parity.test.ts.
//
// The sibling each one needs is declared HERE rather than left implicit,
// because "excluded from the loop" was silently reading as "excluded from the
// suite": the placeholder scan is this file's only content guard, and none of
// these four had ever been through it. See 'a consumer target generates
// against its sibling', which does exactly that.
const NON_SDK_SIBLING: Record<string, string> = {
  'go-cli': 'go',
  'go-mcp': 'go',
  'py-data': 'py',
  'seneca-provider': 'ts',
}

const NON_SDK_TARGETS = Object.keys(NON_SDK_SIBLING)


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


  // AN INACTIVE ENTITY MUST REACH NOTHING — SOURCE OR TESTS.
  //
  // `active: false` is how a consumer scopes a large spec down to the entities
  // it actually wants (a 70-entity Trello spec down to one). Every Main_<lang>
  // read the model through getModelPath, which filters on active by default,
  // but sixteen Test_<lang> components read `model.main[KIT].entity` — the raw,
  // unfiltered map — so the SDK correctly omitted the entity while a full test
  // suite for it was still generated, against a client class that does not
  // exist. Reported by @Rarfael (#40), found converting seneca-trello-provider.
  //
  // The assertion is DIFFERENTIAL rather than a path-shape guess: generate the
  // fixture twice and require that every path naming the entity disappears.
  // That way it does not encode any language's file-naming convention, and a
  // target that stops emitting per-entity files cannot silently pass.
  test('an inactive entity reaches no target, in source or in tests', async () => {
    const targets = allTargets().filter((t) => !NON_SDK_TARGETS.includes(t))

    const withEntity = await generate(targets)
    const without = await generate(targets,
      undefined, 'main: kit: entity: history: active: false')

    const named = (out: Record<string, string>) =>
      Object.keys(out).filter((p) => /history/i.test(p)).sort()

    // Guards the fixture itself: if `history` stopped producing files, the
    // absence below would prove nothing.
    ok(10 < named(withEntity).length,
      'fixture emits too few history files to be a meaningful check: ' +
      named(withEntity).length)

    deepStrictEqual(named(without), [],
      'an entity marked `active: false` still generated files')

    // Nothing ELSE moved: deactivating an entity removes its files and does
    // not perturb the rest of the tree.
    const before = new Set(Object.keys(withEntity))
    const added = Object.keys(without).filter((p) => !before.has(p))
    deepStrictEqual(added, [], 'deactivating an entity added unrelated files')
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


  test('the same ts model pinned to literal emits a literal', async () => {
    const out = await generate(['ts'], undefined, "main: kit: config: repr: 'literal'")
    const src = tsConfigSrc(filesFor(out, 'ts'))
    ok(/^\s*entity = \{/m.test(src), 'literal branch not emitted')
    ok(!/const CONFIG_DATA = /.test(src), 'literal path emitted data as well')
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
    ['py', /config\.py$/, /_CONFIG_DATA = "/, /^\s+return \{$/m],
    ['rb', /config\.rb$/, /CONFIG_DATA = '/, /"main" => \{/],
    ['php', /config\.php$/, /const CONFIG_DATA = '/, /"main" => \[/],
    ['lua', /config\.lua$/, /local CONFIG_DATA = \[=*\[/, /^\s*main = \{$/m],
    ['c', /core\/config\.c$/, /static const char CONFIG_DATA\[\] =/, /return cmap\(/],
    ['rust', /core\/config\.rs$/, /const CONFIG_DATA: &str = r/, /Value::map_of\(\[/],
    ['zig', /core\/config\.zig$/, /const CONFIG_DATA: \[\]const u8 =/, /return h\.jo\(&\./],
    ['dart', /lib\/Config\.dart$/, /const String _CONFIG_DATA = "/, /^\s*final Map<String, dynamic> main = <String, dynamic>\{/m],
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
      ok(plain.includes('"main":{"name":"Demo"}'),
        target + ': embedded config is missing the main block')
      for (const entity of ['planet', 'ambient', 'history', 'console']) {
        ok(plain.includes('"' + entity + '"'),
          target + ': embedded config is missing entity ' + entity)
      }
    })


    test(target + ': the same model pinned to literal emits a literal', async () => {
      const out = await generate([target], undefined, "main: kit: config: repr: 'literal'")
      const config = filesFor(out, target).find(([n]) => file.test(n))
      ok(config, target + ': no config file matching ' + file)
      const src = String(config![1])
      ok(litMark.test(src), target + ': literal branch not emitted')
      ok(!dataMark.test(src), target + ': literal path emitted data as well')
    })
  }


  // Both dart branches must carry `options.server` — the OpenAPI
  // server-variable defaults — for a spec with a templated server URL.
  //
  // The literal branch assembled `options` slot by slot and simply had no slot
  // for `server`, so it was absent there and present in the data, and the same
  // API described a different config either side of the threshold. It is now
  // rendered whole from the canonical definition. The fixture has no server
  // variables, which is why this test supplies its own.
  test('dart: both representations carry the server-variable defaults', async () => {
    const servers = "main: kit: info: servers: [ { url: 'https://{tenant}.example.com'," +
      ' variables: { tenant: { default: %27acme%27 } } } ]'.replace(/%27/g, "'")

    for (const repr of ['literal', 'data']) {
      const out = await generate(['dart'], undefined,
        `main: kit: config: repr: '${repr}'\n${servers}`)
      const config = filesFor(out, 'dart').find(([n]) => /lib\/Config\.dart$/.test(n))
      ok(config, repr + ': no dart Config.dart generated')
      const plain = String(config![1]).replace(/\\"/g, '"')

      ok(/server/.test(plain), repr + ': dart config lost options.server')
      ok(/acme/.test(plain), repr + ': dart config lost the server-variable default')
    }
  })


  // The dart DATA branch must give every constructed Config its own maps.
  //
  // The literal builds fresh maps in each field initialiser, so `Config()` is
  // independent per instance — and `Config` is exported by Main.fragment.dart,
  // so callers can construct one. A first version of the data branch bound the
  // fields to a single top-level parsed map, which made
  // `Config().options['x'] = 1` mutate the `config` singleton every SDK client
  // reads. Verified by running it:
  //
  //   literal: b sees probe = false      data: b sees probe = true
  //
  // This is the structural guard for that: the decode must happen in the
  // CONSTRUCTOR, not in a top-level final the fields alias.
  test('dart: the data branch decodes per Config instance', async () => {
    const out = await generate(['dart'], undefined, "main: kit: config: repr: 'data'")
    const config = filesFor(out, 'dart').find(([n]) => /lib\/Config\.dart$/.test(n))
    ok(config, 'no dart Config.dart generated')
    const src = String(config![1])

    ok(/Config\(\) : this\._\(jsonDecode\(_CONFIG_DATA\)/.test(src),
      'dart data config does not decode in the constructor, so every ' +
      'constructed Config would share one parsed map with the singleton')
    ok(!/^final Map<String, dynamic> _CONFIG =/m.test(src),
      'dart data config still binds its fields to a shared top-level map')
  })


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


  // The CONSUMER targets, each generated against the target it wraps.
  //
  // They are out of the two loops above for a good reason — standalone they
  // throw, by design — but that also took them out of the placeholder scan,
  // which is the only guard in this suite that reads the generated TEXT. So
  // the ~1650 lines of Main_seneca-provider + Extras_seneca-provider, and the
  // go-cli / go-mcp / py-data emitters, had no content check at all: a Copy or
  // Fragment added there without `...ctx$.stdrep` would ship a package naming
  // itself "ProjectName" at runtime and every suite would stay green.
  // external.test.ts generates seneca-provider but asserts only on file
  // PLACEMENT.
  //
  // seneca-provider generates IN-TREE here (under `seneca-provider/`): its
  // out-of-tree `output: path` mode is external.test.ts's subject, and the
  // text it emits is the same either way.
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
    for (const ent of ['history', 'ambient']) {
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
      'csharp', 'dart', 'elixir', 'java', 'js', 'kotlin', 'lean',
      'lua', 'ocaml', 'py', 'rb', 'rust', 'ts', 'zig',
    ]
    const declared = TARGETS
      .map((t) => `main: kit: target: ${t}: publish: version: '4.5.6'`)
      .join('\n')

    const out = await generate(TARGETS, undefined, declared)

    // The manifest each ecosystem actually publishes from.
    const MANIFEST: Record<string, string> = {
      csharp: 'DemoSDK.csproj', dart: 'pubspec.yaml', elixir: 'mix.exs',
      java: 'pom.xml', js: 'package.json',
      kotlin: 'build.gradle.kts', lean: 'lakefile.toml', lua: 'demo.rockspec',
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


  // The provider gets one too — and from a COMPONENT.
  //
  // It used to come from `tm/seneca-provider/.gitignore`, which meant it
  // reached only people working from a checkout: npm never publishes a file
  // by that name, whatever package.json `files` says, so every consumer who
  // installed sdkgen from the registry generated a provider repo with no
  // ignore file at all. packaging.test.ts guards the tarball; this guards the
  // OUTPUT, because the two failed independently — the template was present
  // in this repo the whole time, so nothing here noticed.
  //
  // `.jostraca/` is the line that matters most: jostraca drops its meta log
  // and a full duplicate of the last generated output into the provider repo
  // on every run, so without it the first regeneration leaves hundreds of
  // untracked files behind.
  test('the seneca-provider gitignore is generated, not copied', async () => {
    const out = await generate(['ts', 'seneca-provider'])

    const ignore = findFile(out, 'seneca-provider/.gitignore')
    ok(null != ignore, 'seneca-provider: no .gitignore generated')

    const lines = ignore!.split('\n').map((l: string) => l.trim())
      .filter((l: string) => '' !== l && !l.startsWith('#'))

    for (const needed of ['node_modules/', '.jostraca/', '*.tsbuildinfo']) {
      ok(lines.includes(needed),
        'seneca-provider/.gitignore stopped ignoring ' + needed)
    }
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
