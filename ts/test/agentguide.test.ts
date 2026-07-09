
import { test, describe } from 'node:test'
import { ok, match } from 'node:assert'

import { Jostraca, Project, Folder } from 'jostraca'
import { memfs } from 'memfs'

import { AgentGuideTop, AgentGuide, AgentGuideFeature } from '../dist/sdkgen.js'


const noop = () => {}
const log: any = {
  info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  child() { return log },
}

function makeModel() {
  return {
    name: 'demo', Name: 'Demo', const: { Name: 'Demo' },
    main: { kit: {
      target: {
        ts: { active: true, name: 'ts', title: 'TypeScript' },
        go: { active: true, name: 'go', title: 'Go' },
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
    // Real, active targets/features (inactive `old` excluded).
    ok(agents!.includes('`ts`') && agents!.includes('`go`'), 'lists targets')
    ok(!agents!.includes('`old`'), 'excludes inactive target')
    ok(agents!.includes('`log`') && agents!.includes('`test`'), 'lists features')
    ok(agents!.includes('`Advice`'), 'lists entities')
    // Links to per-language guides.
    ok(agents!.includes('ts/AGENTS.md'), 'links per-language guide')
    // The merge gotcha must be taught.
    ok(agents!.includes('ProjectName') && agents!.includes('regenerate'), 'merge gotcha')
  })

  test('emits a thin CLAUDE.md pointing at AGENTS.md', async () => {
    const files = await render(AgentGuideTop, {})
    const claude = find(files, '/p/CLAUDE.md')
    ok(claude, 'root CLAUDE.md exists')
    ok(claude!.includes('See [AGENTS.md](./AGENTS.md)'), 'points to AGENTS.md')
  })
})


describe('AgentGuide (per language)', () => {
  test('emits <lang>/AGENTS.md + CLAUDE.md and drives per-feature guides', async () => {
    const files = await render(AgentGuide, { target: { name: 'ts', title: 'TypeScript' } }, 'ts')

    const agents = find(files, 'ts/AGENTS.md')
    ok(agents, 'ts/AGENTS.md exists')
    ok(agents!.includes('# Demo TypeScript — Agent Guide'), 'title')
    ok(agents!.includes('.sdk/src/cmp/ts/'), 'points at this target components')
    ok(agents!.includes('.sdk/tm/ts/'), 'points at this target templates')
    ok(agents!.includes('.sdk/model/target/ts.jsonic'), 'points at target model')
    ok(agents!.includes('npm run generate'), 'regenerate command')
    ok(agents!.includes('../AGENTS.md'), 'links back to project guide')

    ok(find(files, 'ts/CLAUDE.md'), 'ts/CLAUDE.md exists')

    // Co-located per-feature guides were driven for this target.
    ok(find(files, 'ts/src/feature/log/AGENTS.md'), 'log feature guide co-located')
    ok(find(files, 'ts/src/feature/test/AGENTS.md'), 'test feature guide co-located')
    ok(find(files, 'ts/src/feature/log/CLAUDE.md'), 'log feature CLAUDE.md')
  })

  test('go-cli surface note renders when applicable', async () => {
    const files = await render(AgentGuide, { target: { name: 'go-cli', title: 'Go CLI' } }, 'go-cli')
    const agents = find(files, 'go-cli/AGENTS.md')
    ok(agents!.includes('CLI surface'), 'notes the CLI surface type')
  })
})


describe('AgentGuideFeature', () => {
  test('emits a feature guide with active hooks and model paths', async () => {
    const files = await render(
      AgentGuideFeature,
      { target: { name: 'ts', title: 'TypeScript' }, feature: makeModel().main.kit.feature.log },
      'ts',
    )

    const agents = find(files, 'ts/src/feature/log/AGENTS.md')
    ok(agents, 'feature AGENTS.md exists')
    ok(agents!.includes('# LogFeature — Agent Guide'), 'feature title')
    // Active hooks listed; inactive one omitted.
    ok(agents!.includes('`PreRequest`') && agents!.includes('`PreResponse`'), 'active hooks')
    ok(!agents!.includes('`SetData`'), 'omits inactive hook')
    ok(agents!.includes('.sdk/model/feature/log.jsonic'), 'model def path')
    ok(agents!.includes('.sdk/tm/ts/src/feature/log/'), 'runtime template path')
    ok(agents!.includes('Active by default: **yes**'), 'log is active by default')
    ok(find(files, 'ts/src/feature/log/CLAUDE.md'), 'feature CLAUDE.md')
  })

  test('feature inactive-by-default renders as no', async () => {
    const files = await render(
      AgentGuideFeature,
      { target: { name: 'ts', title: 'TypeScript' }, feature: makeModel().main.kit.feature.test },
      'ts',
    )
    const agents = find(files, 'ts/src/feature/test/AGENTS.md')
    ok(agents!.includes('Active by default: **no**'), 'test is not active by default')
  })
})
