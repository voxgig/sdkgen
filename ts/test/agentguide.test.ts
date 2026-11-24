
import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { Jostraca, Project, Folder } from 'jostraca'
import { memfs } from 'memfs'

import { AgentGuideTop, AgentGuide, AgentGuideFeature, applyFacts, SdkGen } from '../dist/sdkgen.js'
import { STAGE, SCAFFOLD, makeModel as compileModel, makeRoot, layeredFs, makeLog } from './generateharness'


const noop = () => {}
const log: any = {
  info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  child() { return log },
}

const T_TS = { name: 'ts', title: 'TypeScript', ext: 'ts' }
const T_GO = { name: 'go', title: 'Go', ext: 'go', srcfeature: false }
const T_GOCLI = { name: 'go-cli', title: 'Go CLI', ext: 'go', phase: { feature: { active: false } } }

function makeModel(over: { ts?: boolean, copies?: string } = {}) {
  return applyFacts({
    name: 'demo', Name: 'Demo', const: { Name: 'Demo' },
    main: { kit: {
      ...(null == over.copies ? {} : { copies: over.copies }),
      target: {
        ts: { active: false !== over.ts, ...T_TS },
        go: { active: true, ...T_GO },
        old: { active: false, name: 'old', title: 'Old' },
        'go-cli': { active: false, ...T_GOCLI },
      },
      feature: {
        log: {
          active: true, name: 'log', Name: 'Log', title: 'Structured logging',
          version: '0.0.1', config: { options: { active: true } },
          hook: { PreRequest: { active: true }, PreResponse: { active: true }, SetData: { active: false } },
        },
        test: {
          active: true, name: 'test', Name: 'Test', title: 'Test mode',
          version: '0.0.1', config: { options: { active: false } },
          hook: { PreRequest: { active: true } },
        },
      },
      entity: {
        advice: {
          active: true, name: 'advice', Name: 'Advice',
          op: { load: { active: true }, list: { active: true } },
        },
      },
    } },
  })
}


// Render a component (optionally inside an ambient target folder) and return
// the memfs file map (path -> content). A target is named, and read from the
// model, which is where its facts are. `seed` puts files in the tree, such as
// a target's templates, relative to the working directory.
async function render(
  comp: any, props: any, folder?: string,
  opts: { seed?: string[], model?: any } = {},
): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  for (const file of opts.seed || []) {
    fs.mkdirSync(Path.dirname(Path.resolve(file)), { recursive: true })
    fs.writeFileSync(Path.resolve(file), '')
  }
  const jostraca = Jostraca()
  const model = opts.model || makeModel()
  if ('string' === typeof props.target) {
    props = { ...props, target: model.main.kit.target[props.target] }
  }
  await jostraca.generate(
    { fs: () => fs, folder: '/x', model, log },
    () => {
      Project({ folder: 'p' }, () => {
        if (folder) {
          Folder({ name: folder }, () => comp(props))
        }
        else {
          comp(props)
        }
      })
    },
  )
  return vol.toJSON() as Record<string, string>
}

function find(files: Record<string, string>, suffix: string): string | undefined {
  const key = Object.keys(files).find((k) => k.endsWith(suffix))
  return key ? files[key] : undefined
}


// Keys become STAGE-relative with forward slashes: on Windows a memfs key does
// not match the absolute path Path.join builds for it.
function staged(vol: any): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(vol.toJSON() as Record<string, string>)) {
    out[Path.relative(STAGE, path).split(Path.sep).join('/')] = content
  }
  return out
}


