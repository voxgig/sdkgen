import { test } from 'node:test'
import assert from 'node:assert/strict'
import Http from 'node:http'
const {
  runLiveSteps, assertLiveReport, settleLiveReport, LiveBlocked, LiveEmpty, createLiveTransport,
} = require('../project/.sdk/tm/js/test/live-runner')

function testContext() {
  const skips: string[] = []
  return { skips, skip(message?: string) { skips.push(String(message)) } }
}

test('live steps publish cleanup data even when a later assertion fails', async () => {
  const order: string[] = []
  const report = await runLiveSteps([
    { id: 'create', run: async (ctx: any) => {
      order.push('create'); ctx.attempted(); ctx.publish({ id: 'new01', key: 'SECRET_SENTINEL' })
      throw new Error('assertion failed SECRET_SENTINEL')
    } },
    { id: 'independent', run: async (ctx: any) => { order.push('read'); ctx.attempted() } },
    { id: 'cleanup', cleanup: true, needs: ['create'], run: async (ctx: any) => {
      assert.equal(ctx.values.get('create').id, 'new01'); order.push('cleanup'); ctx.attempted()
    } },
  ])
  assert.deepEqual(order, ['create', 'read', 'cleanup'])
  assert.equal(report.failed, 1)
  assert.equal(report.passed, 2)
  assert(!JSON.stringify(report).includes('SECRET_SENTINEL'))
  assert.throws(() => assertLiveReport(report), /Live coverage incomplete/)
})

test('dependencies can precede their producer without halting independent work', async () => {
  const order: string[] = []
  const report = await runLiveSteps([
    { id: 'dependent', needs: ['producer'], run: async (ctx: any) => {
      assert.equal(ctx.values.get('producer'), 42); order.push('dependent'); ctx.attempted()
    } },
    { id: 'producer', run: async (ctx: any) => { order.push('producer'); ctx.attempted(); ctx.publish(42) } },
    { id: 'other', run: async (ctx: any) => { order.push('other'); ctx.attempted() } },
  ])
  assert.deepEqual(order, ['producer', 'other', 'dependent'])
  assertLiveReport(report)
})

test('cycles and missing dependencies are blocked after independent steps run', async () => {
  const report = await runLiveSteps([
    { id: 'a', needs: ['b'], run: async () => assert.fail('cycle ran') },
    { id: 'b', needs: ['a'], run: async () => assert.fail('cycle ran') },
    { id: 'c', needs: ['absent'], run: async () => assert.fail('missing dependency ran') },
    { id: 'independent', run: async (ctx: any) => { ctx.attempted() } },
  ])
  assert.equal(report.passed, 1)
  assert.equal(report.blocked, 3)
  assert.throws(() => assertLiveReport(report))
})

test('an empty, excluded, or unattempted plan cannot claim live success', async () => {
  const empty = await runLiveSteps([])
  const excluded = await runLiveSteps([{ id: 'excluded', excluded: 'disabled', run: async () => assert.fail('excluded ran') }])
  const unattempted = await runLiveSteps([{ id: 'unattempted', run: async () => {} }])
  assert.equal(excluded.excluded, 1)
  assert.equal(unattempted.blocked, 1)
  for (const report of [empty, excluded, unattempted]) assert.throws(() => assertLiveReport(report))
})

test('invalid published output blocks dependent work but remains available for cleanup', async () => {
  const report = await runLiveSteps([
    { id: 'produce', run: async (ctx: any) => { ctx.attempted(); ctx.publish({id:'owned'}); throw Error('invalid vector') } },
    { id: 'dependent', needs: ['produce'], run: async () => assert.fail('invalid output consumed') },
    { id: 'cleanup', cleanup:true, needs:['produce'], run: async (ctx: any) => { assert.equal(ctx.values.get('produce').id,'owned');ctx.attempted() } },
    { id: 'independent', run: async (ctx: any) => ctx.attempted() },
  ])
  assert.equal(report.failed,1);assert.equal(report.blocked,1);assert.equal(report.passed,2)
})


