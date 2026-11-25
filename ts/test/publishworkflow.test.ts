/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'
import Path from 'node:path'

import { Jostraca, Project } from 'jostraca'
import { memfs } from 'memfs'

import { PublishWorkflow, applyFacts } from '../dist/sdkgen.js'


const noop = () => {}
const log: any = {
  info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  child() { return log },
}


// A test reuses its target objects, and the fact pass writes into each.
function makeModel(targets: any, host: string, kit: any = {}) {
  return applyFacts({
    name: 'demo',
    origin: 'voxgig-sdk',
    main: {
      kit: {
        ...kit,
        repo: { host, org: 'acme', name: 'demo-sdk' },
        target: Object.fromEntries(Object.entries(structuredClone(targets))
          .map(([name, t]: [string, any]) => [name, { output: { path: '', root: false }, ...t }])),
      },
    },
  })
}


async function renderFs(targets: any, host = 'github.com', kit: any = {}) {
  const { fs, vol } = memfs({})
  const jostraca = Jostraca()

  await jostraca.generate(
    { fs: () => fs, folder: '/x', model: makeModel(targets, host, kit), log },
    () => {
      Project({ folder: 'p' }, () => {
        PublishWorkflow({})
      })
    },
  )

  const json: any = vol.toJSON()
  const out: Record<string, string> = {}
  for (const k of Object.keys(json)) {
    out[k.replace(/^.*\/p\//, '')] = json[k]
  }
  return { out, fs }
}


async function render(targets: any, host?: string, kit?: any): Promise<Record<string, string>> {
  return (await renderFs(targets, host, kit)).out
}


const NPM_TS = {
  ts: {
    active: true, name: 'ts',
    publish: { registry: { name: 'npm', url: 'https://registry.npmjs.org' } },
  },
}


describe('PublishWorkflow', () => {

  // The first release goes out by hand, from the first npm target's directory.
  test('the first-release command enters the first npm target\'s own directory', async () => {
    const doc = (await render({ js: { ...NPM_TS.ts, name: 'js' } }))['.sdk/PUBLISHING.md']
    ok(doc.includes('    cd js && npm publish --access public'), doc)
    ok(!doc.includes('cd ts'), doc)
  })

  test('emits a dispatch workflow per npm target', async () => {
    const out = await render(NPM_TS)
    const wf = out['.github/workflows/publish-ts.yml']

    ok(null != wf, 'no workflow: ' + Object.keys(out).join(', '))
    ok(wf.includes('workflow_dispatch:'), 'not dispatch-triggered')
    ok(!/^on:[\s\S]*?\bpush:/m.test(wf),
      'a push trigger would race the vault-token deploy Makefile')
  })


  // A TARGET WITH NO npm REGISTRY GETS NOTHING. The mechanics here are npm's,
  // and a PyPI or RubyGems target needs its own workflow rather than this one
  // with a word changed.
  test('ignores a target that does not publish to npm', async () => {
    const out = await render({
      py: {
        active: true, name: 'py',
        publish: { registry: { name: 'pypi' } },
      },
      go: { active: true, name: 'go' },
    })

    // jostraca writes its own bookkeeping regardless; what must be absent
    // is anything this component emits.
    const emitted = Object.keys(out)
      .filter((p) => p.startsWith('.github/') || p.startsWith('.sdk/'))

    deepStrictEqual(emitted, [], 'emitted something for a non-npm target')
  })


  test('an inactive registry gets no workflow, a pending one does', async () => {
    const npm = (state: string) => ({ name: 'npm', state })
    const out = await render({
      ts: { active: true, name: 'ts', publish: { registry: npm('inactive') } },
      js: { active: true, name: 'js', publish: { registry: { ...npm('pending'), package: '@acme/demo-js' } } },
    })
    strictEqual(out['.github/workflows/publish-ts.yml'], undefined, 'inactive ts got a workflow')
    ok(null != out['.github/workflows/publish-js.yml'], 'pending js lost its workflow')
    const doc = out['.sdk/PUBLISHING.md']
    ok(!doc.includes('`ts/`') && !doc.includes('publish-ts.yml'), 'the doc lists the inactive target')
    ok(!out['.sdk/admin/setup-npm-trust.sh'].includes('publish-ts.yml'),
      'the trust script registers the inactive target')

    const none = await render({ ts: { active: true, name: 'ts', publish: { registry: npm('inactive') } } })
    deepStrictEqual(Object.keys(none).filter((p) => p.startsWith('.github/') || p.startsWith('.sdk/')), [],
      'emitted something for an inactive registry')
  })


  // The root Makefile publishes an active registry and only tags a pending
  // one, so "it also publishes" is the reason for a dispatch only when active.
  test('the dispatch reason follows the registry state', async () => {
    const reason = (doc: string) => doc.slice(doc.indexOf('It is a DISPATCH'), doc.indexOf('## The release'))
    const ts = (state?: string) => ({
      active: true, name: 'ts',
      publish: { registry: { name: 'npm', ...(state ? { state } : {}) } },
    })

    const active = await render({ ts: ts('active') })
    ok(reason(active['.sdk/PUBLISHING.md']).includes('also\npublishes, with a vault-injected token'),
      reason(active['.sdk/PUBLISHING.md']))
    ok(active['.github/workflows/publish-ts.yml'].includes('The deploy Makefile publishes with a'))

    for (const state of [undefined, 'pending']) {
      const out = await render({ ts: ts(state) })
      const why = reason(out['.sdk/PUBLISHING.md'])
      ok(why.includes('only cuts the git tag') && !why.includes('also\npublishes'), why)
      const wf = out['.github/workflows/publish-ts.yml']
      ok(wf.includes('Makefile only cuts the git tag') && !wf.includes('Makefile publishes with a'), wf.slice(0, 1600))
    }

    const mixed = await render({
      ts: ts('active'),
      js: { active: true, name: 'js', publish: { registry: { name: 'npm', package: '@acme/demo-js' } } },
    })
    const why = reason(mixed['.sdk/PUBLISHING.md'])
    ok(why.includes('Where a registry is active') && why.includes('Where one is pending'), why)
  })


  test('each npm target names its own package', async () => {
    const out = await render({
      ts: {
        active: true, name: 'ts',
        publish: { registry: { name: 'npm' } },
      },
      js: {
        active: true, name: 'js',
        publish: {
          registry: { name: 'npm', package: '@acme/demo-js' },
        },
      },
    })

    const tswf = out['.github/workflows/publish-ts.yml']
    const jswf = out['.github/workflows/publish-js.yml']
    ok(null != tswf && null != jswf, 'both workflows: ' + Object.keys(out))

    ok(jswf.includes('@acme/demo-js'),
      'the js workflow does not name the js package')
    ok(!jswf.includes('@voxgig-sdk/demo-sdk'),
      'the js workflow names the ts package')

    // And the doc's table carries each package beside its own target.
    const doc = out['.sdk/PUBLISHING.md']
    ok(doc.includes('@acme/demo-js'),
      'the doc does not name the js package: ' + doc.slice(0, 600))
  })


  // packageName would answer the SDK's own name for a consumer target, so
  // one publishes only a package it names.
  test('a consumer target gets a workflow only for a package it names', async () => {
    const off = { active: false }
    const phase = { entity: off, feature: off, readme: off, agentguide: off, test: off }
    const provider = (registry: any) => ({ active: true, name: 'provider', phase, publish: { registry } })

    const unnamed = await render({ ...NPM_TS, provider: provider({ name: 'npm' }) })
    ok(null != unnamed['.github/workflows/publish-ts.yml'], 'no ts workflow: ' + Object.keys(unnamed))
    deepStrictEqual(Object.keys(unnamed).filter((p) => /provider/.test(p)), [],
      'a workflow for a package the target never named')
    ok(!unnamed['.sdk/PUBLISHING.md'].includes('provider'), 'the doc lists the consumer target')

    const named = await render({
      ...NPM_TS,
      provider: provider({ name: 'npm', package: '@acme/demo-provider' }),
    })
    ok(named['.github/workflows/publish-provider.yml'].includes('@acme/demo-provider'),
      'the consumer target does not publish its own package: ' + Object.keys(named))
  })


  test('the set-up doc goes to .sdk, not into the target', async () => {
    const out = await render(NPM_TS)

    ok(null != out['.sdk/PUBLISHING.md'],
      'no .sdk/PUBLISHING.md: ' + Object.keys(out).join(', '))

    const stray = Object.keys(out).filter((p) => p.startsWith('ts/'))
    deepStrictEqual(stray, [], 'publishing docs leaked into the target')
  })


  // npm BINDS TRUST TO THE WORKFLOW FILENAME, so the doc has to name the file
  // that actually exists — a set-up instruction naming the wrong one
  // registers a publisher that can never publish.
  test('the doc names the workflow file that was generated', async () => {
    const out = await render(NPM_TS)
    const doc = out['.sdk/PUBLISHING.md']

    ok(doc.includes('npm trust github'), 'no trust command in the doc')
    ok(doc.includes('--file publish-ts.yml'),
      'the doc does not name publish-ts.yml: ' + doc.slice(0, 400))
    ok(doc.includes('--allow-publish'), 'the trust command grants nothing')
  })


  // THE SCRIPT AND THE WORKFLOWS COME FROM ONE MODEL, so npm is configured
  // for exactly the workflow files that exist, under the packages they name.
  test('the trust script registers exactly the workflows generated', async () => {
    const out = await render({
      ts: { active: true, name: 'ts', publish: { registry: { name: 'npm' } } },
      js: {
        active: true, name: 'js',
        publish: { registry: { name: 'npm', package: '@acme/demo-js' } },
      },
    })

    const script = out['.sdk/admin/setup-npm-trust.sh']
    ok(null != script, 'no trust script: ' + Object.keys(out).join(', '))
    ok(script.includes("--repository 'voxgig-sdk/demo-sdk'"), script)

    const wanted = Object.keys(out)
      .filter((p) => p.startsWith('.github/workflows/'))
      .map((p) => {
        const pkg = out[p].match(/^# Publishes (\S+) /m)![1]
        return `--publish '${pkg}=${Path.basename(p)}'`
      })
    deepStrictEqual(script.match(/--publish '[^']+'/g)!.sort(), wanted.sort())
    strictEqual(wanted.length, 2)
  })


  test('the workflow and the doc name the repository and the script', async () => {
    const out = await render(NPM_TS)
    const wf = out['.github/workflows/publish-ts.yml']
    const doc = out['.sdk/PUBLISHING.md']

    ok(wf.includes('--repository voxgig-sdk/demo-sdk'), wf.slice(0, 900))
    ok(!wf.includes('<owner>/<repo>'), 'the workflow still carries a placeholder')
    ok(wf.includes('.sdk/admin/setup-npm-trust.sh'), 'the workflow does not name the script')
    ok(doc.includes('.sdk/admin/setup-npm-trust.sh') && doc.includes('--check'),
      'the doc does not explain the script: ' + doc)
  })


  test('the trust script is executable', async () => {
    const { fs } = await renderFs(NPM_TS)
    strictEqual(fs.statSync('/x/p/.sdk/admin/setup-npm-trust.sh').mode & 0o777, 0o755)
  })


  // npm trusts GitHub Actions only for a repository on github.com. The script
  // is still written, refusing, so a copy from before a move cannot linger.
  test('a repository hosted elsewhere gets a script that refuses to run', async () => {
    const out = await render(NPM_TS, 'gitlab.example.com')
    const script = out['.sdk/admin/setup-npm-trust.sh']
    ok(null != script, 'no script, so an earlier github.com one would survive')
    ok(!/--repository|--publish|npm-trust\.js/.test(script), script)
    ok(/^exit 1$/m.test(script), script)
    ok(out['.github/workflows/publish-ts.yml'].includes('--repository <owner>/<repo>'))

    const cased = await render(NPM_TS, 'GitHub.com')
    ok(null != cased['.sdk/admin/setup-npm-trust.sh'],
      'a host name is case-insensitive, but GitHub.com lost the script')
  })


  // THE CREDENTIAL NEVER SHARES A JOB WITH PROJECT CODE. A dependency
  // lifecycle script can ask the runner for any OIDC token its job may mint.
  test('the publish job installs nothing and runs no project code', async () => {
    const out = await render(NPM_TS)
    const wf = out['.github/workflows/publish-ts.yml']

    const jobs: Record<string, string[]> = {}
    let current: string | null = null
    for (const line of wf.split('\n')) {
      const m = /^  ([a-z][a-z0-9_-]*):\s*$/.exec(line)
      if (null != m) {
        current = m[1]
        jobs[current] = []
        continue
      }
      if (null != current) {
        jobs[current].push(line)
      }
    }

    const credentialed = Object.keys(jobs)
      .filter((j) => jobs[j].some((l) => /id-token:\s*write/.test(l)))

    strictEqual(credentialed.length, 1,
      'expected exactly one credentialed job, got: ' + credentialed.join(', '))

    const body = jobs[credentialed[0]].join('\n')
    ok(!/run:\s*npm (install|ci)(?!\s+-g)/.test(body),
      'the credentialed job installs project dependencies')
    ok(!/npm (run build|test)\b/.test(body),
      'the credentialed job runs project code')
  })


  test('a successful publish is tagged', async () => {
    const out = await render(NPM_TS)
    const wf = out['.github/workflows/publish-ts.yml']

    ok(/^  tag:$/m.test(wf), 'no tag job: ' + wf.slice(-400))
    ok(/git push origin "refs\/tags\/\$TAG"/.test(wf), 'the tag job pushes no tag')

    // AFTER the publish, not beside it. A tag cut in parallel would name a
    // release that may never have reached the registry.
    ok(/needs: \[verify, publish\]/.test(wf),
      'the tag job does not wait for the publish')
  })


  // THE REPOSITORY-WRITE CREDENTIAL NEVER SHARES A JOB WITH PROJECT CODE.
  // `checkout` persists its token into the git config for the whole job, so
  // `contents: write` beside an `npm install` is the same exposure that
  // `id-token: write` beside one would be.
  test('only the tag job may write to the repository', async () => {
    const out = await render(NPM_TS)
    const wf = out['.github/workflows/publish-ts.yml']

    const jobs: Record<string, string[]> = {}
    let current: string | null = null
    for (const line of wf.split('\n')) {
      const m = /^  ([a-z][a-z0-9_-]*):\s*$/.exec(line)
      if (null != m) {
        current = m[1]
        jobs[current] = []
        continue
      }
      if (null != current) {
        jobs[current].push(line)
      }
    }

    const writers = Object.keys(jobs)
      .filter((j) => jobs[j].some((l) => /contents:\s*write/.test(l)))

    deepStrictEqual(writers, ['tag'],
      'expected only the tag job to hold contents: write, got: ' +
      writers.join(', '))

    const body = jobs.tag.join('\n')
    ok(!/run:\s*npm (install|ci)\b/.test(body),
      'the repository-writing job installs dependencies')
    ok(!/npm (run build|test|publish)\b/.test(body),
      'the repository-writing job runs project code')
  })


  test('only the primary npm target owns the bare tag', async () => {
    const out = await render({
      ts: {
        active: true, name: 'ts',
        publish: { registry: { name: 'npm' } },
      },
      js: {
        active: true, name: 'js',
        publish: { registry: { name: 'npm', package: '@acme/demo-js' } },
      },
    })

    const tsTag = /TAG="([^"]+)"/.exec(out['.github/workflows/publish-ts.yml'])
    const jsTag = /TAG="([^"]+)"/.exec(out['.github/workflows/publish-js.yml'])

    strictEqual(tsTag && tsTag[1], 'v$VERSION', 'ts does not own the bare tag')
    strictEqual(jsTag && jsTag[1], 'js/v$VERSION', 'js is not prefixed')
  })


  // A sole npm target is the primary one whatever it is called, so it takes
  // the bare tag rather than an oddly prefixed one nothing else competes for.
  test('a sole npm target takes the bare tag', async () => {
    const out = await render({
      js: {
        active: true, name: 'js',
        publish: { registry: { name: 'npm' } },
      },
    })

    const m = /TAG="([^"]+)"/.exec(out['.github/workflows/publish-js.yml'])
    strictEqual(m && m[1], 'v$VERSION', 'a sole target did not take the bare tag')
  })


  test('a declared prefix names the tag, and a tag switched off cuts none', async () => {
    const prefixed = await render({ ts: { ...NPM_TS.ts, publish: { ...NPM_TS.ts.publish, tag: { prefix: 'sdk' } } } })
    const m = /TAG="([^"]+)"/.exec(prefixed['.github/workflows/publish-ts.yml'])
    strictEqual(m && m[1], 'sdk/v$VERSION')
    ok(prefixed['.sdk/PUBLISHING.md'].includes('| `ts/` | `sdk/v<version>` |'))
    ok(prefixed['.github/workflows/publish-ts.yml'].includes('# THREE JOBS,'))
    ok(!prefixed['.sdk/PUBLISHING.md'].includes('reads none'))

    const off = await render({ ts: { ...NPM_TS.ts, publish: { ...NPM_TS.ts.publish, tag: { active: false } } } })
    const wf = off['.github/workflows/publish-ts.yml']
    ok(!/^ {2}tag:$/m.test(wf) && !wf.includes('TAG='), 'a tag job is emitted for a target that cuts no tag')
    ok(off['.sdk/PUBLISHING.md'].includes('| `ts/` | none |'))
    ok(wf.includes('# TWO JOBS,') && wf.includes('# NO TAG IS CUT.') && !wf.includes('#   tag      contents:'),
      'the header of a workflow that cuts no tag describes a tag job')
    const doc = off['.sdk/PUBLISHING.md']
    ok(doc.includes('## No release tag') && doc.includes('## Why the workflow has two jobs') &&
      !doc.includes('The tag job'), 'PUBLISHING.md describes a tag job no workflow has:\n' + doc)

    const mixed = (await render({ ...NPM_TS, js: { ...NPM_TS.ts, name: 'js', publish: {
      ...NPM_TS.ts.publish, tag: { active: false } } } }))['.sdk/PUBLISHING.md']
    ok(mixed.includes('## The release is tagged for you') && mixed.includes('| `js/` | none |') &&
      mixed.includes('A target whose tag reads none cuts no tag'), mixed)
  })


  test('releases come from the branch the model names', async () => {
    const out = await render(NPM_TS, undefined, { doc: { ci: { branch: 'trunk' } } })
    const wf = out['.github/workflows/publish-ts.yml']
    ok(wf.includes('if [ "${GITHUB_REF_NAME}" != "trunk" ]; then'), wf)
    ok(!/\bmain\b/.test(wf.replace(/main\.\$\{KIT\}/g, '')), 'the workflow still names main')
    ok(out['.sdk/PUBLISHING.md'].includes('--ref trunk -f expect_sha'))
  })


  // Every action pinned to a SHA: an org can require it, and a workflow
  // naming a tag then fails to START, with no jobs and no logs.
  test('every action is pinned to a SHA', async () => {
    const out = await render(NPM_TS)
    const wf = out['.github/workflows/publish-ts.yml']

    for (const line of wf.split('\n')) {
      const m = /^\s*(?:-\s+)?uses:\s*(\S+)/.exec(line)
      if (null == m) {
        continue
      }
      ok(/@[0-9a-f]{40}$/.test(m[1]), 'action named by tag: ' + m[1])
    }
  })

})