describe('AgentGuideTop', () => {
  test('emits a top-level AGENTS.md with the four topics and real lists', async () => {
    const files = await render(AgentGuideTop, {})

    const agents = find(files, '/p/AGENTS.md')
    ok(agents, 'root AGENTS.md exists')
    ok(agents!.includes('# Demo SDK — Agent Guide'), 'title')
    ok(agents!.includes('## Generating and updating the SDK'), 'workflow topic')
    ok(agents!.includes('## Adding a feature'), 'feature topic')
    ok(agents!.includes('## Customising: model, templates, components'), 'customise topic')
    ok(agents!.includes('## The model language (aontu'), 'aontu topic')
    // The interpolation-syntax token must survive jostraca's own $$..$$
    // templating (a resolvable token like $$name$$ would get clobbered).
    ok(agents!.includes('$$path$$'), 'aontu interpolation token survives templating')
    ok(!agents!.includes("'Demo'"), 'no accidental name substitution in the primer')
    // Model files are .aontu, not .jsonic.
    ok(agents!.includes('feature-index.aontu'), 'uses .aontu model extension')
    ok(!agents!.includes('.jsonic'), 'no stale .jsonic references')
    // Real, active targets/features (inactive `old` excluded).
    ok(agents!.includes('`ts`') && agents!.includes('`go`'), 'lists targets')
    ok(!agents!.includes('`old`'), 'excludes inactive target')
    ok(agents!.includes('`log`') && agents!.includes('`test`'), 'lists features')
    ok(agents!.includes('`Advice`'), 'lists entities')
    ok(agents!.includes('ts/AGENTS.md'), 'links per-language guide')
    const flat = agents!.replace(/\s+/g, ' ')
    ok(!agents!.includes('merges** into') && !agents!.includes('never DELETES'), 'no merge or keep claim')
    ok(flat.includes('deletes the files it generated before and no longer emits'), 'generate prunes')
    ok(flat.includes('merge toolchain updates into the copies this project has edited'), 'an add merges')
    ok(!agents!.includes('Built-in features'), 'no fixed list of built-in features')
    ok(agents!.includes('each SDK target that supports it'), 'features reach the targets that take them')
    ok(!agents!.includes('every SDK target'), 'no claim that every target takes every feature')
    ok(agents!.includes('<lang>/src/feature/<name>/AGENTS.md'), 'names the per-feature guides ts writes')
  })

  test('says the add overwrites when the project regenerates .sdk in full', async () => {
    const files = await render(AgentGuideTop, {}, undefined, { model: makeModel({ copies: 'overwrite' }) })
    const agents = find(files, '/p/AGENTS.md')!.replace(/\s+/g, ' ')
    ok(agents.includes("overwrite the templates and components in `.sdk/` (`main: kit: copies: 'overwrite'`)"),
      'the overwrite rule')
    ok(!agents.includes('merge toolchain updates into the copies this project has edited'), 'not the merge rule')
  })

  test('names no per-feature guide when no target writes one', async () => {
    const files = await render(AgentGuideTop, {}, undefined, { model: makeModel({ ts: false }) })
    const agents = find(files, '/p/AGENTS.md')
    ok(agents!.includes('`<lang>/AGENTS.md`'), 'still names the per-language guides')
    ok(!agents!.includes('src/feature/<name>/AGENTS.md'), 'no per-feature guide for a flat-layout project')
  })

  test('emits a thin CLAUDE.md pointing at AGENTS.md', async () => {
    const files = await render(AgentGuideTop, {})
    const claude = find(files, '/p/CLAUDE.md')
    ok(claude, 'root CLAUDE.md exists')
    ok(claude!.includes('See [AGENTS.md](./AGENTS.md)'), 'points to AGENTS.md')
  })
})


describe('AgentGuide — dir layout (ts/js)', () => {
  test('emits guide-relative commands and per-feature guides', async () => {
    const files = await render(AgentGuide, { target: 'ts' }, 'ts')

    const agents = find(files, 'ts/AGENTS.md')
    ok(agents, 'ts/AGENTS.md exists')
    ok(agents!.includes('# Demo TypeScript — Agent Guide'), 'title')
    ok(agents!.includes('.sdk/model/target/ts.aontu'), 'target model path (.aontu)')
    ok(!agents!.includes('.jsonic'), 'no stale .jsonic')
    // Commands are relative to the guide's directory (comment 3).
    ok(agents!.includes('cd ../.sdk'), 'regenerate from ../.sdk, not .sdk')
    ok(!/\ncd \.sdk\n/.test(agents!), 'no bare `cd .sdk`')
    ok(agents!.includes('relative to the **project root**'), 'notes root-relative paths')
    // Make-based build/test (comment 2).
    ok(agents!.includes('make build') && agents!.includes('make test'), 'make commands')

    ok(find(files, 'ts/CLAUDE.md'), 'ts/CLAUDE.md exists')

    // Per-feature guides co-located (dir layout only).
    const flat = agents!.replace(/\s+/g, ' ')
    ok(flat.includes('Each `npm run generate` rewrites every file it generates'), 'regeneration')
    ok(flat.includes('merge toolchain updates into the copies'), 'the add rule')

    ok(find(files, 'ts/src/feature/log/AGENTS.md'), 'log feature guide co-located')
    ok(find(files, 'ts/src/feature/test/AGENTS.md'), 'test feature guide co-located')
    ok(agents!.includes('./src/feature/log/AGENTS.md'), 'links the feature guide')
  })
})


