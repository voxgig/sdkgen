
// Behavioural tests for the enterprise feature templates, run offline
// against a simulated network via the feature harness. Each test loads the
// real shipped template source (see featureharness.ts) so a regression in
// project/.sdk/tm/ts/src/feature/** is caught here.

import { test, describe } from 'node:test'
import { strictEqual, ok, deepStrictEqual } from 'node:assert'

import { makeClient, makeClock, makeResponse, loadFeature } from './featureharness'


// A transport that records every request and replies from a scripted queue
// or a default. Lets tests assert on call count and captured fetchdefs.
function recordingServer(reply?: (n: number, fetchdef: any) => any) {
  const calls: any[] = []
  const server = (_ctx: any, url: string, fetchdef: any) => {
    calls.push({ url, fetchdef })
    if (reply) {
      return reply(calls.length, fetchdef)
    }
    return makeResponse(200, { ok: true, n: calls.length })
  }
  return { server, calls }
}


describe('feature:netsim', () => {

  test('injects fixed latency then delegates to the transport', async () => {
    const clock = makeClock()
    const h = makeClient({
      features: [{ name: 'netsim', options: { latency: 250, sleep: clock.sleep } }],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, true)
    strictEqual(clock.time, 250, 'latency advanced the (virtual) clock')
    strictEqual(h.client._netsim.calls, 1)
    strictEqual(h.client._netsim.applied[0].latency, 250)
  })

  test('failTimes returns a retryable status for the first N calls', async () => {
    const h = makeClient({
      features: [{ name: 'netsim', options: { failTimes: 2, failStatus: 503 } }],
    })
    const a = await h.op({ op: 'load' })
    const b = await h.op({ op: 'load' })
    const c = await h.op({ op: 'load' })
    strictEqual(a.ok, false)
    strictEqual(a.result.status, 503)
    strictEqual(b.ok, false)
    strictEqual(c.ok, true, 'third call succeeds once the failure budget is spent')
  })

  test('errorTimes throws a connection-level error', async () => {
    const h = makeClient({
      features: [{ name: 'netsim', options: { errorTimes: 1 } }],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, false)
    strictEqual(res.error.code, 'netsim_conn')
  })

  test('offline fails every call', async () => {
    const h = makeClient({
      features: [{ name: 'netsim', options: { offline: true } }],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, false)
    strictEqual(res.error.code, 'netsim_offline')
  })

  test('rateLimitTimes returns 429 with Retry-After', async () => {
    const h = makeClient({
      features: [{ name: 'netsim', options: { rateLimitTimes: 1, retryAfter: 3 } }],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.result.status, 429)
    strictEqual(res.result.headers['retry-after'], '3')
  })
})


describe('feature:retry', () => {

  test('retries transient failures then succeeds', async () => {
    const clock = makeClock()
    // retry wraps netsim (init order): retry re-calls the simulated transport.
    const h = makeClient({
      features: [
        { name: 'netsim', options: { failTimes: 2, failStatus: 503 } },
        { name: 'retry', options: { retries: 3, minDelay: 10, jitter: false, sleep: clock.sleep } },
      ],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, true)
    strictEqual(h.client._netsim.calls, 3, 'two failures + one success')
    strictEqual(h.client._retry.attempts, 2)
  })

  test('gives up after the retry budget and returns the failure', async () => {
    const clock = makeClock()
    const h = makeClient({
      features: [
        { name: 'netsim', options: { failTimes: 9, failStatus: 500 } },
        { name: 'retry', options: { retries: 2, minDelay: 1, jitter: false, sleep: clock.sleep } },
      ],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, false)
    strictEqual(res.result.status, 500)
    strictEqual(h.client._netsim.calls, 3, '1 initial + 2 retries')
  })

  test('honours a server Retry-After over computed backoff', async () => {
    const clock = makeClock()
    const h = makeClient({
      features: [
        { name: 'netsim', options: { rateLimitTimes: 1, retryAfter: 2 } },
        { name: 'retry', options: { retries: 2, minDelay: 10, maxDelay: 60000, jitter: false, sleep: clock.sleep } },
      ],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, true)
    strictEqual(clock.time, 2000, 'waited the Retry-After of 2 seconds')
  })
})


describe('feature:timeout', () => {

  test('a slow request resolves to a timeout error', async () => {
    // Real timers with an 8x margin: transport takes ~80ms, deadline 10ms.
    const h = makeClient({
      features: [
        { name: 'netsim', options: { latency: 80 } },
        { name: 'timeout', options: { ms: 10 } },
      ],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, false)
    strictEqual(res.error.code, 'timeout')
    strictEqual(h.client._timeout.count, 1)
  })

  test('a fast request passes through untouched', async () => {
    const h = makeClient({
      features: [{ name: 'timeout', options: { ms: 1000 } }],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, true)
  })
})


describe('feature:ratelimit', () => {

  test('throttles once the burst is exhausted', async () => {
    const clock = makeClock()
    const h = makeClient({
      features: [{
        name: 'ratelimit',
        options: { rate: 1, burst: 2, now: clock.now, sleep: clock.sleep },
      }],
    })
    await h.op({ op: 'load' }) // token 1
    await h.op({ op: 'load' }) // token 2
    await h.op({ op: 'load' }) // must wait for refill
    strictEqual(h.client._ratelimit.throttled, 1)
    ok(clock.time > 0, 'the third call waited for a token')
  })
})


describe('feature:cache', () => {

  test('serves a repeated read from cache (one transport call)', async () => {
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'cache', options: { ttl: 10000 } }],
      server: rec.server,
    })
    const a = await h.op({ op: 'load', path: '/widget/1' })
    const b = await h.op({ op: 'load', path: '/widget/1' })
    strictEqual(rec.calls.length, 1, 'second read hit the cache')
    deepStrictEqual(a.data, b.data)
    strictEqual(h.client._cache.hit, 1)
    strictEqual(h.client._cache.miss, 1)
  })

  test('does not cache non-GET methods', async () => {
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'cache' }],
      server: rec.server,
    })
    await h.op({ op: 'create', path: '/widget' })
    await h.op({ op: 'create', path: '/widget' })
    strictEqual(rec.calls.length, 2)
  })

  test('re-fetches after the ttl expires', async () => {
    const clock = makeClock()
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'cache', options: { ttl: 1000, now: clock.now } }],
      server: rec.server,
    })
    await h.op({ op: 'load', path: '/w' })
    clock.advance(1500)
    await h.op({ op: 'load', path: '/w' })
    strictEqual(rec.calls.length, 2, 'stale entry triggered a refetch')
  })
})


