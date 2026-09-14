import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import Fs from 'node:fs'
import Path from 'node:path'
import Os from 'node:os'
import Http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { memfs } from 'memfs'
import { SdkGen } from '../dist/sdkgen'
import { makeModel, makeRoot, layeredFs, makeLog, STAGE, SCAFFOLD } from './generateharness'

const PKG = Path.resolve(__dirname, '..')

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
  const records = new Map<string, any>()
  const roots: Record<string, string> = {}

  before(async () => {
    tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-live-'))
    server = Http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const key = req.method + ' ' + url.pathname
      calls.push(key)
      let body = ''
      for await (const chunk of req) body += chunk
      const send = (data: any, status = 200) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(data))
      }
      if (failure === key) return send({ error: 'failure-fixture' }, 500)
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

    for (const target of ['ts', 'js']) {
      const model = makeModel([target], undefined,
        `main: kit: info: servers: [{ url: 'http://127.0.0.1:${port}' }]`, ['test'])
      delete model.main.kit.entity.planet.op.load.points[0].args.params[0].example
      // The first route needs an unavailable parent; the singleton route
      // remains usable and must still be exercised without ENTID.
      const ambient = model.main.kit.entity.ambient.op.load.points
      ambient.unshift({ ...ambient[0],
        orig: '/account/{account_id}/ambient',
        segments: [{ lit: 'account' }, { var: 'account_id' }, { lit: 'ambient' }],
        select: { exist: ['account_id'] },
        args: { params: [{ name: 'account_id', orig: 'account_id', kind: 'param', reqd: true, type: '`$STRING`' }] },
      })
      const { fs, vol } = memfs({})
      const generator = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
      const cwd = process.cwd()
      try {
        process.chdir(SCAFFOLD)
        await generator.generate({ model, root: makeRoot() })
      }
      finally { process.chdir(cwd) }
      const root = roots[target] = Path.join(tmp, target)
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
    failure = mode
    records.clear()
    calls.length = 0
    if (direct) records.set('existing01', { id: 'existing01', title: 'existing' })
    const tree = target === 'ts' ? 'dist-test' : 'test'
    const files = direct
      ? ['planet/Planet', 'history/History'].map(name => `${tree}/entity/${name}Direct.test.js`)
      : ['planet/Planet', 'ambient/Ambient', 'history/History'].map(name => `${tree}/entity/${name}Entity.test.js`)
    return child(['--test', '--test-concurrency=1', ...files], roots[target])
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
})