describe('AgentGuide — flat layout (go/py/php/rb/lua)', () => {
  test('documents features inline, emits no per-feature files', async () => {
    const files = await render(AgentGuide, { target: 'go' }, 'go', {
      seed: ['tm/go/feature/log_feature.go', 'tm/go/feature/test_feature.go',
        'tm/go/src/feature/log/.gitkeep'],
    })

    const agents = find(files, 'go/AGENTS.md')
    ok(agents, 'go/AGENTS.md exists')
    // No per-feature guide files for a flat-layout target (comment 4).
    ok(!find(files, 'go/src/feature/log/AGENTS.md'), 'no src/feature per-feature file')
    ok(!find(files, 'go/feature/log/AGENTS.md'), 'no feature/<name> per-feature file')
    // Features documented inline with the real flat runtime file + hooks.
    ok(agents!.includes('## Features in this target'), 'feature section present')
    ok(agents!.includes('`.sdk/tm/go/feature/log_feature.go`'), 'the template discovery finds')
    ok(!agents!.includes('src/feature/log'), 'not the empty per-feature directory')
    ok(agents!.includes('`PreRequest`') && agents!.includes('`PreResponse`'), 'active hooks inline')
    ok(agents!.includes('cd ../.sdk') && agents!.includes('make test'), 'commands fixed here too')
  })

  test('says so when the target keeps no template per feature', async () => {
    const files = await render(AgentGuide, { target: 'go' }, 'go')
    const agents = find(files, 'go/AGENTS.md')
    ok(agents!.replace(/\s+/g, ' ').includes('no template per feature'), 'no per-feature template to name')
    ok(!agents!.includes('| Template |'), 'no template column')
  })
})


// The root guide and the README read the same copy mode.
describe('AgentGuideTop — the copy mode agrees with the README', () => {
  for (const copies of ['merge', 'overwrite']) {
    test(copies, async () => {
      const { fs, vol } = memfs({})
      const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog([]) })
      const cwd = process.cwd()
      process.chdir(SCAFFOLD)
      try {
        const res = await sdkgen.generate({
          model: compileModel(['ts'], undefined, `main: kit: copies: '${copies}'`), root: makeRoot(),
        })
        ok(true === res.ok, 'generated')
      }
      finally {
        process.chdir(cwd)
      }
      const files = staged(vol)
      const agents = files['AGENTS.md'].replace(/\s+/g, ' ')
      const readme = files['README.md'].replace(/\s+/g, ' ')
      const declared = "`main: kit: copies: 'overwrite'`"
      deepStrictEqual([agents.includes(declared), readme.includes(declared)],
        'overwrite' === copies ? [true, true] : [false, false])
    })
  }
})


