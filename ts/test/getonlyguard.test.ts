import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import Fs from 'node:fs'
import Path from 'node:path'

const { fetcher } = require('../project/.sdk/tm/js/src/utility/FetcherUtility')
const { runLiveSteps, createLiveTransport } = require('../project/.sdk/tm/js/test/live-runner')


// A GET-only live run sets this beside <PROJ>_TEST_LIVE=TRUE. Every SDK
// target's own transport refuses a non-GET under it, rather than relying on
// an HTTP-client hook that can miss a client. Each target's guard test runs
// on its own toolchain; this says no target was left out.

const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')
const TM = Path.join(SDK, 'tm')

const CONSUMER_TARGETS = ['go-cli', 'go-mcp', 'py-data']

const ENV = 'VOXGIG_GETONLY_GUARD'
const CODE = 'fetch_getonly_block'

// The file whose default transport holds the guard, and the test that sends
// a POST through it with the flag set.
const GUARDED: Record<string, { fetcher: string, test: string }> = {
  ts: { fetcher: 'ts/src/utility/FetcherUtility.ts', test: 'ts/test/utility/PrimaryUtility.test.ts' },
  js: { fetcher: 'js/src/utility/FetcherUtility.js', test: 'js/test/utility/PrimaryUtility.test.js' },
  go: { fetcher: 'go/utility/fetcher.go', test: 'go/test/primary_utility_test.go' },
  py: { fetcher: 'py/pkg/utility/fetcher.py', test: 'py/test/test_primary_utility.py' },
  lua: { fetcher: 'lua/utility/fetcher.lua', test: 'lua/test/primary_utility_test.lua' },
  php: { fetcher: 'php/utility/Fetcher.php', test: 'php/test/PipelineTest.php' },
  rb: { fetcher: 'rb/utility/fetcher.rb', test: 'rb/test/primary_utility_test.rb' },
  perl: { fetcher: 'perl/utility/fetcher.pm', test: 'perl/t/primary_utility.t' },
  java: { fetcher: 'java/utility/Fetcher.java', test: 'java/test/PrimaryUtilityTest.java' },
  kotlin: { fetcher: 'kotlin/utility/Fetcher.kt', test: 'kotlin/test/PrimaryUtilityTest.kt' },
  scala: { fetcher: 'scala/utility/Fetcher.scala', test: 'scala/sdktest/SdkTestMain.scala' },
  csharp: { fetcher: 'csharp/utility/Fetcher.cs', test: 'csharp/test/PrimaryUtilityTest.cs' },
  rust: { fetcher: 'rust/utility/fetcher.rs', test: 'rust/tests/primary_utility_test.rs' },
  c: { fetcher: 'c/utility/fetcher.c', test: 'c/tests/primary_utility_test.c' },
  cpp: { fetcher: 'cpp/utility/pipeline.hpp', test: 'cpp/test/primary_utility_test.cpp' },
  swift: {
    fetcher: 'swift/Sources/ProjectNameSDK/utility/Fetcher.swift',
    test: 'swift/Tests/ProjectNameSDKTests/PrimaryUtilityTest.swift',
  },
  zig: { fetcher: 'zig/core/utility.zig', test: 'zig/test/primary_utility_test.zig' },
  clojure: { fetcher: 'clojure/src/sdk/core.clj', test: 'clojure/test/sdk/test/pipeline.clj' },
  elixir: { fetcher: 'elixir/lib/projectname/utility.ex', test: 'elixir/test/pipeline_test.exs' },
  ocaml: { fetcher: 'ocaml/sdk_runtime.ml', test: 'ocaml/test/t_pipeline.ml' },
}


