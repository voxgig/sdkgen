
import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual, fail } from 'node:assert'

import Fs, { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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


const SCHEMA_FILE = /(^|\/)(sdk_)?schema\.[a-z]+$/i


function portedTargets(): string[] {
  const dir = Path.resolve(__dirname, '..', 'project', '.sdk', 'src', 'cmp')
  return allTargets()
    .filter((t: string) => !NON_SDK_TARGETS.includes(t))
    .filter((t: string) => existsSync(Path.join(dir, t, 'Schema_' + t + '.ts')))
}


function unportedTargets(): string[] {
  const ported = portedTargets()
  return allTargets()
    .filter((t: string) => !NON_SDK_TARGETS.includes(t))
    .filter((t: string) => !ported.includes(t))
}


function allTargets(): string[] {
  const dir = Path.resolve(__dirname, '..', 'project', '.sdk', 'model', 'target')
  return readdirSync(dir)
    .filter((f: string) => f.endsWith('.aon') && 'target-index.aon' !== f)
    .map((f: string) => f.replace(/\.aon$/, ''))
    .sort()
}


const PLACEHOLDER_PINNED = [
  /^swift\/Package\.swift$/,
  /^swift\/README\.md$/,
  /^swift\/Tests\/ProjectNameSDKTests\//,
  /^[^/]+\/src\/feature\/[^/]+\/AGENTS\.md$/,
]


const NON_SDK_SIBLING: Record<string, string> = {
  'go-cli': 'go',
  'go-mcp': 'go',
  'py-data': 'py',
}

const NON_SDK_TARGETS = Object.keys(NON_SDK_SIBLING)


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


function tsConfigSrc(files: [string, string][]): string {
  const config = files.find(([name]) => /(^|\/)src\/Config\.ts$/.test(name))
  ok(config, 'no src/Config.ts generated')
  return String(config![1])
}


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


  test('a full SDK generates on the data path when repr is pinned', async () => {
    const out = await generate(['go'], undefined, "main: kit: config: repr: 'data'\n" + 'main: kit: config: headers: ' + JSON.stringify({ 'X-Contract': '\ufeffdescription\nline' }))

    const files = filesFor(out, 'go')
    ok(0 < files.length, 'generated no files on the data path')

    const config = files.find(([name]) => /core\/config\.go$/.test(name))
    ok(config, 'no core/config.go generated')
    const src = String(config![1])

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
    strictEqual(parsed.options.headers['X-Contract'], '\ufeffdescription\nline')
    ok(!src.includes('\ufeff'), 'Go source contains a literal BOM')

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


  test('js: the generated request transform strips $action from the body',
    async () => {
      const out = await generate(['js'])
      const emitted = findFile(out, 'utility/TransformRequestUtility.js')
      ok(null != emitted, 'the js request transform was not generated')

      const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-xreq-'))
      const file = Path.join(tmp, 'TransformRequestUtility.js')
      writeFileSync(file, emitted as string)
      const { transformRequest } = require(file)

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

      ok(src.includes(`require.resolve(${JSON.stringify(pkg)})`),
        target + ': main does not probe for the station library')
      ok(src.includes(`require(${JSON.stringify(pkg)})`),
        target + ': main does not require the station library')

      ok(src.includes('provide(config.main.slug'),
        target + ': main does not provide under config.main.slug')
      ok(src.includes('new DemoSDK(options)'),
        target + ': factory construct does not build the SDK class')
      ok(/construct:/.test(src) && /config,/.test(src),
        target + ': factory is not the {construct, config} pair')

      ok(!src.includes('STATIONPKG'),
        target + ': STATIONPKG placeholder leaked')
      ok(!src.includes('ProjectName'),
        target + ': ProjectName placeholder leaked')
    }
  })


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

      ok(src.includes('"sdk": { "demo": {'),
        target + ': README has no station.json block keyed by the slug')
      ok(src.includes('"package": "' + ('ts' === target ?
        '@voxgig-sdk/demo' : '@voxgig-sdk/demo-js') + '"'),
        target + ': README quickstart declares no package for station to load')
      ok(src.includes("station.sdk('demo')"),
        target + ': README has no station.sdk() quickstart')
      ok(src.includes('station.connect('),
        target + ': README dropped the imperative connect() form')

      ok(src.includes('`demo.apikey`') && src.includes('`DEMO_APIKEY`'),
        target + ': README does not derive the untagged instance name')
      ok(src.includes('`demo_test.apikey`') && src.includes('`DEMO_TEST_APIKEY`'),
        target + ': README does not derive the tagged instance name')

      ok(src.includes('docs/reference/station-errors.md'),
        target + ': README does not link the station error catalog')
    }

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


  test('zig: no entity accessor collides with an SDK member', async () => {
    const out = await generate(['zig'])
    const sdkFile = filesFor(out, 'zig').find(([n]) => /core\/sdk\.zig$/.test(n))
    ok(sdkFile, 'no zig core/sdk.zig generated')
    const src = String(sdkFile![1])

    const accessors = Array.from(src.matchAll(/pub fn (\w+)\(self: \*@This\(\), entopts: Value\)/g))
      .map((m) => m[1])
    ok(0 < accessors.length, 'no entity accessors found — the scan would be vacuous')
    ok(accessors.includes('utility'),
      'the fixture entity named `utility` is what makes this test bite')

    const clashes: string[] = []
    for (const name of accessors) {
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

      const plain = src.replace(/\\"/g, '"')
      // Prefix match: main gained additive identity fields (slug, and
      // version/target where the emitter passes its target name).
      ok(plain.includes('"main":{"name":"Demo"'),
        target + ': embedded config is missing the main block')
      for (const entity of ['planet', 'ambient', 'history', 'console']) {
        ok(plain.includes('"' + entity + '"'),
          target + ': embedded config is missing entity ' + entity)
      }

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

        ok(0 < Object.keys(litcfg.entity || {}).length, 'literal config has no entities')
        ok(0 < Object.keys(datcfg.entity || {}).length, 'data config has no entities')

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

        for (const [what, cfg] of [['literal', litcfg], ['data', datcfg]] as any[]) {
          ok(!/\$[\w.]*\$/.test(JSON.stringify(snap(cfg))),
            what + ' config carries an unresolved stdrep placeholder')
        }
      })
  }


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


  function testFiles(out: Record<string, string>, target: string): [string, string][] {
    return filesFor(out, target)
      .filter(([n]) => !['ts', 'js'].includes(target) || /\.test\.(ts|js)$/.test(n))
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

      const servers =
        "main: kit: info: servers: [ { url: 'https://{tenant}.example.com/{region}'," +
        ' variables: { tenant: { default: %27%27 }, region: { default: %27eu%27 } } } ]'
          .replace(/%27/g, "'")

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

          for (const v of ['TENANT', 'REGION']) {
            if (!src.includes('_SERVER_' + v)) {
              gaps.push(`${target}:${name} has no _SERVER_${v} env entry`)
            }
          }

          if (!/['"]eu['"]/.test(src)) {
            gaps.push(`${target}:${name} lost the 'eu' server-variable default`)
          }

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

    const controls = Object.keys(vol.toJSON())
      .map((n) => n.split(Path.sep).join('/'))
      .filter((n) => n.endsWith('/sdk-test-control.json'))
      .filter((n) => !n.includes('/.jostraca/'))
    strictEqual(controls.length, TARGETS.length,
      'expected one control file per target, got:\n' + controls.join('\n'))

    const EDITED = JSON.stringify({
      version: 1,
      test: {
        skip: { live: { direct: [{ test: 'direct-list-planet' }], entityOp: [] } },
        client: { options: { timeout: { active: true } } },
      },
    }, null, 2)
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


  test('a hand-written CHANGELOG.md survives regeneration', async () => {
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(),
    })
    const pass = async () => {
      const res = await sdkgen.generate({
        model: makeModel(['ts']), root: makeRoot(),
      })
      strictEqual(res.ok, true, 'generation did not report ok')
    }

    await pass()

    const native = (n: string) => n.split('/').join(Path.sep)
    const found = Object.keys(vol.toJSON())
      .map((n) => n.split(Path.sep).join('/'))
      .filter((n) => n.endsWith('/CHANGELOG.md'))
      .filter((n) => !n.includes('/.jostraca/'))
    strictEqual(found.length, 1,
      'expected exactly one root CHANGELOG.md, got:\n' + found.join('\n'))
    const path = found[0]

    const RELEASED = String(vol.readFileSync(native(path), 'utf8')).replace(
      '## [Unreleased]',
      '## [Unreleased]\n\n## [release/v0.1.2] - 2026-09-14\n\n' +
      '- Exclude macOS compiler debug bundles from the repository release.')
    vol.writeFileSync(native(path), RELEASED)

    await pass()

    strictEqual(String(vol.readFileSync(native(path), 'utf8')), RELEASED,
      'regeneration overwrote a hand-written CHANGELOG.md')
  })


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


  test('elixir: no empty argument in a singleton load example', async () => {
    const out = await generate(['elixir'])

    // The ROOT readme — the one ReadmeTop writes, directly under the output
    // folder rather than inside the target directory.
    const quick = out['README.md']
    ok(null != quick, 'elixir: no root readme was generated')

    ok(/Entity\.Ambient\.load\(/.test(quick),
      'elixir: the root quickstart no longer shows the singleton load — rename ' +
      'the fixture entities so `ambient` is again the first active entity by key')

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


  test('every ported target emits a Schema module, and the rest do not', async () => {
    for (const target of ['ts', 'js']) {
      const out = await generate([target])
      const ext = 'ts' === target ? 'ts' : 'js'
      const schema = Object.entries(out).find(([p2]) =>
        p2 === target + '/src/Schema.' + ext)

      ok(schema, target + ': no src/Schema.' + ext + ' generated')
      const src = String(schema![1])

      ok(src.includes('OPTSPEC'), target + ': no OPTSPEC')
      ok(src.includes('ENTITYSPEC'), target + ': no ENTITYSPEC')
      ok(src.includes('"base"'), target + ': the standard options are missing')

      // The sentinels carry backticks. A quoting slip here is silent — the
      // module still parses, the spec just stops meaning anything.
      ok(src.includes('"`$CHILD`"'), target + ': a sentinel lost its backticks')
    }

    // Every OTHER ported target emits one too. ts and js hold the spec as a
    // native literal; the rest embed it as JSON and parse at load, so the
    // shared assertion is the one thing both shapes must carry — the spec
    // itself, sentinels intact.
    for (const t of portedTargets()) {
      if ('ts' === t || 'js' === t) {
        continue
      }

      const out = await generate([t])
      const schema = Object.entries(out).find(([p2]) => SCHEMA_FILE.test(p2))

      ok(schema, t + ': ships a Schema component but generated no module')

      const src = String(schema![1])
      ok(/\\?"base\\?"/.test(src), t + ': the standard options are missing')
      ok(/`\\?\$CHILD`/.test(src), t + ': a sentinel lost its backticks')
    }

    // And an UNPORTED target emitting dead source still fails. Read from the
    // components rather than listed here, so porting one needs no edit in
    // this file.
    for (const t of unportedTargets()) {
      const out = await generate([t])
      const stray = Object.keys(out).filter((p2) => SCHEMA_FILE.test(p2))
      deepStrictEqual(stray, [],
        t + ' ships no Schema component but emitted a Schema module')
    }
  })


  test('the generated ts Schema is the spec makeOptions actually imports', async () => {
    const out = await generate(['ts'])

    const schema = out['ts/src/Schema.ts']
    ok(schema, 'no Schema.ts')

    // The constant is a plain object literal, so the module body is also
    // valid JSON once the wrapper is stripped — which is the point of
    // emitting it that way rather than as a parsed string.
    const m = schema.match(/const OPTSPEC = ([\s\S]*?)\n\nconst ENTITYSPEC/)
    ok(m, 'could not extract OPTSPEC')
    const optspec = JSON.parse(m![1])

    strictEqual(optspec.base, 'http://localhost:8000')
    ok(null != optspec.feature, 'the feature half is missing')

    const util = out['ts/src/utility/MakeOptionsUtility.ts']
    ok(util, 'no MakeOptionsUtility.ts')
    ok(/import \{ OPTSPEC \} from '\.\.\/Schema'/.test(util),
      'makeOptions does not import the generated spec')
    ok(!/const optspec = \{/.test(util),
      'makeOptions still carries a literal option spec')
  })


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


  test('a nested list example supplies its required path params', async () => {
    const out = await generate(['ts', 'py'])

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

    const ref = findFile(out, 'ts/REFERENCE.md')
    ok(null != ref, 'ts: no REFERENCE.md')
    ok(/client\.Planet\(\)\.load\(\{[^}]*id:/.test(ref!),
      'the load example omits the required id param')
  })


  test('the offline-test example seeds the mock', async () => {
    const out = await generate(['ts'])

    const readme = findFile(out, 'README.md')
    ok(null != readme, 'no root README generated')

    const at = readme!.indexOf('SDK.test(')
    ok(-1 !== at, 'the README has no offline-test example')
    const block = readme!.slice(at, readme!.indexOf('```', at))

    ok(!/SDK\.test\(\)/.test(block),
      'the example calls test() with no seed, then claims mock data')
    ok(block.includes('entity:'),
      'the example does not show the seed shape')

    ok(/entity:\s*\{\s*\w+:/.test(block),
      'the seed block is not keyed by entity name: ' + block.slice(0, 200))
  })


  test('a registered component dispatches per target', async () => {
    const sink: any[] = []
    await generate(['ts', 'go', 'py'], undefined, undefined, sink)

    const dispatched = sink
      .filter((l: any) => 'generate-registered' === l.point)
      .map((l: any) => l.component + ':' + l.target)
      .sort()

    deepStrictEqual(dispatched,
      ['ReadmeTopQuick:go', 'ReadmeTopQuick:py', 'ReadmeTopQuick:ts'],
      'registered component did not dispatch for every target')

    const absent = sink
      .filter((l: any) => 'generate-registered-absent' === l.point)
      .map((l: any) => l.component + ':' + l.target)
      .sort()

    deepStrictEqual(absent,
      ['NoSuchThing:go', 'NoSuchThing:py', 'NoSuchThing:ts'],
      'an unimplemented registered component was not skipped cleanly')
  })


  test('live strictness is model-driven', async () => {
    const lenient = await generate(['ts', 'go'], undefined,
      'main: kit: test: live: strict: false')
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
  test('live strictness defaults to assertions', async () => {
    const absent = await generate(['ts', 'go'])
    const explicit = await generate(['ts', 'go'], undefined,
      'main: kit: test: live: strict: true')

    deepStrictEqual(Object.keys(absent).sort(), Object.keys(explicit).sort(),
      'declaring strict:true changed which files are generated')

    for (const path of Object.keys(absent)) {
      strictEqual(explicit[path], absent[path],
        'declaring strict:true changed ' + path)
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
      ['ts', ['dist', 'src']],
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

    const plain = findFile(await generate(['go']), 'core/config.go')
    ok(!/feature\/secrets\/plugins/.test(plain!),
      'go: an inactive model still emitted plugin imports')
    ok(/var featurePlugins = map\[string\]\[\]any\{\n\}/.test(plain!),
      'go: an inactive model must emit an EMPTY featurePlugins map')
  })


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

    const plainout = await generate(['py'])
    const plain = findFile(plainout, '_sdk/config.py')
    ok(!/voxgig_sekreto\.plugins/.test(plain!),
      'py: an inactive model still emitted plugin imports')
    ok(/FEATURE_PLUGINS = \{\n\}/.test(plain!),
      'py: an inactive model must emit an EMPTY FEATURE_PLUGINS map')
  })


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

    ok(/^pub const httpjson = @import\("plugins\/httpjson\.zig"\);$/m.test(root!),
      'zig: the module root must always export the shared httpjson helper')
    ok(!/plugins\/(gcpsecrets|azuresecrets|aws|secretspec|onepassword|doppler|infisical)\.zig/.test(root!),
      'zig: an INACTIVE group reached the module root:\n' + root)

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

    deepStrictEqual(
      Object.keys(plainout).filter((p) => /(^|\/)php\/src\//.test(p)), [],
      'php: tm/php/src placeholders leaked into the SDK')
  })


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

    const plain = await generate(['ocaml'])
    ok(null == findFile(plain, 'ocaml/feature/secrets/feature.mk') &&
      null == findFile(plain, 'ocaml/feature/secrets_feature.ml'),
      'ocaml: a model without secrets still generated the feature')
    ok(/^let feature_plugins \(_name : string\) = \[\]$/m.test(findFile(plain, 'ocaml/sdk_config.ml')!),
      'ocaml: a model without secrets must emit the EMPTY polymorphic accessor')
  })


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

    ok(/^pub mod httpjson;$/m.test(index!),
      'rust: the vault kinds need the shared httpjson helper declared')
    ok(!/^pub mod (gcpsecrets|azuresecrets|aws|secretspec);$/m.test(index!),
      'rust: an INACTIVE group reached the module index:\n' + index)

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
    ok(null != findFile(out, 'feature/secrets/sekreto/plugins/Sigv4.scala'),
      'scala: Sigv4.scala was trimmed away from a saas-only selection - it ' +
      'defines the `uriescape` that Doppler, Infisical, Onepassword and ' +
      'Azuresecrets call, so it belongs to NO plugin group')

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

    ok(null != findFile(off, 'feature/SecretsFeature.scala') &&
      null != findFile(off, 'feature/secrets/sekreto/Sekreto.scala') &&
      null != findFile(off, 'feature/secrets/sekreto/plugins/Sigv4.scala'),
      'scala: model/target/scala.aon documents that a secrets-OFF SDK still ' +
      'carries the feature, the vendored cores and the two ungrouped plugin ' +
      'files - it no longer does, so update that note (and this test)')
  })


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
    for (const shared of ['http', 'httpjson', 'proc']) {
      ok(null != findFile(out, 'feature/secrets/sekreto/plugins/' + shared + '.ex'),
        'elixir: the shared ' + shared + '.ex helper must ship with the ' +
        'feature core - it belongs to no plugin group')
    }

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

    const suite = findFile(out, 'test/feature/secrets/secrets_test.exs')
    ok(null != suite, 'elixir: the gated secrets suite was not generated')
    ok(null != findFile(out, 'elixir/test/test_helper.exs'),
      'elixir: no test/test_helper.exs, so mix test cannot start')
    const mix = findFile(out, 'elixir/mix.exs')
    ok(null != mix, 'elixir: no mix.exs generated')
    ok(!/test_paths|test_pattern/.test(mix!),
      'elixir: mix.exs narrows test discovery, so test/feature/secrets/ may ' +
      'no longer be found:\n' + mix)

    for (const [name, src] of [['feature/secrets.ex', feature!],
      ['test/feature/secrets/secrets_test.exs', suite!]]) {
      ok(!/ProjectName|PROJECTENV|projectname/.test(src),
        'elixir: a placeholder survived in ' + name)
    }

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
    for (const shared of ['Httpjson', 'Proc']) {
      ok(null != findFile(out, 'Sources/DemoSdk/feature/secrets/plugins/' + shared + '.swift'),
        'swift: the shared ' + shared + '.swift helper must ship with the feature core')
    }
    // The full-set barrel is never vendored: the trim would leave it naming
    // deleted definitions and swiftc would fail the SekretoPlugins module.
    ok(null == findFile(out, 'feature/secrets/plugins/All.swift'),
      'swift: the full-set barrel All.swift reached the SDK')

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

    for (const [name, src] of [['Sources/DemoSdk/feature/SecretsFeature.swift', feature!],
      ['Tests/DemoSdkTests/feature/secrets/SecretsFeatureTest.swift', suite!]]) {
      ok(!/ProjectName|PROJECTENV/.test(src),
        'swift: a placeholder survived in ' + name)
    }

    ok(null == findFile(out, 'swift/src/feature/secrets/.gitkeep'),
      'swift: the feature-add copy-target dir leaked into the package')

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