// Every bundled target, generated for real: each template a guide lists
// exists in the scaffold, and the run writes a runtime file of that name.
describe('AgentGuide — feature templates in a generated tree', () => {
  test('every listed template exists and is generated', async () => {
    const targets = Fs.readdirSync(Path.join(SCAFFOLD, 'model', 'target'))
      .filter((f: string) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
      .map((f: string) => f.replace(/\.aontu$/, '')).sort()
    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog([]) })
    const cwd = process.cwd()
    process.chdir(SCAFFOLD)
    try {
      const res = await sdkgen.generate({
        model: compileModel(targets, undefined, '', ['test', 'log', 'retry']), root: makeRoot(),
      })
      ok(true === res.ok, 'generated')
    }
    finally {
      process.chdir(cwd)
    }

    const files = staged(vol)
    const written = Object.keys(files)
    const listed: string[] = []
    const shared: string[] = []
    for (const t of targets) {
      const guide = files[t + '/AGENTS.md']
      if (null == guide || !guide.includes('## Features in this target')) continue
      if (guide.replace(/\s+/g, ' ').includes('no template per feature')) shared.push(t)
      for (const m of guide.matchAll(/\| \*\*([a-z]+)\*\*[^|]*\| `\.sdk\/tm\/([^`]+)` \|/g)) {
        const rel = m[2]
        listed.push(t + ':' + m[1])
        ok(Fs.existsSync(Path.join(SCAFFOLD, 'tm', rel)), t + ': listed template exists: ' + rel)
        const base = Path.posix.basename(rel)
        ok(written.some((w: string) => w.startsWith(t + '/') && w.endsWith('/' + base)),
          t + ': the run writes ' + base)
      }
    }
    ok(listed.includes('c:retry') && listed.includes('py:retry') && listed.includes('swift:retry'),
      'flat targets list their templates')
    deepStrictEqual(shared, ['clojure', 'ocaml'], 'targets with one shared feature runtime')
  })
})


describe('AgentGuide — feature phase disabled (go-cli/go-mcp)', () => {
  test('emits no feature section and no per-feature files', async () => {
    const files = await render(AgentGuide, { target: 'go-cli' }, 'go-cli')

    const agents = find(files, 'go-cli/AGENTS.md')
    ok(agents, 'go-cli/AGENTS.md exists')
    ok(agents!.includes('CLI surface'), 'notes the CLI surface type')
    ok(!agents!.includes('## Features in this target'), 'no feature section when phase off')
    ok(!find(files, 'go-cli/src/feature/log/AGENTS.md'), 'no per-feature files')
    ok(!find(files, 'go-cli/feature/log/AGENTS.md'), 'no per-feature files')
  })
})


describe('AgentGuideFeature (dir layout)', () => {
  test('feature guide has active hooks, .aontu paths, root-relative regenerate', async () => {
    const files = await render(
      AgentGuideFeature,
      { target: T_TS, feature: makeModel().main.kit.feature.log },
      'ts',
    )

    const agents = find(files, 'ts/src/feature/log/AGENTS.md')
    ok(agents, 'feature AGENTS.md exists')
    ok(agents!.includes('# LogFeature — Agent Guide'), 'feature title')
    ok(agents!.includes('`PreRequest`') && agents!.includes('`PreResponse`'), 'active hooks')
    ok(!agents!.includes('`SetData`'), 'omits inactive hook')
    ok(agents!.includes('.sdk/model/feature/log.aontu'), 'model def path (.aontu)')
    ok(!agents!.includes('.jsonic'), 'no stale .jsonic')
    ok(agents!.includes('.sdk/tm/ts/src/feature/log/'), 'runtime template path')
    ok(agents!.includes('cd ../../../../.sdk'), 'regenerate path relative to feature dir depth')
    ok(agents!.includes('Active by default: **yes**'), 'log is active by default')
    ok(find(files, 'ts/src/feature/log/CLAUDE.md'), 'feature CLAUDE.md')
    ok(agents!.includes('every entity operation (list, load) and'), 'the operations the entities have')
    ok(agents!.replace(/\s+/g, ' ').includes('deletes the files it generated before'), 'regeneration')
    ok(!agents!.includes('ProjectName'), 'no placeholder leak advice')
    ok(!agents!.includes('patch'), 'no operation the model lacks')
  })

  test('names no operation when no entity has one', async () => {
    const model = makeModel()
    model.main.kit.entity.advice.op = {}
    const files = await render(AgentGuideFeature,
      { target: T_TS, feature: model.main.kit.feature.log }, 'ts', { model })
    const agents = find(files, 'ts/src/feature/log/AGENTS.md')
    ok(agents!.includes('stages of every entity operation and of'), 'no empty parenthesis')
  })

  test('feature inactive-by-default renders as no', async () => {
    const files = await render(
      AgentGuideFeature,
      { target: T_TS, feature: makeModel().main.kit.feature.test },
      'ts',
    )
    const agents = find(files, 'ts/src/feature/test/AGENTS.md')
    ok(agents!.includes('Active by default: **no**'), 'test is not active by default')
  })
})
