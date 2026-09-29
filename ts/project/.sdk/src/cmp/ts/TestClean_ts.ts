import {
  cmp,
  File,
  Content,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// the SDK is searched for the canaries and their encoded forms. It also
// proves its own sensitivity: with clean switched off the canary MUST show.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  File({ name: 'clean.test.ts' }, () => Content(render(auth)))
})


function render(auth: {
  suppressed: boolean, where: string, name: string, basic: boolean
}): string {
  return `import { test, describe } from 'node:test'
import { ok, equal } from 'node:assert'
import { inspect } from 'node:util'

import { SDK, BaseFeature } from '..'
import { hasFeature } from './feature/harness'


// Generated: the credential's wire placement is fixed when the SDK is built.
const AUTH = ${JSON.stringify(auth)}

const CANARY = {
  apikey: 'CANARY-APIKEY-k9x2m7q4p1',
  secret: 'CANARY-SECRET-w3e8r5t2y6',
  header: 'CANARY-HEADER-z1x4c7v0b3',
  value: 'CANARY-VALUE-n5m8b2v9c4',
}

const MASK = '[redacted]'

// Every form a canary can travel in.
const FORMS: string[] = []
for (const v of Object.values(CANARY)) {
  FORMS.push(v, Buffer.from(v).toString('base64'), encodeURIComponent(v))
}
FORMS.push(Buffer.from(CANARY.apikey + ':' + CANARY.secret).toString('base64'))


type Sink = { name: string, text: string }


// Header maps keep the caller's spelling; the assertion should not care.
function header(map: any, name: string): any {
  for (const k of Object.keys(map || {})) {
    if (k.toLowerCase() === name.toLowerCase()) return map[k]
  }
  return undefined
}


function leaks(text: string): string[] {
  return FORMS.filter((f) => text.includes(f))
}


function forms(name: string, val: any): Sink[] {
  const out: Sink[] = []
  const push = (kind: string, fn: () => string) => {
    try { out.push({ name: name + ':' + kind, text: fn() }) } catch (_e) { }
  }
  push('json', () => JSON.stringify(val))
  push('string', () => String(val))
  push('inspect', () => inspect(val, { depth: 8 }))
  if (val instanceof Error) {
    push('message', () => String(val.message))
    push('stack', () => String(val.stack))
    push('props', () => inspect({ ...val }, { depth: 8 }))
  }
  return out
}


// Captures the serialised context from inside the pipeline: what a hook
// author would hand to a logger.
class CaptureFeature extends BaseFeature {
  name = 'capture'
  version = '0.0.1'
  active = true
  _sinks: Sink[]
  constructor(sinks: Sink[]) { super(); this._sinks = sinks }
  init() { }
  PreRequest(this: any, ctx: any) { this._sinks.push(...forms('ctx@PreRequest', ctx)) }
  PreResponse(this: any, ctx: any) { this._sinks.push(...forms('ctx@PreResponse', ctx)) }
  PreUnexpected(this: any, ctx: any) { this._sinks.push(...forms('ctx@PreUnexpected', ctx)) }
}


type Scenario = { name: string, respond: (url: string, fetchdef: any) => any }

function response(status: number, data: any, headers?: Record<string, string>): any {
  const h: Record<string, string> = { 'content-type': 'application/json', ...(headers || {}) }
  return {
    status,
    statusText: status < 400 ? 'OK' : 'ERR',
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: {
      get(key: string) { return h[String(key).toLowerCase()] },
      forEach(cb: any) { Object.keys(h).forEach((k) => cb(h[k], k, this)) },
    },
  }
}

const SCENARIOS: Scenario[] = [
  { name: 'ok', respond: () => response(200, { id: 'i1', name: 'n1' },
    { 'x-session-token': 'RESP-TOKEN-a1b2c3d4e5' }) },
  { name: 'notfound', respond: () => response(404, { error: 'no such record' }) },
  { name: 'server', respond: () => response(500, { error: 'boom' }) },
  { name: 'transport', respond: (url: string) => {
    throw new Error('socket hang up (URL was: "' + url + '")')
  } },
  { name: 'notjson', respond: () => ({
    status: 200, statusText: 'OK',
    json: async () => { throw new Error('Unexpected token < in JSON') },
    text: async () => '<html>',
    headers: { get() { return undefined }, forEach() { } },
  }) },
]


function makeSdk(scenario: Scenario, sinks: Sink[], cleanopts?: any): any {
  const capture = (name: string) => (rec: any) => { sinks.push(...forms(name, rec)) }
  const feature: any = {}
  if (hasFeature('log')) {
    const logger: any = {}
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal']) {
      logger[level] = capture('log.' + level)
    }
    feature.log = { active: true, logger }
  }
  if (hasFeature('debug')) feature.debug = { active: true, onEntry: capture('debug') }
  if (hasFeature('audit')) feature.audit = { active: true, sink: capture('audit') }
  if (hasFeature('telemetry')) feature.telemetry = { active: true, exporter: capture('telemetry') }
  if (hasFeature('cost')) feature.cost = { active: true, sink: capture('cost') }
  if (hasFeature('metrics')) feature.metrics = { active: true }
  if (hasFeature('clienttrack')) feature.clienttrack = { active: true }

  const opts: any = {
    apikey: CANARY.apikey,
    secret: CANARY.secret,
    headers: { 'X-Custom-Token': CANARY.header },
    clean: { values: CANARY.value, ...(cleanopts || {}) },
    feature,
    extend: [new CaptureFeature(sinks)],
    utility: {
      fetcher: async (_ctx: any, url: string, fetchdef: any) => scenario.respond(url, fetchdef),
    },
  }
  return new (SDK as any)(opts)
}


// The first operation that completes against a plain 200 with no arguments
// (a required path parameter would fail before the request is built).
async function usableOp(): Promise<{ accessor: string, op: string } | null> {
  const plain = new (SDK as any)({
    apikey: CANARY.apikey,
    utility: { fetcher: async () => response(200, { id: 'i1' }) },
  })
  const entities: Record<string, any> = plain._rootctx.config.entity || {}
  for (const m of Object.getOwnPropertyNames(Object.getPrototypeOf(plain)).sort()) {
    if (!/^[A-Z]/.test(m) || 'function' !== typeof plain[m]) { continue }
    let inst: any
    try { inst = plain[m]() } catch (_e) { continue }
    if (null == inst || 'string' !== typeof inst.name || null == entities[inst.name]) { continue }
    const ops = Object.keys(entities[inst.name].op || {})
      .sort((a, b) => (({ list: 0, load: 1 } as any)[a] ?? 2) - (({ list: 0, load: 1 } as any)[b] ?? 2))
    for (const op of ops) {
      try {
        await plain[m]()[op]({}, {})
        return { accessor: m, op }
      }
      catch (_e) { continue }
    }
  }
  return null
}


async function drive(sdk: any, target: { accessor: string, op: string }, ctrl: any, sinks: Sink[]) {
  let out: any = undefined
  let err: any = undefined
  try {
    out = await sdk[target.accessor]()[target.op]({}, ctrl)
  }
  catch (e: any) {
    err = e
  }
  if (undefined !== err) sinks.push(...forms('error', err))
  if (undefined !== out) sinks.push(...forms('result', out))
  if (null != ctrl.explain) sinks.push(...forms('explain', ctrl.explain))
  return err
}


describe('clean', () => {
  test('no credential leaves the SDK in any form', async () => {
    const target = await usableOp()
    ok(null != target, 'no operation completes without arguments; nothing to sweep')

    const sinks: Sink[] = []
    const errors: Record<string, any> = {}
    const explains: Record<string, any> = {}

    for (const scenario of SCENARIOS) {
      for (const variant of [
        { name: 'throw', ctrl: () => ({}) },
        { name: 'explain', ctrl: () => ({ explain: {} }) },
        { name: 'nothrow', ctrl: () => ({ throw: false, explain: {} }) },
      ]) {
        const sdk = makeSdk(scenario, sinks)
        const ctrl: any = variant.ctrl()
        const err = await drive(sdk, target!, ctrl, sinks)
        const key = scenario.name + '/' + variant.name
        if (null != err) errors[key] = err
        if (null != ctrl.explain) explains[key] = ctrl.explain
        sinks.push(...forms('sdk', sdk))
        sinks.push({ name: 'sdk:spread', text: inspect({ ...sdk }, { depth: 6 }) })
      }
    }

    const leaked = sinks
      .map((s) => ({ name: s.name, found: leaks(s.text) }))
      .filter((s) => 0 < s.found.length)

    console.log('clean: swept ' + sinks.length + ' surface(s), ' + leaked.length + ' leak(s)')

    equal(leaked.length, 0, 'credential leaked through: ' +
      leaked.map((l) => l.name + ' [' + l.found.join(', ') + ']').join('; '))

    // The positive half: the slot the credential travelled in is masked,
    // and an unregistered token in a response header is masked by name.
    const notfound = errors['notfound/throw']
    ok(null != notfound, 'the 404 scenario must throw')
    equal(notfound.status, 404)
    if (!AUTH.suppressed) {
      const spec = notfound.spec || {}
      if ('query' === AUTH.where) {
        equal(header(spec.query, AUTH.name), MASK)
      }
      else if ('cookie' === AUTH.where) {
        ok(String(header(spec.headers, 'cookie')).includes(MASK), 'cookie: ' + header(spec.headers, 'cookie'))
      }
      else {
        ok(String(header(spec.headers, AUTH.name)).endsWith(MASK),
          AUTH.name + ': ' + header(spec.headers, AUTH.name))
      }
    }
    equal(header(notfound.spec.headers, 'x-custom-token'), MASK)

    const explained = explains['ok/explain'] || {}
    ok(null != explained.result, 'the explain record should carry the result')
    equal(header(explained.result.headers, 'x-session-token'), MASK)
  })


  test('the sweep can see a leak: clean switched off shows the credential', async () => {
    const target = await usableOp()
    ok(null != target)

    const sinks: Sink[] = []
    const sdk = makeSdk(SCENARIOS[1], sinks, { active: false })
    const err = await drive(sdk, target!, {}, sinks)
    ok(null != err)

    const leaked = sinks.filter((s) => 0 < leaks(s.text).length)
    ok(0 < leaked.length, 'with clean off, nothing showed the canary: the sweep is blind')

    if (!AUTH.suppressed) {
      const text = JSON.stringify(err.spec)
      ok(text.includes(CANARY.apikey) ||
        text.includes(Buffer.from(CANARY.apikey + ':' + CANARY.secret).toString('base64')),
        'the raw spec should carry the credential when clean is off')
    }
  })
})
`
}


export {
  TestClean
}