describe('feature:idempotency', () => {

  test('adds an Idempotency-Key to mutating requests', async () => {
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'idempotency' }],
      server: rec.server,
    })
    await h.op({ op: 'create', path: '/widget' })
    const sent = rec.calls[0].fetchdef.headers
    ok(null != sent['Idempotency-Key'], 'key header present')
  })

  test('leaves read requests untouched', async () => {
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'idempotency' }],
      server: rec.server,
    })
    await h.op({ op: 'load', path: '/widget/1' })
    strictEqual(rec.calls[0].fetchdef.headers['Idempotency-Key'], undefined)
  })

  test('does not overwrite a caller-provided key', async () => {
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'idempotency' }],
      server: rec.server,
    })
    await h.op({ op: 'create', path: '/widget', headers: { 'Idempotency-Key': 'caller-123' } })
    strictEqual(rec.calls[0].fetchdef.headers['Idempotency-Key'], 'caller-123')
  })
})


describe('feature:rbac', () => {

  test('denies an operation lacking the required permission, before any call', async () => {
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'rbac', options: { rules: { 'widget.remove': 'admin' }, permissions: [] } }],
      server: rec.server,
    })
    const res = await h.op({ op: 'remove', path: '/widget/1' })
    strictEqual(res.ok, false)
    strictEqual(res.error.code, 'rbac_denied')
    strictEqual(rec.calls.length, 0, 'no network call for a denied op')
    strictEqual(h.client._rbac.denied, 1)
  })

  test('allows an operation when the permission is held', async () => {
    const h = makeClient({
      features: [{ name: 'rbac', options: { rules: { 'widget.remove': 'admin' }, permissions: ['admin'] } }],
    })
    const res = await h.op({ op: 'remove', path: '/widget/1' })
    strictEqual(res.ok, true)
    strictEqual(h.client._rbac.allowed, 1)
  })

  test('a wildcard permission grants everything', async () => {
    const h = makeClient({
      features: [{ name: 'rbac', options: { rules: { '*': 'anything' }, permissions: ['*'] } }],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, true)
  })

  test('default-deny blocks ops without a matching rule', async () => {
    const h = makeClient({
      features: [{ name: 'rbac', options: { deny: true, permissions: [] } }],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, false)
    strictEqual(res.error.code, 'rbac_denied')
  })
})


