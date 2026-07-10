
import { test, describe } from 'node:test'
import { ok } from 'node:assert'

import { Jostraca, Project, Folder } from 'jostraca'
import { memfs } from 'memfs'

import { AgentGuideTop, AgentGuide, AgentGuideFeature } from '../dist/sdkgen.js'


const noop = () => {}
const log: any = {
  info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  child() { return log },
}

// Target fixtures exercising the three feature layouts:
//   ts     — dir layout (per-feature src/feature/<name>/), srcfeature default
//   go     — flat layout (feature/<name>_feature.go), srcfeature:false
//   go-cli — feature phase disabled (no feature output at all)
const T_TS = { name: 'ts', title: 'TypeScript', ext: 'ts' }
const T_GO = { name: 'go', title: 'Go', ext: 'go', srcfeature: false }
const T_GOCLI = { name: 'go-cli', title: 'Go CLI', ext: 'go', phase: { feature: { active: false } } }

function makeModel() {
  return {
    name: 'demo', Name: 'Demo', const: { Name: 'Demo' },
    main: { kit: {
      target: {
        ts: { active: true, ...T_TS },
        go: { active: true, ...T_GO },
        old: { active: false, name: 'old', title: 'Old' },
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
        advice: { active: true, name: 'advice', Name: 'Advice' },
      },
    } },
  }
}


// Render a component (optionally inside an ambient target folder) and return
// the memfs file map (path -> content).
async function render(comp: any, props: any, folder?: string): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  const jostraca = Jostraca()
  await jostraca.generate(
    { fs: () => fs, folder: '/x', model: makeModel(), log },
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
    ok(agents!.includes('ProjectName') && agents!.includes('regenerate'), 'merge gotcha')
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
    const files = await render(AgentGuide, { target: T_TS }, 'ts')

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
    ok(find(files, 'ts/src/feature/log/AGENTS.md'), 'log feature guide co-located')
    ok(find(files, 'ts/src/feature/test/AGENTS.md'), 'test feature guide co-located')
    ok(agents!.includes('./src/feature/log/AGENTS.md'), 'links the feature guide')
  })
})


describe('AgentGuide — flat layout (go/py/php/rb/lua)', () => {
  test('documents features inline, emits no per-feature files', async () => {
    const files = await render(AgentGuide, { target: T_GO }, 'go')

    const agents = find(files, 'go/AGENTS.md')
    ok(agents, 'go/AGENTS.md exists')
    // No per-feature guide files for a flat-layout target (comment 4).
    ok(!find(files, 'go/src/feature/log/AGENTS.md'), 'no src/feature per-feature file')
    ok(!find(files, 'go/feature/log/AGENTS.md'), 'no feature/<name> per-feature file')
    // Features documented inline with the real flat runtime file + hooks.
    ok(agents!.includes('## Features in this target'), 'feature section present')
    ok(agents!.includes('`feature/log_feature.go`'), 'real flat runtime path')
    ok(agents!.includes('`PreRequest`') && agents!.includes('`PreResponse`'), 'active hooks inline')
    ok(agents!.includes('.sdk/tm/go/feature/'), 'flat template path')
    ok(agents!.includes('cd ../.sdk') && agents!.includes('make test'), 'commands fixed here too')
  })
})


describe('AgentGuide — feature phase disabled (go-cli/go-mcp)', () => {
  test('emits no feature section and no per-feature files', async () => {
    const files = await render(AgentGuide, { target: T_GOCLI }, 'go-cli')

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
