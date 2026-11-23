import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'

import Fs from 'node:fs'
import Http from 'node:http'
import Path from 'node:path'

import { transform } from 'sucrase'

import { CLEAN_DEFAULTS, sandboxLoad } from './featureharness'


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
// platform fetch follows with every header but three, so ts and js loop too.
type Transport = {
  fetcher: string, test: string, follows: 'client' | 'sdk', marks: RegExp[], platform?: boolean,
}

const TRANSPORTS: Record<string, Transport | { none: string, fetcher: string }> = {
  ts: { fetcher: 'ts/src/utility/FetcherUtility.ts', test: 'ts/test/utility/PrimaryUtility.test.ts',
    follows: 'sdk', marks: [/await followRedirects\(ctx, fetch, fullurl, fetchdef\)/, /cleanSecret/] },
  js: { fetcher: 'js/src/utility/FetcherUtility.js', test: 'js/test/utility/PrimaryUtility.test.js',
    follows: 'sdk', marks: [/await followRedirects\(ctx, fetch, fullurl, fetchdef\)/, /cleanSecret/] },
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
    follows: 'sdk', marks: [/AllowAutoRedirect = false/, /DefaultHttpFetch\(fullurl, fetchdef, ctx\)/,
      /RedirectMax <= hops/] },
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