describe('feature:metrics', () => {

  test('counts successes and failures per operation', async () => {
    const h = makeClient({
      features: [
        { name: 'netsim', options: { failTimes: 1, failStatus: 500 } },
        { name: 'metrics', options: {} },
      ],
    })
    await h.op({ op: 'load' })   // fails (500)
    await h.op({ op: 'load' })   // ok
    await h.op({ op: 'list' })   // ok
    const m = h.client._metrics
    strictEqual(m.total.count, 3)
    strictEqual(m.total.ok, 2)
    strictEqual(m.total.err, 1)
    strictEqual(m.ops['widget.load'].count, 2)
    strictEqual(m.ops['widget.list'].count, 1)
  })
})


describe('feature:telemetry', () => {

  test('opens a span per op and propagates trace headers', async () => {
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'telemetry' }],
      server: rec.server,
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, true)
    strictEqual(h.client._telemetry.spans.length, 1)
    const span = h.client._telemetry.spans[0]
    strictEqual(span.ok, true)
    ok(null != span.traceId && null != span.spanId)
    const sent = rec.calls[0].fetchdef.headers
    strictEqual(sent['X-Trace-Id'], span.traceId)
    ok(/^00-.+-.+-01$/.test(sent['traceparent']))
  })
})


describe('feature:debug', () => {

  test('captures a redacted request/response trace', async () => {
    const h = makeClient({
      features: [{ name: 'debug' }],
    })
    await h.op({ op: 'load', headers: { authorization: 'Bearer secret' } })
    const entry = h.client._debug.entries[0]
    strictEqual(entry.status, 200)
    strictEqual(entry.headers.authorization, '<redacted>')
    strictEqual(entry.op, 'widget.load')
    ok(entry.durationMs >= 0)
  })
})


describe('feature:audit', () => {

  test('records one outcome per operation', async () => {
    const h = makeClient({
      features: [
        { name: 'netsim', options: { failTimes: 1, failStatus: 500 } },
        { name: 'audit', options: { actor: 'svc-account' } },
      ],
    })
    await h.op({ op: 'remove', path: '/widget/1' }) // fails
    await h.op({ op: 'load' })                       // ok
    const recs = h.client._audit.records
    strictEqual(recs.length, 2, 'exactly one record per op (no double-log on failure)')
    strictEqual(recs[0].outcome, 'error')
    strictEqual(recs[0].actor, 'svc-account')
    strictEqual(recs[1].outcome, 'ok')
  })
})


describe('feature:clienttrack', () => {

  test('stamps stable client id and unique request ids', async () => {
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'clienttrack', options: { clientName: 'Acme', clientVersion: '2.0.0' } }],
      server: rec.server,
    })
    await h.ready()
    await h.op({ op: 'load' })
    await h.op({ op: 'load' })
    const h0 = rec.calls[0].fetchdef.headers
    const h1 = rec.calls[1].fetchdef.headers
    strictEqual(h0['User-Agent'], 'Acme/2.0.0')
    strictEqual(h0['X-Client-Id'], h1['X-Client-Id'], 'same session across calls')
    ok(h0['X-Request-Id'] !== h1['X-Request-Id'], 'unique request id per call')
    strictEqual(h.client._clienttrack.requests, 2)
  })
})


describe('feature:paging', () => {

  test('stamps page params and reads pagination signals', async () => {
    const rec = recordingServer((_n, _fd) =>
      makeResponse(200, { items: [1, 2], hasMore: true, next: '/widget?page=2' },
        { 'x-next-page': '2', 'x-total-count': '5' }))
    const h = makeClient({
      features: [{ name: 'paging', options: { limit: 2 } }],
      server: rec.server,
    })
    const res = await h.op({ op: 'list', path: '/widget' })
    strictEqual(res.ok, true)
    // outbound page/limit query
    const url = rec.calls[0].url
    ok(/[?&]page=1(&|$)/.test(url), 'page param stamped: ' + url)
    ok(/[?&]limit=2(&|$)/.test(url), 'limit param stamped: ' + url)
    // inbound pagination signals
    strictEqual(res.result.paging.hasMore, true)
    strictEqual(res.result.paging.nextPage, 2)
    strictEqual(res.result.paging.totalCount, 5)
  })
})