function sdkTargets(): string[] {
  return Fs.readdirSync(Path.join(SDK, 'model', 'target'))
    .filter((f) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
    .map((f) => f.replace(/\.aontu$/, ''))
    .filter((t) => !CONSUMER_TARGETS.includes(t))
    .sort()
}


function liveCtx(fetch: any) {
  const errors: any[] = []
  return {
    errors,
    client: { _mode: 'live', options: () => ({ system: { fetch } }) },
    utility: { struct: { getpath: (o: any, p: string) => p.split('.').reduce((a, k) => a?.[k], o) } },
    error(code: string, msg: string) {
      const err = Object.assign(new Error(msg), { code })
      errors.push(err)
      return err
    },
  }
}


describe('GET-only guard', () => {

  const prior = process.env[ENV]
  afterEach(() => {
    if (undefined === prior) delete process.env[ENV]
    else process.env[ENV] = prior
  })


  test('every SDK target is listed', () => {
    assert.deepEqual(Object.keys(GUARDED).sort(), sdkTargets())
  })


  for (const [target, files] of Object.entries(GUARDED)) {
    test(target + ': the default transport refuses a non-GET, and a test sends one', () => {
      const src = Fs.readFileSync(Path.join(TM, files.fetcher), 'utf8')
      assert.ok(src.includes(ENV), target + ': ' + files.fetcher + ' never reads ' + ENV)
      assert.ok(src.includes(CODE), target + ': ' + files.fetcher + ' never raises ' + CODE)
      assert.ok(src.includes('[GET-ONLY GUARD] blocked'), target + ': ' + files.fetcher)

      const tsrc = Fs.readFileSync(Path.join(TM, files.test), 'utf8')
      for (const mark of [CODE, '127.0.0.1:9', 'GUARDKEY01']) {
        assert.ok(tsrc.includes(mark), target + ': ' + files.test + ' lacks ' + mark)
      }
    })
  }


  test('js: the platform fetch is refused a POST unsent, and the path alone is named', async () => {
    let sent = 0
    const platform = globalThis.fetch
    const counting = async (...args: any[]) => { sent++; return platform.apply(globalThis, args as any) }
    globalThis.fetch = counting as any
    try {
      const ctx = liveCtx(counting)
      process.env[ENV] = 'TRUE'
      const refused = await fetcher(ctx, 'http://u:p@127.0.0.1:9/planet/p1?apikey=GUARDKEY01#f',
        { method: 'post', headers: {} })
      assert.equal(refused.code, CODE)
      assert.equal(refused.message, '[GET-ONLY GUARD] blocked POST /planet/p1')
      assert.equal(sent, 0)

      const bare = await fetcher(ctx, 'http://127.0.0.1:9?k=GUARDKEY01', { method: 'DELETE' })
      assert.equal(bare.message, '[GET-ONLY GUARD] blocked DELETE /')

      await assert.rejects(fetcher(ctx, 'http://127.0.0.1:9/planet', { method: 'GET', headers: {} }))
      assert.equal(sent, 1)
    }
    finally {
      globalThis.fetch = platform
    }
  })


  test('js: the flag is read on each call, and a supplied fetch is the caller\'s', async () => {
    const calls: string[] = []
    const mock = async (_url: string, init: any) => { calls.push(init.method); return { status: 200 } }
    const ctx = liveCtx(mock)
    process.env[ENV] = 'TRUE'
    assert.equal((await fetcher(ctx, 'http://h/a', { method: 'POST' })).status, 200)

    const platform = liveCtx(globalThis.fetch)
    assert.equal((await fetcher(platform, 'http://h/a', { method: 'PUT' })).code, CODE)
    process.env[ENV] = 'FALSE'
    await assert.rejects(fetcher(platform, 'http://127.0.0.1:9/a', { method: 'PUT', headers: {} }))
    assert.deepEqual(calls, ['POST'])
  })


  test('js: the live transport refuses a write unsent, and the runner reports it blocked', async () => {
    process.env[ENV] = 'TRUE'
    const transport = createLiveTransport()
    const report = await runLiveSteps([
      { id: 'planet.create.0', run: async (context: any) => {
        transport.enter(context)
        await transport.fetch('http://127.0.0.1:9/planet?apikey=GUARDKEY01', { method: 'POST' })
      } },
    ])
    assert.equal(transport.requests.length, 0)
    assert.deepEqual(report.results.map((r: any) => [r.state, r.attempted, r.reason]),
      [['blocked', false, 'Refused by the GET-only guard']])
    assert.ok(!JSON.stringify(report).includes('GUARDKEY01'))
  })

})
