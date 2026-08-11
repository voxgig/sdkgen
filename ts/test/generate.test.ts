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
import { ok, strictEqual, fail } from 'node:assert'

import Fs, { existsSync, readdirSync, writeFileSync } from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'
import { memfs } from 'memfs'
import { cmp, each, names, Project, Folder } from 'jostraca'

import {
  SdkGen, Main, Entity, Feature, Readme, Test as TestCmp, AgentGuide,
  ReadmeTop, AgentGuideTop, License, Security, Changelog, Deploy,
} from '../dist/sdkgen.js'


const KIT = 'kit'

// The staging consumer built by `npm run build` (build/scaffold-stage.js).
// `folder` — where requirePath looks for compiled components.
const STAGE = Path.resolve(__dirname, '..', 'dist-test-scaffold')

// Components copy their template tree with a CWD-RELATIVE path
// (`Copy({ from: 'tm/<lang>' })`, as a consumer runs generation from its
// `.sdk/`), so generation runs with the shipped scaffold as the working
// directory. Nothing is written there — writes go to memfs.
const SCAFFOLD = Path.resolve(__dirname, '..', 'project', '.sdk')


// Keep generator chatter out of the test output. SdkGen builds its logger with
// prettyPino, which hands back `opts.pino` when one is supplied — so a silent
// stub here replaces the whole log tree (sdkgen's own child and jostraca's).
const noop = () => { }
const makeLog = (): any => {
  const log: any = {
    info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  }
  log.child = () => log
  return log
}


// Every target shipped in the scaffold, discovered from the model directory so
// a newly added target is generated here without anyone remembering to.
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
function layeredFs(mem: any): any {
  const readThrough = (name: string) => (path: any, ...rest: any[]) => {
    const target = mem.existsSync(path) ? mem : Fs
    return (target as any)[name](path, ...rest)
  }

  return {
    ...mem,
    existsSync: (path: any) => mem.existsSync(path) || Fs.existsSync(path),
    readFileSync: readThrough('readFileSync'),
    readdirSync: readThrough('readdirSync'),
    statSync: readThrough('statSync'),
    realpathSync: readThrough('realpathSync'),
  }
}


// Placeholder mentions that are NOT defects, pinned explicitly so that a NEW
// leak still fails. Following parity.test.ts: the manifest is the stated
// policy, not a mute button.
//
//   swift — the target ships literal `Sources/ProjectNameSDK` /
//     `Tests/ProjectNameSDKTests` DIRECTORIES. Substitution rewrites file
//     CONTENT, never path segments, so Package.swift and the README have to
//     name the directories as they actually exist on disk. Cosmetically wrong
//     (the module is ProjectNameSDK rather than <Name>SDK) but internally
//     consistent, and fixing it means renaming template directories at copy
//     time — a pipeline change, not a component fix.
//
//   */src/feature/*/AGENTS.md — the feature guides tell the reader what a
//     LEAKED placeholder looks like ("shows a literal FEATURE_Name/
//     ProjectName, delete it and regenerate"). Naming it is the point.
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
const API_MODEL = `
name: 'demo'

main: kit: info: { title: 'Demo', version: '1.0.0', auth: false }
main: kit: config: headers: { 'content-type': 'application/json' }


main: kit: entity: planet: {
  alias: field: {}
  name: "planet"
  field: {
    id:     { name: "id",     kind: "field", type: "\`$STRING\`", required: true }
    title:  { name: "title",  kind: "field", type: "\`$STRING\`", required: true }
    radius: { name: "radius", kind: "field", type: "\`$NUMBER\`" }
  }
  op: {
    list: {
      name: "list"
      points: [ {
        args: {}, method: "GET", orig: "/planet", parts: ["planet"]
        transform: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
    load: {
      name: "load"
      points: [ {
        args: { params: [
          { kind: "param", name: "id", orig: "id", reqd: true, type: "\`$STRING\`", example: "p01" }
        ] }
        method: "GET", orig: "/planet/{id}", parts: ["planet", "{id}"]
        transform: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
    create: {
      name: "create"
      points: [ {
        args: {}, method: "POST", orig: "/planet", parts: ["planet"]
        transform: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
    remove: {
      name: "remove"
      points: [ {
        args: { params: [
          { kind: "param", name: "id", orig: "id", reqd: true, type: "\`$STRING\`", example: "p01" }
        ] }
        method: "DELETE", orig: "/planet/{id}", parts: ["planet", "{id}"]
        transform: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}


# Singleton: a load with no path params at all. There is nothing to pass it.
main: kit: entity: current: {
  alias: field: {}
  name: "current"
  field: {
    temperature: { name: "temperature", kind: "field", type: "\`$NUMBER\`" }
    flow:        { name: "flow",        kind: "field", type: "\`$NUMBER\`" }
  }
  op: {
    load: {
      name: "load"
      points: [ {
        args: {}, method: "GET", orig: "/current", parts: ["current"]
        transform: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}


# List-only: nothing can be fetched, created or removed by id.
main: kit: entity: history: {
  alias: field: {}
  name: "history"
  field: {
    id:   { name: "id",   kind: "field", type: "\`$STRING\`", required: true }
    year: { name: "year", kind: "field", type: "\`$INTEGER\`" }
  }
  op: {
    list: {
      name: "list"
      points: [ {
        args: {}, method: "GET", orig: "/history", parts: ["history"]
        transform: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}


main: kit: flow: BasicPlanetFlow: {
  entity: "planet", kind: "basic", name: "BasicPlanetFlow"
  step: [
    { op: "create", input: { ref: "planet_ref01", srcdatavar: "planet_ref01_data", suffix: "_dt0" } }
    { op: "load",   input: { ref: "planet_ref01", srcdatavar: "planet_ref01_data", suffix: "_dt0" } }
    { op: "list",   input: { ref: "planet_ref01", srcdatavar: "planet_ref01_data", suffix: "_dt0" } }
    { op: "remove", input: { ref: "planet_ref01", srcdatavar: "planet_ref01_data", suffix: "_dt0" } }
  ]
}

main: kit: flow: BasicCurrentFlow: {
  entity: "current", kind: "basic", name: "BasicCurrentFlow"
  step: [
    { op: "load", input: { ref: "current_ref01", srcdatavar: "current_ref01_data", suffix: "_dt0" } }
  ]
}

main: kit: flow: BasicHistoryFlow: {
  entity: "history", kind: "basic", name: "BasicHistoryFlow"
  step: [
    { op: "list", input: { ref: "history_ref01", srcdatavar: "history_ref01_data", suffix: "_dt0" } }
  ]
}
`


