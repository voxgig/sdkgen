import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'

import Fs from 'node:fs'
import Http from 'node:http'
import Path from 'node:path'

import { transform } from 'sucrase'


// Every SDK target's own transport follows 301, 302, 303, 307 and 308 for a
// GET or HEAD, resolving a relative Location, up to its hop limit, unless the
// fetch definition says "manual". Each target's test runs it against a local
// server on its own toolchain; this says no target was left out, and runs the
// ts and js transports here.

const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')
const TM = Path.join(SDK, 'tm')

const CONSUMER_TARGETS = ['go-cli', 'go-mcp', 'py-data']

// `follows` names what follows a redirect: the HTTP client, or the SDK's own
// loop, for a client that follows none, or not as every target does. The
// platform fetch reads "manual" from the fetch definition itself.
type Transport = {
  fetcher: string, test: string, follows: 'client' | 'sdk', marks: RegExp[], platform?: boolean,
}

const TRANSPORTS: Record<string, Transport | { none: string, fetcher: string }> = {
  ts: { fetcher: 'ts/src/utility/FetcherUtility.ts', test: 'ts/test/utility/PrimaryUtility.test.ts',
    follows: 'client', marks: [/await fetch\(fullurl, fetchdef\)/], platform: true },
  js: { fetcher: 'js/src/utility/FetcherUtility.js', test: 'js/test/utility/PrimaryUtility.test.js',
    follows: 'client', marks: [/await fetch\(fullurl, fetchdef\)/], platform: true },
  go: { fetcher: 'go/utility/fetcher.go', test: 'go/test/primary_utility_test.go',
    follows: 'client', marks: [/CheckRedirect = followRedirect/, /maxRedirects = 5/, /ErrUseLastResponse/] },
  py: { fetcher: 'py/pkg/utility/fetcher.py', test: 'py/test/test_primary_utility.py',
    follows: 'client', marks: [/allow_redirects/, /max_redirects = 5/] },
  php: { fetcher: 'php/utility/Fetcher.php', test: 'php/test/PipelineTest.php',
    follows: 'sdk', marks: [/CURLOPT_FOLLOWLOCATION, false/, /'follow_location' => 0/] },
  rb: { fetcher: 'rb/utility/fetcher.rb', test: 'rb/test/primary_utility_test.rb',
    follows: 'sdk', marks: [/URI\.join/] },
  lua: { fetcher: 'lua/utility/fetcher.lua', test: 'lua/test/primary_utility_test.lua',
    follows: 'sdk', marks: [/redirect = false/, /url"\)\.absolute/] },
  perl: { fetcher: 'perl/utility/fetcher.pm', test: 'perl/t/primary_utility.t',
    follows: 'sdk', marks: [/max_redirect => 0/] },
  java: { fetcher: 'java/utility/Fetcher.java', test: 'java/test/PrimaryUtilityTest.java',
    follows: 'client', marks: [/Redirect\.NORMAL/, /Redirect\.NEVER/] },
  kotlin: { fetcher: 'kotlin/utility/Fetcher.kt', test: 'kotlin/test/PrimaryUtilityTest.kt',
    follows: 'client', marks: [/Redirect\.NORMAL/, /Redirect\.NEVER/] },
  scala: { fetcher: 'scala/utility/Fetcher.scala', test: 'scala/sdktest/SdkTestMain.scala',
    follows: 'client', marks: [/Redirect\.NORMAL/, /Redirect\.NEVER/] },
  csharp: { fetcher: 'csharp/utility/Fetcher.cs', test: 'csharp/test/PrimaryUtilityTest.cs',
    follows: 'client', marks: [/AllowAutoRedirect = allowRedirect/, /MaxAutomaticRedirections = 5/] },
  rust: { fetcher: 'rust/utility/fetcher.rs', test: 'rust/tests/primary_utility_test.rs',
    follows: 'client', marks: [/redirects\(0\)/] },
  c: { fetcher: 'c/utility/fetcher.c', test: 'c/tests/transport_test.c',
    follows: 'sdk', marks: [/http_fetch\(ctx, url, fetchdef, err\)/] },
  swift: { fetcher: 'swift/Sources/ProjectNameSDK/utility/Fetcher.swift',
    test: 'swift/Tests/ProjectNameSDKTests/PrimaryUtilityTest.swift',
    follows: 'sdk', marks: [/completionHandler\(nil\)/] },
  clojure: { fetcher: 'clojure/src/sdk/core.clj', test: 'clojure/test/sdk/test/pipeline.clj',
    follows: 'client', marks: [/Redirect\/NORMAL/, /Redirect\/NEVER/] },
  elixir: { fetcher: 'elixir/lib/projectname/utility.ex', test: 'elixir/test/pipeline_test.exs',
    follows: 'client', marks: [/autoredirect: false/] },
  cpp: { none: 'fetch_no_transport', fetcher: 'cpp/utility/pipeline.hpp' },
  zig: { none: 'live transport unavailable', fetcher: 'zig/core/utility.zig' },
  ocaml: { none: 'fetch_no_transport', fetcher: 'ocaml/sdk_runtime.ml' },
}


function sdkTargets(): string[] {
  return Fs.readdirSync(Path.join(SDK, 'model', 'target'))
    .filter((f) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
    .map((f) => f.replace(/\.aontu$/, ''))
    .filter((t) => !CONSUMER_TARGETS.includes(t))
    .sort()
}


function read(rel: string): string {
  return Fs.readFileSync(Path.join(TM, rel), 'utf8')
}


// A ts template, with its type-only import stubbed.
function loadTemplate(rel: string): any {
  const file = Path.join(TM, rel)
  const js = transform(read(rel), { transforms: ['typescript', 'imports'], filePath: file }).code
  const mod: any = { exports: {} }
  new Function('exports', 'require', 'module', js)(mod.exports,
    (p: string) => '../types' === p ? {} : require(p), mod)
  return mod.exports
}


const MOVED: Record<string, [number, string]> = {
  '/redirect/r1': [301, '/redirect/r1/'],
  '/redirect/r1/': [308, 'done'],
  '/loop': [302, '/loop'],
}


function liveCtx() {
  return {
    client: { _mode: 'live', options: () => ({ system: { fetch: globalThis.fetch } }) },
    utility: { struct: { getpath: (o: any, p: string) => p.split('.').reduce((a, k) => a?.[k], o) } },
    error: (code: string, msg: string) => Object.assign(new Error(msg), { code }),
  }
}


describe('redirects', () => {

  test('every SDK target is listed', () => {
    assert.deepEqual(Object.keys(TRANSPORTS).sort(), sdkTargets())
  })


  for (const [target, spec] of Object.entries(TRANSPORTS)) {
    if ('none' in spec) {
      test(target + ': ships no transport to follow a redirect', () => {
        assert.ok(read(spec.fetcher).includes(spec.none), target + ': ' + spec.fetcher)
      })
      continue
    }

    test(target + ': the default transport follows a redirect, and a test sends one', () => {
      const src = read(spec.fetcher)
      assert.ok(spec.platform || src.includes('manual'), target + ': ' + spec.fetcher + ' never reads "manual"')
      for (const mark of spec.marks) {
        assert.ok(mark.test(src), target + ': ' + spec.fetcher + ' lacks ' + mark)
      }
      if ('sdk' === spec.follows) {
        for (const code of ['301', '302', '303', '307', '308']) {
          assert.ok(src.includes(code), target + ': ' + spec.fetcher + ' never follows ' + code)
        }
        assert.ok(/REDIRECT_MAX|redirectMax|REDIRECT_MAX = 5/.test(src), target + ': no hop limit')
        assert.ok(/authorization/i.test(src) && /cookie/i.test(src),
          target + ': another origin is sent the credentials')
        assert.ok(/getonly_?refusal|getOnlyRefusal/i.test(src.slice(src.search(/REDIRECT|redirectStatus/))),
          target + ': a hop does not pass the GET-only guard')
      }

      const tsrc = read(spec.test)
      for (const mark of ['/redirect/r1', 'done', '308', 'manual']) {
        assert.ok(tsrc.includes(mark), target + ': ' + spec.test + ' lacks ' + mark)
      }
    })
  }


  describe('the ts and js transports, live', () => {
    let server: Http.Server
    let base = ''
    const seen: string[] = []

    before(async () => {
      server = Http.createServer((req, res) => {
        seen.push(String(req.url))
        const hop = MOVED[String(req.url)]
        const done = '/redirect/r1/done' === req.url
        res.writeHead(hop ? hop[0] : done ? 200 : 404,
          { ...(hop ? { location: hop[1] } : {}), 'content-type': 'application/json', connection: 'close' })
        res.end(done ? '{"id":"r1"}' : '')
      })
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
      base = 'http://127.0.0.1:' + (server.address() as any).port
    })

    after(() => {
      server.close()
    })

    const FETCHERS: Record<string, () => any> = {
      ts: () => loadTemplate('ts/src/utility/FetcherUtility.ts').fetcher,
      js: () => require(Path.join(TM, 'js', 'src', 'utility', 'FetcherUtility.js')).fetcher,
    }

    for (const [target, load] of Object.entries(FETCHERS)) {
      test(target + ': a relative Location is followed, hop by hop', async () => {
        seen.length = 0
        const res = await load()(liveCtx(), base + '/redirect/r1', { method: 'GET', headers: {} })
        assert.equal(res.status, 200)
        assert.deepEqual(await res.json(), { id: 'r1' })
        assert.deepEqual(seen, ['/redirect/r1', '/redirect/r1/', '/redirect/r1/done'])
      })

      test(target + ': a "manual" fetch definition is answered by the 3xx', async () => {
        seen.length = 0
        const res = await load()(liveCtx(), base + '/redirect/r1',
          { method: 'GET', headers: {}, redirect: 'manual' })
        assert.equal(res.status, 301)
        assert.equal(res.headers.get('location'), '/redirect/r1/')
        assert.deepEqual(seen, ['/redirect/r1'])
      })
    }
  })
})
