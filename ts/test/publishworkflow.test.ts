/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import { Jostraca, Project } from 'jostraca'
import { memfs } from 'memfs'

import { PublishWorkflow } from '../dist/sdkgen.js'


const noop = () => {}
const log: any = {
  info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  child() { return log },
}


function makeModel(targets: any) {
  return {
    name: 'demo',
    origin: 'voxgig-sdk',
    main: {
      kit: {
        repo: { host: 'github.com', org: 'acme', name: 'demo-sdk' },
        target: targets,
      },
    },
  }
}


async function render(targets: any): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  const jostraca = Jostraca()

  await jostraca.generate(
    { fs: () => fs, folder: '/x', model: makeModel(targets), log },
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
  return out
}


const NPM_TS = {
  ts: {
    active: true, name: 'ts',
    publish: { registry: { name: 'npm', url: 'https://registry.npmjs.org' } },
  },
}


describe('PublishWorkflow', () => {

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


  // EACH TARGET'S WORKFLOW NAMES ITS OWN PACKAGE.
  //
  // `packageName(model, 'npm')` resolves the ECOSYSTEM's primary target — ts
  // — so resolving by ecosystem gave every npm target the ts package name:
  // publish-js.yml claimed the ts package while `js/` publishes its own. It
  // would have checked the wrong package on the registry and told a
  // maintainer to trust the wrong one, while `npm publish` shipped the right
  // one — wrong in three places, and green everywhere.
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


  // THE MAINTAINER DOC IS NOT TARGET DOCUMENTATION. The target directories
  // describe the SDK to the people who INSTALL it; how this repository
  // releases is none of their business, so it lives beside the generator.
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
