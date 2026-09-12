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


  // A RELEASE THAT LEAVES NO REF CANNOT BE ANSWERED LATER. 0.0.3 of the
  // GitHub SDK published by dispatch while the repository still had only
  // v0.0.1 and v0.0.2: nothing in git said which tree the tarball came from,
  // and nothing downstream could pin the SDK by tag.
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


  // ONE BARE TAG PER REPOSITORY. `ts/` and `js/` are separate packages on a
  // lockstep version, so a bare `v<version>` cut by each would be two targets
  // racing for one name — and the loser fails a release that has already
  // published. The primary npm target owns the bare tag; the rest are
  // prefixed, as apidef tags `go/v<version>` beside its `v<version>`.
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
