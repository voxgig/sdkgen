
// Offline feature-runtime harness.
//
// Enterprise feature behaviour lives in the shipped TEMPLATE files under
// project/.sdk/tm/ts/src/feature/<name>/. Those files use placeholder
// imports (ProjectNameSDK, ../../types) and only ever compile inside a
// GENERATED SDK, so they are outside sdkgen's own tsconfig. To unit test
// the real template source here — offline and deterministically — this
// harness:
//
//   1. reads the template .ts,
//   2. transpiles it with the TypeScript compiler (type-only imports are
//      erased, so the ProjectNameSDK/types placeholders vanish),
//   3. loads it in a sandbox whose `require` shims the base class,
//   4. drives it through a faithful miniature of the generated operation
//      pipeline (the same hook order and short-circuit rules as the
//      Entity*Op fragments), against a configurable simulated transport.
//
// The result: the exact code that ships to users is exercised against
// simulated network conditions without generating a full SDK.

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import * as ts from 'typescript'
import * as struct from '@voxgig/struct'


const FEATURE_DIR = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm', 'ts', 'src', 'feature')


function cap(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}


// Transpile a template .ts to CommonJS and evaluate it in a sandbox whose
// `require` returns the shims map (plus real node_modules as a fallback).
function sandboxLoad(file: string, shims: Record<string, any>): any {
  const src = readFileSync(file, 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText

  const mod: any = { exports: {} }
  const req = (p: string) => {
    for (const key of Object.keys(shims)) {
      if (p === key || p.endsWith(key)) {
        return shims[key]
      }
    }
    return require(p)
  }

  // eslint-disable-next-line no-new-func
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}


// The real BaseFeature template, loaded once and shared as the superclass.
let _BaseFeature: any = null
function loadBase(): any {
  if (null == _BaseFeature) {
    const file = Path.join(FEATURE_DIR, 'base', 'BaseFeature.ts')
    _BaseFeature = sandboxLoad(file, { '../../types': {} }).BaseFeature
  }
  return _BaseFeature
}


// Load a feature class from its shipped template by name.
function loadFeature(name: string): any {
  const Base = loadBase()
  const file = Path.join(FEATURE_DIR, name, cap(name) + 'Feature.ts')
  const exp = sandboxLoad(file, {
    '../base/BaseFeature': { BaseFeature: Base },
    '../../types': {},
    '../../ProjectNameSDK': {},
  })
  return exp[cap(name) + 'Feature']
}


// A deterministic virtual clock: `now()` advances only when `sleep(ms)` is
// called, so timing-based features (retry backoff, ratelimit, timeout) can
// be tested without real delays or flakiness.
function makeClock(start = 0) {
  let t = start
  return {
    now: () => t,
    sleep: (ms: number) => { t += (ms || 0) },
    advance: (ms: number) => { t += ms },
    get time() { return t },
  }
}


// Build a transport-shaped response the pipeline understands (status,
// re-readable json body, header get/forEach iterator).
function makeResponse(status: number, data?: any, headers?: Record<string, any>): any {
  const h: Record<string, any> = {}
  for (const k of Object.keys(headers || {})) {
    h[k.toLowerCase()] = (headers as any)[k]
  }
  return {
    status,
    statusText: status < 400 ? 'OK' : 'ERR',
    body: 'not-used',
    json: async () => data,
    headers: {
      get(key: string) { return h[String(key).toLowerCase()] },
      forEach(cb: any) { Object.keys(h).forEach((k) => cb(h[k], k, this)) },
    },
  }
}


type ServerFn = (ctx: any, url: string, fetchdef: any) => any


// A default transport: 200 for reads, echoing simple data. Override per
// harness for op-specific payloads.
function defaultServer(): ServerFn {
  return (_ctx: any, _url: string, fetchdef: any) => {
    const method = (fetchdef.method || 'GET').toUpperCase()
    if ('GET' === method) {
      return makeResponse(200, { ok: true, method })
    }
    return makeResponse(200, { ok: true, method, echo: fetchdef.body })
  }
}


function defaultMethod(op: string): string {
  if ('create' === op) return 'POST'
  if ('update' === op) return 'PATCH'
  if ('remove' === op) return 'DELETE'
  return 'GET'
}


// Construct a fake SDK client wired with the given features (in init order)
// and a mini operation pipeline. `features` is a list of
// { name, options } — the class is loaded from its template by name.
function makeClient(spec: {
  features: Array<{ name: string, options?: any }>
  server?: ServerFn
  mode?: string
  base?: string
  headers?: Record<string, any>
}) {
  const base = spec.base || 'http://api.test'
  const server: ServerFn = spec.server || defaultServer()

  // Shared utility singleton (features wrap `utility.fetcher` in init).
  const utility: any = {
    struct,
    fetcher: server,
    param: (ctx: any, name: string) => {
      const p = (ctx.spec && ctx.spec.params) || {}
      const q = (ctx.spec && ctx.spec.query) || {}
      return null != p[name] ? p[name] : q[name]
    },
  }

  const client: any = {
    _mode: spec.mode || 'test',
    _features: [],
    _options: { base, headers: spec.headers || {}, feature: {} },
    options() { return this._options },
    utility() { return utility },
  }

  function makeErr(code: string, msg: string): any {
    const e: any = new Error(msg)
    e.code = code
    e.isSdkError = true
    return e
  }

  let idseq = 0
  function makeCtx(over: any): any {
    idseq++
    return {
      id: 'C' + idseq,
      client,
      utility,
      out: {},
      ctrl: over.ctrl || {},
      meta: {},
      op: over.op,
      entity: over.entity,
      spec: undefined,
      response: undefined,
      result: undefined,
      shared: rootShared,
      error(code: string, m: string) { return makeErr(code, m) },
    }
  }

  const rootShared = new WeakMap()

  // Faithful hook dispatch: call each feature's method (inherited no-ops
  // included, matching the generated featureHook) and await any promises.
  async function featureHook(ctx: any, name: string) {
    const resp: any[] = []
    for (const f of client._features) {
      const fn = f[name]
      if ('function' === typeof fn) {
        const r = fn.call(f, ctx)
        if (r instanceof Promise) { resp.push(r) }
      }
    }
    if (0 < resp.length) { await Promise.all(resp) }
  }

  const rootctx = makeCtx({ op: { name: 'root', entity: '_' }, entity: undefined })

  // Instantiate + init features in the given order, then PostConstruct.
  for (const fspec of spec.features) {
    const F = loadFeature(fspec.name)
    const f = new F()
    const fopts = { active: true, ...(fspec.options || {}) }
    client._options.feature[f.name] = fopts
    f.init(rootctx, fopts)
    client._features.push(f)
  }

  function buildUrl(sp: any): string {
    const q = sp.query || {}
    const keys = Object.keys(q).filter((k) => null != q[k]).sort()
    const qs = keys.map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(q[k]))).join('&')
    return sp.base + (sp.path || '') + (qs ? '?' + qs : '')
  }

  async function populateResult(ctx: any, response: any) {
    const result: any = {
      ok: false, status: -1, statusText: '', headers: {},
      body: undefined, resdata: undefined, err: undefined,
    }
    ctx.result = result

    if (response instanceof Error) {
      result.err = response
      return
    }
    result.status = response.status
    result.statusText = response.statusText
    if (response.headers && response.headers.forEach) {
      response.headers.forEach((v: any, k: any) => result.headers[k] = v)
    }
    if ('function' === typeof response.json) {
      result.body = await response.json()
    }
    result.resdata = result.body
    if (result.status >= 400) {
      result.err = makeErr('request_status', 'request: ' + result.status + ': ' + result.statusText)
    }
    else if (response.err) {
      result.err = response.err
    }
    if (null == result.err) {
      result.ok = true
    }
  }

  // Run one operation through the mini pipeline. Mirrors the generated
  // Entity*Op fragment: hook, short-circuit, make*, hook, ...
  async function op(o: {
    entity?: string
    op?: string
    method?: string
    path?: string
    query?: any
    headers?: any
    body?: any
    ctrl?: any
  }): Promise<any> {
    const entity = o.entity || 'widget'
    const opname = o.op || 'load'
    const method = o.method || defaultMethod(opname)

    const ctx = makeCtx({
      op: { name: opname, entity },
      entity: { name: entity },
      ctrl: o.ctrl || {},
    })

    await featureHook(ctx, 'PostConstructEntity')

    try {
      // PrePoint (rbac may deny by setting ctx.out.point to an Error).
      await featureHook(ctx, 'PrePoint')
      if (ctx.out.point instanceof Error) {
        throw ctx.out.point
      }

      // PreSpec.
      await featureHook(ctx, 'PreSpec')
      ctx.spec = ctx.out.spec || {
        method, base, path: o.path || ('/' + entity),
        url: undefined, params: {},
        headers: { ...(spec.headers || {}), ...(o.headers || {}) },
        query: { ...(o.query || {}) },
        body: o.body, step: 'start',
      }

      // PreRequest (idempotency / clienttrack / telemetry / paging inject here).
      await featureHook(ctx, 'PreRequest')
      ctx.spec.url = buildUrl(ctx.spec)

      // makeRequest -> transport (features wrapped utility.fetcher in init).
      let response: any
      if (ctx.out.request) {
        response = ctx.out.request
      }
      else {
        const fetchdef: any = {
          url: ctx.spec.url,
          method: ctx.spec.method,
          headers: ctx.spec.headers,
          body: ctx.spec.body,
        }
        response = await utility.fetcher(ctx, fetchdef.url, fetchdef)
      }
      ctx.response = response

      // PreResponse.
      await featureHook(ctx, 'PreResponse')

      // makeResponse -> result.
      await populateResult(ctx, response)

      // PreResult (paging / streaming read/modify result here).
      await featureHook(ctx, 'PreResult')

      // PreDone.
      await featureHook(ctx, 'PreDone')

      // done(): success returns resdata; failure throws (like makeError).
      if (ctx.result && ctx.result.ok) {
        return { ok: true, data: ctx.result.resdata, result: ctx.result, ctx }
      }
      throw (ctx.result && ctx.result.err) || ctx.error('op_failed', 'operation failed')
    }
    catch (err: any) {
      await featureHook(ctx, 'PreUnexpected')
      return { ok: false, error: err, result: ctx.result, ctx }
    }
  }

  // Fire PostConstruct once, like the generated constructor.
  const boot = featureHook(rootctx, 'PostConstruct')

  return {
    client,
    utility,
    rootctx,
    op,
    ready: async () => { await boot },
    feature: (name: string) => client._features.find((f: any) => f.name === name),
  }
}


export {
  loadFeature,
  loadBase,
  makeClient,
  makeClock,
  makeResponse,
  defaultServer,
}