test('a strict live report fails and a lenient one skips with the reason', async () => {
  const report = await runLiveSteps([
    { id: 'planet.create.0', run: async (ctx: any) => {
      ctx.attempted()
      throw Object.assign(new Error('token SECRET_SENTINEL'), { sdk: 'Demo', code: 'request_status' })
    } },
    { id: 'v2019.load.1', run: async () => {
      throw new LiveBlocked('No usable route: $action history needs city')
    } },
  ])

  const strict = testContext()
  assert.throws(() => settleLiveReport(report, { strict: true, t: strict }), /Live coverage incomplete/)
  assert.deepEqual(strict.skips, [])

  // Without a test to skip, a lenient run still cannot pass silently.
  assert.throws(() => settleLiveReport(report, { strict: false }), /Live coverage incomplete/)

  const lenient = testContext()
  settleLiveReport(report, { strict: false, t: lenient })
  assert.equal(lenient.skips.length, 1)
  assert.match(lenient.skips[0], /main\.kit\.test\.live\.strict is false/)
  assert.match(lenient.skips[0], /planet\.create\.0 failed \(Request failed: request_status\)/)
  assert.match(lenient.skips[0], /v2019\.load\.1 blocked \(No usable route: \$action history needs city\)/)
  assert(!lenient.skips[0].includes('SECRET_SENTINEL'))
})


test('an account with no record to read skips in either mode', async () => {
  const report = await runLiveSteps([
    { id: 'metric.list.0', run: async (ctx: any) => ctx.attempted() },
    { id: 'metric.load.1', run: async (ctx: any) => {
      ctx.attempted()
      throw new LiveEmpty('The account has no metric record to load')
    } },
  ])
  assert.deepEqual([report.passed, report.empty, report.failed, report.blocked], [1, 1, 0, 0])
  assert.equal(report.results[1].state, 'empty')

  for (const strict of [true, false]) {
    const t = testContext()
    settleLiveReport(report, { strict, t })
    assert.equal(t.skips.length, 1, 'strict: ' + strict)
    assert.match(t.skips[0], /metric\.load\.1 empty \(The account has no metric record to load\)/)
  }

  const complete = await runLiveSteps([{ id: 'one', run: async (ctx: any) => ctx.attempted() }])
  const t = testContext()
  settleLiveReport(complete, { strict: true, t })
  assert.deepEqual(t.skips, [])
})


test('a failure is reported by its error code or fixed message, never by a value', async () => {
  const report = await runLiveSteps([
    { id: 'sdk', run: async (ctx: any) => {
      ctx.attempted()
      throw Object.assign(new Error('expected JSON (body: SECRET_SENTINEL)'),
        { sdk: 'Demo', code: 'response_content_type' })
    } },
    { id: 'fixed', run: async (ctx: any) => {
      ctx.attempted()
      assert.equal('SECRET_SENTINEL', 'other', 'Response identity mismatch')
    } },
    { id: 'generated', run: async (ctx: any) => {
      ctx.attempted()
      assert.equal('SECRET_SENTINEL', 'other')
    } },
  ])
  const reason = (id: string) => report.results.find((result: any) => id === result.id).reason
  assert.equal(reason('sdk'), 'Request failed: response_content_type')
  assert.equal(reason('fixed'), 'Assertion failed: Response identity mismatch')
  assert.equal(reason('generated'), 'Request or assertion failed')
  assert(!JSON.stringify(report).includes('SECRET_SENTINEL'))
})


test('the live transport records the status, content type and user agent', async () => {
  const server = Http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<html>' + req.headers['user-agent'] + '</html>')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + (server.address() as any).port
  try {
    const transport = createLiveTransport()
    const report = await runLiveSteps([{ id: 'page', run: async (ctx: any) => {
      transport.enter(ctx)
      await (await transport.fetch(origin + '/page?token=SECRET_SENTINEL',
        { headers: { 'User-Agent': 'Mozilla/5.0 probe' } })).text()
      await (await transport.fetch(origin + '/plain')).text()
    } }])
    assert.deepEqual(report.results[0].requests, [
      { method: 'GET', path: origin + '/page', agent: 'Mozilla/5.0 probe', status: 200, type: 'text/html' },
      { method: 'GET', path: origin + '/plain', agent: 'transport default', status: 200, type: 'text/html' },
    ])
    assert(!JSON.stringify(report).includes('SECRET_SENTINEL'))
  }
  finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