// A ts template, with its type-only import stubbed and its siblings loaded alike.
function loadTemplate(rel: string): any {
  const file = Path.join(TM, rel)
  const js = transform(read(rel), { transforms: ['typescript', 'imports'], filePath: file }).code
  const mod: any = { exports: {} }
  new Function('exports', 'require', 'module', js)(mod.exports,
    (p: string) => '../types' === p ? {} :
      p.startsWith('./') ? loadTemplate(Path.posix.join(Path.posix.dirname(rel), p + '.ts')) :
        require(p), mod)
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
        assert.ok(/redirect_?max/i.test(src), target + ': no hop limit')
        assert.ok(/authorization/i.test(src) && /cookie/i.test(src),
          target + ': another origin is sent the credentials')
        assert.ok(/clean_?secret/i.test(src),
          target + ': another origin is sent a credential under another name')
        assert.ok(/getonly_?refusal|getOnlyRefusal/i.test(src.slice(src.search(/REDIRECT|[rR]edirectStatus/))),
          target + ': a hop does not pass the GET-only guard')
      }

      const tsrc = read(spec.test)
      for (const mark of ['/redirect/r1', 'done', '308', 'manual']) {
        assert.ok(tsrc.includes(mark), target + ': ' + spec.test + ' lacks ' + mark)
      }
      // The ts and js transports are driven across origins below.
      if ('sdk' === spec.follows && !['ts', 'js'].includes(target)) {
        for (const mark of ['x-api-key', 'x-acme-auth', 'x-tenant']) {
          assert.ok(tsrc.includes(mark), target + ': ' + spec.test + ' sends no ' + mark +
            ' to another origin')
        }
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


  // The API's origin redirects; the other origin records what reaches it.
  // 127.0.0.1 and localhost differ as hosts, so as origins, on one machine.
  describe('the ts and js transports: a credential stays on its origin', () => {
    const SECRET = 'REDIRECT-SECRET-q7w3e9r1'
    let api: Http.Server
    let other: Http.Server
    let apibase = ''
    let otherbase = ''
    const arrived: { where: string, method: string, url: string, headers: any, body: string }[] = []

    function record(where: string) {
      return (req: Http.IncomingMessage, res: Http.ServerResponse) => {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          const url = String(req.url)
          arrived.push({ where, method: String(req.method), url, headers: req.headers, body })
          const out = '/out' === url ? [302, otherbase + '/landed'] :
            '/out307' === url ? [307, otherbase + '/landed'] :
              '/in307' === url ? [307, '/landed'] :
                '/in303' === url ? [303, '/landed'] :
                  '/round' === url ? [302, '/round'] :
                    '/in' === url ? [302, '/landed'] : null
          res.writeHead(out ? out[0] as number : 200, {
            ...(out ? { location: out[1] as string } : {}),
            'content-type': 'application/json', connection: 'close',
          })
          res.end(out ? '' : '{"id":"r1"}')
        })
      }
    }

    before(async () => {
      api = Http.createServer(record('api'))
      other = Http.createServer(record('other'))
      await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', () => resolve()))
      await new Promise<void>((resolve) => other.listen(0, '127.0.0.1', () => resolve()))
      apibase = 'http://127.0.0.1:' + (api.address() as any).port
      otherbase = 'http://localhost:' + (other.address() as any).port
    })

    after(() => {
      api.close()
      other.close()
    })

    // The real clean utility, with the secret registered as makeOptions would.
    function credentialCtx(lang: string, over?: any) {
      const cleanmod = sandboxLoad(Path.join(TM, lang, 'src', 'utility', 'CleanUtility.' + lang), {
        '../types': {},
        '../Schema': { OPTSPEC: { clean: CLEAN_DEFAULTS } },
        './MediaUtility': sandboxLoad(Path.join(TM, lang, 'src', 'utility', 'MediaUtility.' + lang), {}),
      })
      const ctx: any = liveCtx()
      ctx.options = { __derived__: { clean: cleanmod.makeCleanConfig({ ...CLEAN_DEFAULTS, ...(over || {}) }) } }
      Object.assign(ctx.utility, cleanmod)
      cleanmod.cleanAdd(ctx, SECRET)
      return ctx
    }

    function headers() {
      return {
        authorization: 'Bearer ' + SECRET,
        cookie: 'sid=' + SECRET,
        'x-api-key': SECRET,
        'private-token': 'pt-12345',
        // Not a sensitive name: a credential by the value it holds.
        'x-acme-auth': 'v1 ' + SECRET,
        'x-tenant': 'acme',
      }
    }

    const CREDENTIALS = ['authorization', 'cookie', 'x-api-key', 'private-token', 'x-acme-auth']

    const FETCHERS: Record<string, () => any> = {
      ts: () => loadTemplate('ts/src/utility/FetcherUtility.ts').fetcher,
      js: () => require(Path.join(TM, 'js', 'src', 'utility', 'FetcherUtility.js')).fetcher,
    }

    for (const [target, load] of Object.entries(FETCHERS)) {
      for (const cleanactive of [true, false]) {
        test(target + ': a hop to another origin carries no credential, under any name' +
          (cleanactive ? '' : ', with clean switched off'), async () => {
          arrived.length = 0
          const res = await load()(credentialCtx(target, { active: cleanactive }), apibase + '/out',
            { method: 'GET', headers: headers() })
          assert.equal(res.status, 200)
          assert.deepEqual(arrived.map((a) => a.where + ' ' + a.url), ['api /out', 'other /landed'])
          for (const name of CREDENTIALS) {
            assert.ok(null != arrived[0].headers[name], 'the API itself was not sent ' + name)
            assert.equal(arrived[1].headers[name], undefined, 'another origin was sent ' + name)
          }
          assert.equal(arrived[1].headers['x-tenant'], 'acme')
          assert.ok(!JSON.stringify(arrived[1].headers).includes(SECRET))
        })
      }

      test(target + ': a hop on the same origin keeps them', async () => {
        arrived.length = 0
        const res = await load()(credentialCtx(target), apibase + '/in', { method: 'GET', headers: headers() })
        assert.equal(res.status, 200)
        assert.deepEqual(arrived.map((a) => a.where + ' ' + a.url), ['api /in', 'api /landed'])
        for (const name of [...CREDENTIALS, 'x-tenant']) {
          assert.ok(null != arrived[1].headers[name], 'the same origin lost ' + name)
        }
      })

      test(target + ': a body is not sent on to another origin', async () => {
        arrived.length = 0
        const res = await load()(credentialCtx(target), apibase + '/out307',
          { method: 'PUT', headers: { ...headers(), 'content-type': 'audio/wav' }, body: 'BODY-' + SECRET })
        assert.equal(res.status, 307)
        assert.deepEqual(arrived.map((a) => a.where + ' ' + a.url), ['api /out307'])
      })

      test(target + ': on its own origin a 307 keeps the method and the body', async () => {
        arrived.length = 0
        const res = await load()(credentialCtx(target), apibase + '/in307',
          { method: 'PUT', headers: { ...headers(), 'content-type': 'audio/wav' }, body: 'BODY-1' })
        assert.equal(res.status, 200)
        assert.deepEqual(arrived.map((a) => a.method + ' ' + a.url + ' ' + a.body),
          ['PUT /in307 BODY-1', 'PUT /landed BODY-1'])
        assert.equal(arrived[1].headers['content-type'], 'audio/wav')
      })

      test(target + ': a 303, and a 302 answering a POST, become a GET without the body', async () => {
        for (const [method, path] of [['PUT', '/in303'], ['POST', '/in']]) {
          arrived.length = 0
          const res = await load()(credentialCtx(target), apibase + path,
            { method, headers: { ...headers(), 'content-type': 'application/json' }, body: '{"a":1}' })
          assert.equal(res.status, 200)
          assert.deepEqual(arrived.map((a) => a.method + ' ' + a.url + ' ' + a.body),
            [method + ' ' + path + ' {"a":1}', 'GET /landed '])
          assert.equal(arrived[1].headers['content-type'], undefined)
          assert.ok(null != arrived[1].headers['x-api-key'])
        }
      })

      test(target + ': past the hop limit the last 3xx is the answer', async () => {
        arrived.length = 0
        const res = await load()(credentialCtx(target), apibase + '/round', { method: 'GET', headers: {} })
        assert.equal(res.status, 302)
        assert.equal(arrived.length, 6)
      })

      test(target + ': a transport the caller supplied is called once, as it was', async () => {
        const calls: string[] = []
        const ctx = credentialCtx(target)
        const supplied = async (url: string) => {
          calls.push(url)
          return { status: 302, headers: { get: () => '/elsewhere' } }
        }
        ctx.client.options = () => ({ system: { fetch: supplied } })
        const res = await load()(ctx, apibase + '/in', { method: 'GET', headers: {} })
        assert.equal(res.status, 302)
        assert.deepEqual(calls, [apibase + '/in'])
      })
    }
  })
})