// Compile the fixture the way a consumer's `.sdk` compiles model/sdk.aontu:
// base models first, then the targets and features under test, then the API.
//
// Aontu resolves `@"..."` imports against a REAL path, so the assembled source
// is written into the staging model directory (gitignored, rebuilt by
// `npm run build`) next to the scaffold's own target/ and feature/ models.
function makeModel(targetNames: string[]): any {
  const src = [
    '@"@voxgig/apidef/model/apidef.aontu"',
    '@"../../../model/sdkgen.aontu"',
    ...targetNames.map((t) => `@"target/${t}.aontu"`),
    '@"feature/test.aontu"',
    '@"feature/log.aontu"',
    API_MODEL,
  ].join('\n')

  const path = Path.join(STAGE, '.sdk', 'model', 'generate-test.aontu')
  writeFileSync(path, src)

  const errs: any[] = []
  const model = new Aontu().generate(src, { path, errs })

  strictEqual(errs.length, 0,
    'fixture model did not compile: ' +
    errs.map((e: any) => `[${e.why}] ${e.msg}`).join(' | '))

  return model
}


// A miniature of the Root component create-sdkgen scaffolds into a consumer
// (project/standard/.sdk/src/Root.ts): per target, a folder holding the entity,
// feature, main, readme, agentguide and test phases. Kept minimal on purpose —
// the point is to drive the per-language components, not to re-test Root.
function makeRoot(): any {
  return cmp(function Root(props: any) {
    const { model, ctx$ } = props

    model.const = { name: model.name }
    names(model.const, model.name)
    model.const.year = 2026
    names(model, model.name)

    ctx$.model = model
    ctx$.stdrep = {}
    names(ctx$.stdrep, model.Name, 'ProjectName')

    const target = model.main[KIT].target || {}
    const feature = model.main[KIT].feature || {}
    const entity = model.main[KIT].entity || {}

    Project({}, () => {

      // The repo-root phase, which the real Root reaches through Top(). It is
      // not optional coverage: ReadmeTop is the ONLY route to the
      // ReadmeTopQuick_<lang> components, where the elixir defect lived.
      ReadmeTop({})
      AgentGuideTop({})
      License({})
      Security({})
      Changelog({})
      Deploy({})

      each(target, (target: any) => {
        names(target, target.name)

        Folder({ name: target.name }, () => {
          const phase = target.phase || {}
          const on = (name: string) => false !== (phase[name] && phase[name].active)

          if (on('entity')) {
            each(entity, (entity: any) => {
              names(entity, entity.name)
              Entity({ target, entity })
            })
          }

          if (on('feature')) {
            each(feature)
              .filter((f: any) => f.active)
              .map((f: any) => {
                names(f, f.name)
                Feature({ target, feature: f })
              })
          }

          Main({ target })

          if (on('readme')) Readme({ target })
          if (on('agentguide')) AgentGuide({ target })
          if (on('test')) TestCmp({ target })
        })
      })
    })
  })
}


// Generate `targetNames` into a fresh memfs volume and return the file map.
async function generate(targetNames: string[]): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})

  const sdkgen = SdkGen({
    fs: layeredFs(fs),
    folder: STAGE,
    root: '',
    pino: makeLog(),
  })

  // generate() either completes or throws — it has no failure return. Let the
  // throw reach the caller, which names the target it came from.
  const res = await sdkgen.generate({
    model: makeModel(targetNames),
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

})