describe('feature:streaming', () => {

  test('exposes a result stream() async-iterator over list items', async () => {
    const clock = makeClock()
    const rec = recordingServer((_n) => makeResponse(200, ['a', 'b', 'c']))
    const h = makeClient({
      features: [{ name: 'streaming', options: { chunkDelay: 5, sleep: clock.sleep } }],
      server: rec.server,
    })
    const res = await h.op({ op: 'list', path: '/widget' })
    strictEqual(res.result.streaming, true)
    const seen: any[] = []
    for await (const item of res.result.stream()) {
      seen.push(item)
    }
    deepStrictEqual(seen, ['a', 'b', 'c'])
    strictEqual(clock.time, 15, 'three chunk delays of 5ms')
  })
})


describe('feature:proxy', () => {

  test('routes requests through the configured proxy', async () => {
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'proxy', options: { url: 'http://proxy.internal:8080' } }],
      server: rec.server,
    })
    await h.op({ op: 'load' })
    strictEqual(rec.calls[0].fetchdef.proxy, 'http://proxy.internal:8080')
    strictEqual(h.client._proxy.routed, 1)
  })

  test('bypasses hosts in noProxy', async () => {
    const rec = recordingServer()
    const h = makeClient({
      features: [{ name: 'proxy', options: { url: 'http://proxy:8080', noProxy: ['api.test'] } }],
      server: rec.server,
      base: 'http://api.test',
    })
    await h.op({ op: 'load' })
    strictEqual(rec.calls[0].fetchdef.proxy, undefined, 'bypassed for noProxy host')
  })
})


describe('feature:test-netsim', () => {

  // Exercises the real TestFeature.makeNetsim source (the `net` simulation
  // that ships into every generated SDK's offline test transport).
  const errCtx = { error: (c: string, m: string) => { const e: any = new Error(m); e.code = c; return e } }

  test('offline simulation returns a connection error', async () => {
    const inst: any = new (loadFeature('test'))()
    const f = inst.makeNetsim({ offline: true }, async () => makeResponse(200, {}))
    const r = await f(errCtx, 'http://x', {})
    strictEqual(r.code, 'netsim_offline')
  })

  test('failTimes budget then success', async () => {
    const inst: any = new (loadFeature('test'))()
    const f = inst.makeNetsim({ failTimes: 1, failStatus: 503 },
      async () => makeResponse(200, { ok: true }))
    strictEqual((await f(errCtx, 'u', {})).status, 503)
    strictEqual((await f(errCtx, 'u', {})).status, 200)
  })

  test('errorTimes throws a connection error', async () => {
    const inst: any = new (loadFeature('test'))()
    const f = inst.makeNetsim({ errorTimes: 1 }, async () => makeResponse(200, {}))
    strictEqual((await f(errCtx, 'u', {})).code, 'netsim_conn')
  })

  test('latency delays via the injectable sleep', async () => {
    const inst: any = new (loadFeature('test'))()
    let slept = 0
    const f = inst.makeNetsim({ latency: 120, sleep: (ms: number) => { slept += ms } },
      async () => makeResponse(200, { ok: true }))
    const r = await f(errCtx, 'u', {})
    strictEqual(slept, 120)
    strictEqual(r.status, 200)
  })
})


describe('feature:composition', () => {

  test('cache + netsim: a hit skips the simulated failure', async () => {
    // First call fills the cache; netsim would fail the second call, but
    // the cache serves it, so the op still succeeds.
    const h = makeClient({
      features: [
        { name: 'netsim', options: { failEvery: 2 } }, // 2nd transport call fails
        { name: 'cache', options: { ttl: 10000 } },     // wraps netsim (outer)
      ],
    })
    const a = await h.op({ op: 'load', path: '/w' })
    const b = await h.op({ op: 'load', path: '/w' })
    strictEqual(a.ok, true)
    strictEqual(b.ok, true, 'served from cache, netsim never saw a 2nd call')
    strictEqual(h.client._netsim.calls, 1)
  })

  test('retry + metrics: a recovered call counts as a single success', async () => {
    const clock = makeClock()
    const h = makeClient({
      features: [
        { name: 'netsim', options: { failTimes: 1, failStatus: 503 } },
        { name: 'retry', options: { retries: 2, minDelay: 1, jitter: false, sleep: clock.sleep } },
        { name: 'metrics', options: {} },
      ],
    })
    const res = await h.op({ op: 'load' })
    strictEqual(res.ok, true)
    strictEqual(h.client._metrics.total.count, 1)
    strictEqual(h.client._metrics.total.ok, 1)
    strictEqual(h.client._metrics.total.err, 0)
  })
})
