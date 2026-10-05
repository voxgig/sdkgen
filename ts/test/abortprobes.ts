// A caller's AbortSignal, driven through a generated SDK against a server that
// stalls far longer than any call waits to abort, so a call that ignored the
// signal would come back late, or not fail at all.
const ABORT_OUTCOMES: Record<string, string> = {
  'load before the headers': 'request_aborted, prompt, cause',
  'load mid-body': 'request_aborted, prompt, cause',
  'list before the headers': 'request_aborted, prompt, cause',
  'load already aborted': 'request_aborted, prompt, cause, not sent',
  'load aborted with 0': 'request_aborted, prompt, cause',
  'two loads on one signal': 'request_aborted, request_aborted, distinct',
  'load with throw false': 'returned, ctrl.err request_aborted',
  'direct before the headers': 'ok false, request_aborted, prompt, cause',
  'stream before the headers': 'ended, prompt, 0 item(s)',
  'load never aborted': 'sent',
}


function abortOutcomes(out: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const m of out.matchAll(/abort-probe: ([^:\n]+): ([^\r\n]*)/g)) {
    found[m[1]] = m[2].trim()
  }
  return found
}


const NODE_PROBE = `
const Http = require('node:http')
const { SDK } = require('SDK_MODULE')

const STALL = 2000
const seen = {}

const server = Http.createServer((req, res) => {
  const name = req.url.split('?')[0].split('/').pop()
  seen[name] = (seen[name] || 0) + 1
  const json = { 'content-type': 'application/json' }
  if ('fast' === name) {
    res.writeHead(200, json)
    return res.end('{"id":"fast"}')
  }
  if ('slowbody' === name) {
    res.writeHead(200, json)
    res.write('{"id":')
    return setTimeout(() => res.end('"slowbody"}'), STALL)
  }
  setTimeout(() => {
    res.writeHead(200, json)
    res.end('cat' === name ? '[]' : '{"id":"' + name + '"}')
  }, STALL)
})

const report = (name, result) => console.log('abort-probe: ' + name + ': ' + result)

const aborting = (reason) => {
  const ac = new AbortController()
  setTimeout(() => ac.abort(reason), 50)
  return ac
}

const settle = async (fn) => {
  const start = Date.now()
  try {
    return { value: await fn(), ms: Date.now() - start }
  }
  catch (err) {
    return { err, ms: Date.now() - start }
  }
}

const describe = (err, ms, reason) => [
  null == err ? 'no error' : err.code,
  ms < 1000 ? 'prompt' : 'late (' + ms + 'ms)',
  null != err && err.cause === reason ? 'cause' : 'no cause',
].join(', ')

;(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const client = new SDK({ base: 'http://127.0.0.1:' + server.address().port })

  for (const id of ['slowhead', 'slowbody']) {
    const reason = new Error('stop')
    const ac = aborting(reason)
    const r = await settle(() => client.Cat().load({ id }, { signal: ac.signal }))
    report('load ' + ('slowhead' === id ? 'before the headers' : 'mid-body'), describe(r.err, r.ms, reason))
  }

  {
    const reason = new Error('stop')
    const ac = aborting(reason)
    const r = await settle(() => client.Cat().list({}, { signal: ac.signal }))
    report('list before the headers', describe(r.err, r.ms, reason))
  }

  {
    const ac = new AbortController()
    const reason = new Error('stop')
    ac.abort(reason)
    const r = await settle(() => client.Cat().load({ id: 'pre' }, { signal: ac.signal }))
    report('load already aborted', describe(r.err, r.ms, reason) + (seen.pre ? ', sent' : ', not sent'))
  }

  {
    const ac = aborting(0)
    const r = await settle(() => client.Cat().load({ id: 'slowhead' }, { signal: ac.signal }))
    report('load aborted with 0', describe(r.err, r.ms, 0))
  }

  {
    const ac = aborting(new Error('stop'))
    const [a, b] = await Promise.all([
      settle(() => client.Cat().load({ id: 'slowhead' }, { signal: ac.signal })),
      settle(() => client.Cat().load({ id: 'slowhead' }, { signal: ac.signal })),
    ])
    const own = (r) => /load: request aborted$/.test(String(r.err && r.err.message))
    report('two loads on one signal', [a.err && a.err.code, b.err && b.err.code,
      null != a.err && a.err !== b.err && own(a) && own(b) ? 'distinct' : 'shared'].join(', '))
  }

  {
    const ac = aborting(new Error('stop'))
    const ctrl = { signal: ac.signal, throw: false }
    const r = await settle(() => client.Cat().load({ id: 'slowhead' }, ctrl))
    report('load with throw false', (null == r.err ? 'returned' : 'threw ' + r.err.code) +
      ', ctrl.err ' + (ctrl.err && ctrl.err.code))
  }

  {
    const reason = new Error('stop')
    const ac = aborting(reason)
    const r = await settle(() => client.direct({ path: 'cat/slowhead', ctrl: { signal: ac.signal } }))
    const res = r.value || {}
    report('direct before the headers', 'ok ' + res.ok + ', ' + describe(res.err, r.ms, reason))
  }

  {
    const ac = aborting(new Error('stop'))
    const items = []
    const r = await settle(async () => {
      for await (const item of client.Cat().stream('load', { reqmatch: { id: 'slowhead' } },
        { signal: ac.signal })) {
        items.push(item)
      }
    })
    report('stream before the headers', (null == r.err ? 'ended' : 'threw ' + r.err.code) + ', ' +
      (r.ms < 1000 ? 'prompt' : 'late (' + r.ms + 'ms)') + ', ' + items.length + ' item(s)')
  }

  {
    const ac = new AbortController()
    const r = await settle(() => client.Cat().load({ id: 'fast' }, { signal: ac.signal }))
    report('load never aborted', null == r.err ? 'sent' : 'error ' + r.err.message)
  }

  server.closeAllConnections()
  server.close()
  process.exit(0)
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
`


const ABORT_PROBES: Record<string, string> = {
  node: NODE_PROBE,
}


export {
  ABORT_OUTCOMES,
  ABORT_PROBES,
  abortOutcomes,
}
