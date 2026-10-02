import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import Fs from 'node:fs'
import Path from 'node:path'
import Os from 'node:os'
import Http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { memfs } from 'memfs'
import { SdkGen } from '../dist/sdkgen'
import {
  makeModel, makeRoot, layeredFs, makeLog, STAGE, SCAFFOLD, CREATELESS_ENTITY,
} from './generateharness'

const PKG = Path.resolve(__dirname, '..')

const DEFAULT_AGENT = 'Mozilla/5.0 (compatible; DemoSDK/1.0)'

const CHALLENGE = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>' +
  'x'.repeat(300) + '</body></html>'

function actionEntity(name: string,
  routes: { action?: string, city?: string, path: string, method?: string, bare?: boolean }[]): string {
  const Name = name[0].toUpperCase() + name.slice(1)
  const points = routes.map(route => `{
      g: { query: [` + (route.bare ? '' : ` { k: "query", n: "city", or: "city", r: true,
        t: "\`$STRING\`"` + (route.city ? `, ex: "${route.city}"` : '') + ` }`) + ` ] }
      m: "${route.method || 'GET'}", o: "/${name}/${route.path}",
      s: [{ lit: "${name}" }, { lit: "${route.path}" }]
      ` + (null == route.action ? '' : `q: { "$action": "${route.action}" }`) + `
      t: { req: "\`reqdata\`", res: "\`body\`" }
    }`).join('\n')
  return `
main: kit: entity: ${name}: {
  alias: field: {}
  name: "${name}"
  field: { temperature: { name: "temperature", kind: "field", type: "\`$NUMBER\`" } }
  fields: { "temperature": { h: 'Temperature', n: "temperature", r: false, t: "\`$NUMBER\`" } }
  op: { load: { name: "load", points: [ ${points} ] } }
}
main: kit: flow: Basic${Name}Flow: {
  entity: "${name}", kind: "basic", name: "Basic${Name}Flow"
  step: [ { o: "load", i: { ref: "${name}_ref01", srcdatavar: "${name}_ref01_data", suffix: "_dt0" } } ]
}
`
}

// An action-only load reachable through one action, one with no usable
// action, and one whose only usable route is an action beside a plain route.
const EXTRA_ENTITIES = CREATELESS_ENTITY +
  actionEntity('v2018', [{ action: 'history', path: 'history' }, { action: 'current', path: 'current', city: 'bern' }]) +
  actionEntity('v2019', [{ action: 'history', path: 'history' }, { action: 'current', path: 'current' }]) +
  actionEntity('v2020', [{ path: 'weather' }, { action: 'reset', path: 'reset', method: 'POST', bare: true }])

function skipped(output: string): number {
  const found = output.match(/(?:^# skipped|\u2139 skipped) (\d+)/m)
  return null == found ? 0 : Number(found[1])
}

function child(args: string[], cwd: string): Promise<{ code: number | null, output: string }> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env, DEMO_TEST_LIVE: 'TRUE', DEMO_APIKEY: 'fake-live-test-key' }
    delete env.NODE_TEST_CONTEXT
    for (const key of Object.keys(env)) {
      if (key.startsWith('DEMO_TEST_') && key.endsWith('_ENTID')) delete env[key as keyof typeof env]
    }
    const proc = spawn(process.execPath, args, { cwd, env, timeout: 45000 })
    let output = ''
    proc.stdout.on('data', data => { output += data })
    proc.stderr.on('data', data => { output += data })
    proc.on('error', reject)
    proc.on('close', code => resolve({ code, output }))
  })
}

describe('generated live tests continue after failures', () => {
  let tmp = ''
  let server: Http.Server
  let port: number
  let failure = ''
  const calls: string[] = []
  const queries: string[] = []
  const agents: string[] = []
  const records = new Map<string, any>()
  const roots: Record<string, string> = {}

  before(async () => {
    tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-live-'))
    server = Http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const key = req.method + ' ' + url.pathname
      calls.push(key)
      queries.push(key + url.search)
      agents.push(String(req.headers['user-agent']))
      let body = ''
      for await (const chunk of req) body += chunk
      const send = (data: any, status = 200) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(data))
      }
      if (failure === key) return send({ error: 'failure-fixture' }, 500)
      const html = (status: number) => {
        res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' })
        res.end(CHALLENGE)
      }
      if (failure === 'ua' && !String(req.headers['user-agent']).startsWith('Mozilla/')) return html(403)
      if (failure === 'html' && url.pathname === '/history') return html(200)
      if (failure === 'empty' && req.method === 'GET' &&
        ['/planet', '/history', '/metric'].includes(url.pathname)) return send([])
      if (url.pathname === '/metric') return send([{ id: 'metric01', count: 3 }])
      if (url.pathname.startsWith('/metric/')) return send({ id: url.pathname.split('/').pop(), count: 3 })
      if (key === 'GET /v2018/current' && url.searchParams.get('city') === 'bern') {
        return send({ temperature: 12 })
      }
      if (/^\/v20(18|19|20)\//.test(url.pathname)) return send({ error: 'unexpected route' }, 404)
      if (failure === 'invalid-json' && url.pathname === '/history') {
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end('not json')
      }
      if (failure === 'invalid-list' && url.pathname === '/history') return send({ wrong: true })
      if (failure === 'disconnect') return req.socket.destroy()
      if (key === 'POST /planet') {
        const data = { ...JSON.parse(body || '{}'), id: 'created01' }
        records.set(data.id, data)
        return send(data)
      }
      if (key === 'GET /planet') return send([...records.values()])
      if (url.pathname.startsWith('/planet/')) {
        const id = url.pathname.split('/').pop()!
        if (req.method === 'PUT' || req.method === 'PATCH') {
          const data = { ...records.get(id), ...JSON.parse(body || '{}'), id }
          records.set(id, data)
          return send(data)
        }
        if (req.method === 'DELETE') {
          records.delete(id)
          return send({ id })
        }
        return send(records.get(id) || { id, title: 'existing' })
      }
      if (url.pathname === '/ambient') return send({ temperature: 12 })
      return send([{ id: 'existing01', title: 'existing' }])
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as any).port

    for (const name of ['ts', 'js', 'ts-lenient', 'js-lenient']) {
      const target = name.replace('-lenient', '')
      const model = makeModel([target], undefined,
        `main: kit: info: servers: [{ url: 'http://127.0.0.1:${port}' }]\n` + EXTRA_ENTITIES +
        (name === target ? '' : '\nmain: kit: test: live: strict: false\n'), ['test'])
      delete model.main.kit.entity.planet.op.load.points[0].g.params[0].ex
      // The first route needs an unavailable parent; the singleton route
      // remains usable and must still be exercised without ENTID.
      const ambient = model.main.kit.entity.ambient.op.load.points
      ambient.unshift({ ...ambient[0],
        o: '/account/{account_id}/ambient',
        s: [{ lit: 'account' }, { var: 'account_id' }, { lit: 'ambient' }],
        q: { exist: ['account_id'] },
        g: { params: [{ n: 'account_id', or: 'account_id', k: 'param', r: true, t: '`$STRING`' }] },
      })
      const { fs, vol } = memfs({})
      const generator = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
      const cwd = process.cwd()
      try {
        process.chdir(SCAFFOLD)
        await generator.generate({ model, root: makeRoot() })
      }
      finally { process.chdir(cwd) }
      const root = roots[name] = Path.join(tmp, name)
      for (const [file, content] of Object.entries(vol.toJSON())) {
        const rel = Path.relative(STAGE, file).split(Path.sep).join('/')
        if (!rel.startsWith(target + '/') || content == null) continue
        const dest = Path.join(root, rel.slice(target.length + 1))
        Fs.mkdirSync(Path.dirname(dest), { recursive: true })
        Fs.writeFileSync(dest, content)
      }
      Fs.symlinkSync(Path.join(PKG, 'node_modules'), Path.join(root, 'node_modules'), 'dir')
      for (const entity of Object.values(model.main.kit.entity) as any[]) {
        const dir = Path.join(tmp, '.sdk/test/entity', entity.name)
        Fs.mkdirSync(dir, { recursive: true })
        Fs.writeFileSync(Path.join(dir, entity.Name + 'TestData.json'), JSON.stringify({
          existing: { [entity.name]: { EXISTING01: { id: 'EXISTING01', title: 'existing' } } },
          new: { [entity.name]: { [entity.name + '_ref01']: { title: 'live-test', radius: 2 } } },
        }))
      }
      Fs.writeFileSync(Path.join(root, 'test/sdk-test-control.json'), JSON.stringify({
        version: 1, test: { live: { delayMs: 0 } },
      }))
      if (target === 'ts') {
        for (const tree of ['src', 'test']) {
          const compiled = spawnSync(process.execPath,
            [Path.join(PKG, 'node_modules/typescript/bin/tsc'), '--build', tree],
            { cwd: root, encoding: 'utf8', timeout: 30000 })
          assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr)
        }
      }
    }
  })

  after(async () => {
    if (server) {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
    if (tmp) Fs.rmSync(tmp, { recursive: true, force: true })
  })

  async function run(target: string, mode: string, direct = false) {
    return runTests(target, mode, direct
      ? ['planet/PlanetDirect', 'history/HistoryDirect']
      : ['planet/PlanetEntity', 'ambient/AmbientEntity', 'history/HistoryEntity'], direct)
  }

  async function runTests(name: string, mode: string, tests: string[], seed = false) {
    failure = mode
    records.clear()
    calls.length = 0
    queries.length = 0
    agents.length = 0
    if (seed) records.set('existing01', { id: 'existing01', title: 'existing' })
    const tree = name.startsWith('ts') ? 'dist-test' : 'test'
    const files = tests.map(test => `${tree}/entity/${test}.test.js`)
    return child(['--test', '--test-concurrency=1', ...files], roots[name])
  }

  for (const target of ['ts', 'js']) {
    test(target + ': CRUD, singleton and list run without ENTID', async () => {
      const result = await run(target, '')
      assert.equal(result.code, 0, result.output)
      for (const request of ['POST /planet', 'GET /planet', 'PUT /planet/created01', 'GET /planet/created01', 'DELETE /planet/created01', 'GET /ambient', 'GET /history']) {
        assert(calls.includes(request), request + '\n' + result.output)
      }
      assert.equal(records.size, 0)
    })

    test(target + ': create failure permits independent reads and blocks dependent writes', async () => {
      const result = await run(target, 'POST /planet')
      assert.notEqual(result.code, 0, result.output)
      for (const request of ['GET /planet', 'GET /ambient', 'GET /history']) assert(calls.includes(request), result.output)
      assert(!calls.some(call => /^(PUT|PATCH|DELETE) /.test(call)), result.output)
      assert(result.output.includes('"state":"blocked"'), result.output)
    })

    test(target + ': update failure still runs load, cleanup, and other entities', async () => {
      const result = await run(target, 'PUT /planet/created01')
      assert.notEqual(result.code, 0, result.output)
      for (const request of ['GET /planet/created01', 'DELETE /planet/created01', 'GET /ambient', 'GET /history']) assert(calls.includes(request), result.output)
      assert.equal(records.size, 0)
    })

    test(target + ': cleanup failure is reported after other work', async () => {
      const result = await run(target, 'DELETE /planet/created01')
      assert.notEqual(result.code, 0, result.output)
      assert(calls.includes('GET /history'), result.output)
      assert.equal(records.size, 1)
    })

    test(target + ': network failure still attempts independent operations', async () => {
      const result = await run(target, 'disconnect')
      assert.notEqual(result.code, 0, result.output)
      for (const request of ['POST /planet', 'GET /planet', 'GET /ambient', 'GET /history']) assert(calls.includes(request), result.output)
    })
  }

  test('ts: direct list discovery succeeds against a real server', async () => {
    const result = await run('ts', '', true)
    assert.equal(result.code, 0, result.output)
    assert(calls.includes('GET /planet/existing01'), result.output)
  })

  for (const mode of ['GET /planet', 'GET /history', 'invalid-json', 'invalid-list']) {
    test('ts: direct request failure is not a pass: ' + mode, async () => {
      const result = await run('ts', mode, true)
      assert.notEqual(result.code, 0, result.output)
      assert(calls.includes('GET /history'), result.output)
    })
  }

  for (const target of ['ts', 'js']) {
    test(target + ': an action-only operation is attempted through its action', async () => {
      const result = await runTests(target, '', ['v2018/V2018Entity'])
      assert.equal(result.code, 0, result.output)
      assert(queries.includes('GET /v2018/current?city=bern'), queries.join('\n') + '\n' + result.output)
      assert(result.output.includes('"state":"passed"'), result.output)
    })

    test(target + ': an operation with no usable route names each action it tried', async () => {
      const result = await runTests(target, '', ['v2019/V2019Entity'])
      assert.notEqual(result.code, 0, result.output)
      assert.deepEqual(calls, [], result.output)
      assert(result.output.includes('No usable route: $action history needs city; ' +
        '$action current needs city'), result.output)
    })

    test(target + ': an action is not taken in place of an unusable plain route', async () => {
      const result = await runTests(target, '', ['v2020/V2020Entity'])
      assert.notEqual(result.code, 0, result.output)
      assert.deepEqual(calls, [], result.output)
      assert(result.output.includes('No usable route: GET /v2020/weather needs city'), result.output)
    })

    test(target + ': an account with no record to read skips, in strict mode too', async () => {
      const result = await runTests(target, 'empty', ['metric/MetricEntity', 'history/HistoryEntity',
        'metric/MetricDirect', 'planet/PlanetDirect'])
      assert.equal(result.code, 0, result.output)
      assert(calls.includes('GET /metric') && calls.includes('GET /planet'), result.output)
      assert(!calls.some(call => call.startsWith('GET /metric/') || call.startsWith('GET /planet/')),
        result.output)
      assert(result.output.includes('The account has no metric record to load'), result.output)
      assert(result.output.includes('The account has no planet record to load'), result.output)
      assert.equal(skipped(result.output), 3, result.output)
    })

    test(target + ': a lenient run skips a failed live test with the reason', async () => {
      const result = await runTests(target + '-lenient', 'GET /planet',
        ['planet/PlanetEntity', 'history/HistoryEntity', 'planet/PlanetDirect'], true)
      assert.equal(result.code, 0, result.output)
      for (const request of ['POST /planet', 'GET /planet', 'GET /history']) {
        assert(calls.includes(request), request + '\n' + result.output)
      }
      assert(result.output.includes('main.kit.test.live.strict is false'), result.output)
      assert(/planet\.list\.\d+ failed \(Request failed: request_status\)/.test(result.output), result.output)
      assert(result.output.includes('Live list failed'), result.output)
      assert(result.output.includes('Live list discovery failed'), result.output)
      assert.equal(skipped(result.output), 3, result.output)

      const strict = await runTests(target, 'GET /planet', ['planet/PlanetDirect'], true)
      assert.notEqual(strict.code, 0, strict.output)
      assert(strict.output.includes('Live list discovery failed'), strict.output)
    })

    test(target + ': requests carry a browser-shaped user agent by default', async () => {
      const result = await runTests(target, 'ua',
        ['planet/PlanetEntity', 'ambient/AmbientEntity', 'history/HistoryEntity'])
      assert.equal(result.code, 0, result.output)
      assert(agents.length >= 6, agents.join('\n'))
      assert.deepEqual([...new Set(agents)], [DEFAULT_AGENT], result.output)
    })

    test(target + ': a non-JSON response names its status, type, agent and body', async () => {
      const direct = await runTests(target, 'html', ['history/HistoryDirect'])
      assert.notEqual(direct.code, 0, direct.output)
      for (const part of ['expected JSON, got text/html', 'HTTP 200', 'content-type text/html',
        'user-agent ' + DEFAULT_AGENT, 'body: <!DOCTYPE html><html><head><title>Just a moment...']) {
        assert(direct.output.includes(part), part + '\n' + direct.output)
      }
      assert(!direct.output.includes('x'.repeat(200)), 'the body preview is not bounded')

      const flow = await runTests(target, 'html', ['history/HistoryEntity'])
      assert.notEqual(flow.code, 0, flow.output)
      assert(flow.output.includes('"reason":"Request failed: response_content_type"'), flow.output)
      assert(flow.output.includes('"agent":"' + DEFAULT_AGENT + '","status":200,"type":"text/html"'),
        flow.output)
    })
  }

  test('ts: a configured user agent replaces the default', async () => {
    const control = Path.join(roots.ts, 'test/sdk-test-control.json')
    const saved = Fs.readFileSync(control, 'utf8')
    Fs.writeFileSync(control, JSON.stringify({ version: 1, test: { live: { delayMs: 0 },
      client: { options: { headers: { 'user-agent': 'Mozilla/5.0 configured' } } } } }))
    try {
      const result = await runTests('ts', 'ua', ['history/HistoryEntity', 'history/HistoryDirect'])
      assert.equal(result.code, 0, result.output)
      assert.deepEqual([...new Set(agents)], ['Mozilla/5.0 configured'], result.output)
    }
    finally {
      Fs.writeFileSync(control, saved)
    }
  })
})
