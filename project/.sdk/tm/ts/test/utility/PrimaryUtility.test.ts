
import { test, describe, before } from 'node:test'
import { equal, deepStrictEqual, ok } from 'node:assert'
import assert from 'node:assert'

import {
  makeRunner,
} from '../runner'

import {
  SDK,
  TEST_JSON_FILE
} from './index'


describe('PrimaryUtility', async () => {

  let spec: any
  let runset: any
  let runsetflags: any
  let client: any
  let utility: any
  let struct: any


  // Ensure ctx has options derived from client when needed.
  function fixctx(ctx: any) {
    if (ctx && ctx.client && null == ctx.options) {
      ctx.options = ctx.client.options()
    }
  }


  before(async () => {
    const runner = await makeRunner(TEST_JSON_FILE, await SDK.test())
    const run = await runner('primary')

    spec = run.spec
    runset = run.runset
    runsetflags = run.runsetflags
    client = run.client
    utility = client.utility()
    struct = utility.struct
  })


  test('exists', () => {
    const fns = [
      'clean', 'done', 'makeError', 'featureAdd', 'featureHook', 'featureInit',
      'fetcher', 'makeFetchDef', 'makeContext', 'makeOptions', 'makeRequest',
      'makeResponse', 'makeResult', 'makeTarget', 'makeSpec', 'makeUrl',
      'param', 'prepareAuth', 'prepareBody', 'prepareHeaders', 'prepareMethod',
      'prepareParams', 'preparePath', 'prepareQuery', 'resultBasic',
      'resultBody', 'resultHeaders', 'transformRequest', 'transformResponse',
    ]

    for (const fn of fns) {
      equal('function', typeof utility[fn], fn + ' should be a function')
    }
  })


  test('context-basic', async () => {
    await runset(spec.context.basic, utility.makeContext)
  })


  test('method-basic', async () => {
    await runset(spec.method.basic, utility.prepareMethod)
  })


  test('headers-basic', async () => {
    await runset(spec.headers.basic, utility.prepareHeaders)
  })


  test('auth-basic', async () => {
    const sdkopts = spec.auth?.DEF?.setup?.a || {}
    const authClient = SDK.test({}, sdkopts)
    await runset(spec.auth.basic, (ctx: any) => {
      ctx.client = authClient
      fixctx(ctx)
      return utility.prepareAuth(ctx)
    })
  })


  test('params-basic', async () => {
    await runset(spec.params.basic, utility.prepareParams)
  })


  test('query-basic', async () => {
    await runset(spec.query.basic, utility.prepareQuery)
  })


  test('body-basic', async () => {
    await runset(spec.body.basic, (ctx: any) => {
      fixctx(ctx)
      return utility.prepareBody(ctx)
    })
  })


  test('findparam-basic', async () => {
    await runset(spec.findparam.basic, utility.param)
  })


  test('fullurl-basic', async () => {
    await runset(spec.fullurl.basic, utility.makeUrl)
  })


  test('operator-basic', async () => {
    await runset(spec.operator.basic, (opmap: any) => ({
      entity: opmap.entity || '_',
      name: opmap.name || '_',
      input: opmap.input || '_',
      targets: opmap.targets || [],
    }))
  })


  test('options-basic', async () => {
    await runset(spec.options.basic, (vin: any) => {
      const ctx = utility.makeContext({ options: vin.options, config: vin.config })
      ctx.client = client
      ctx.utility = utility
      return utility.makeOptions(ctx)
    })
  })


  test('spec-basic', async () => {
    const sdkopts = spec.spec?.DEF?.setup?.a || {}
    const specClient = SDK.test({}, sdkopts)
    await runset(spec.spec.basic, (ctx: any) => {
      ctx.client = specClient
      ctx.options = specClient.options()
      return utility.makeSpec(ctx)
    })
  })


  test('reqform-basic', async () => {
    await runset(spec.reqform.basic, utility.transformRequest)
  })


  test('resform-basic', async () => {
    await runset(spec.resform.basic, utility.transformResponse)
  })


  test('resbasic-basic', async () => {
    await runset(spec.resbasic.basic, (ctx: any) => {
      fixctx(ctx)
      return utility.resultBasic(ctx)
    })
  })


  test('resheaders-basic', async () => {
    await runset(spec.resheaders.basic, (ctx: any) => {
      // Convert plain headers map to forEach-based (browser Response API)
      if (ctx.response?.headers && !ctx.response.headers.forEach) {
        const h = ctx.response.headers
        ctx.response.headers = {
          forEach: (cb: any) => Object.entries(h).forEach(([k, v]) => cb(v, k.toLowerCase()))
        }
      }
      return utility.resultHeaders(ctx)
    })
  })


  test('resbody-basic', async () => {
    await runset(spec.resbody.basic, async (ctx: any) => {
      if (ctx.response && !ctx.response.json) {
        const body = ctx.response.body
        ctx.response.json = async () => body
      }
      return utility.resultBody(ctx)
    })
  })


  test('request-basic', async () => {
    const mockFetch = async (url: string, init: any) => ({
      status: 200,
      statusText: 'OK',
      headers: { forEach: (cb: any) => { cb('application/json', 'content-type', {}) } },
      json: async () => ({ id: 'res01' }),
      body: 'present',
    })
    const reqClient = new (SDK as any)({
      system: { fetch: mockFetch }
    })
    await runset(spec.request.basic, async (ctx: any) => {
      ctx.client = reqClient
      ctx.utility = reqClient._utility || utility
      ctx.options = reqClient.options()
      return utility.makeRequest(ctx)
    })
  })


  test('response-basic', async () => {
    await runset(spec.response.basic, async (ctx: any) => {
      fixctx(ctx)
      // Add json() and forEach to response for proper TS handling
      if (ctx.response && !ctx.response.json) {
        const body = ctx.response.body
        ctx.response.json = async () => body
      }
      if (ctx.response?.headers && !ctx.response.headers.forEach) {
        const h = ctx.response.headers
        ctx.response.headers = {
          forEach: (cb: any) => Object.entries(h).forEach(([k, v]) => cb(v, k.toLowerCase()))
        }
      }
      return utility.makeResponse(ctx)
    })
  })


  test('done-basic', async () => {
    await runset(spec.done.basic, (ctx: any) => {
      fixctx(ctx)
      return utility.done(ctx)
    })
  })


  test('error-basic', async () => {
    await runset(spec.error.basic, (...args: any[]) => {
      const ctx = args[0]
      fixctx(ctx)
      return utility.makeError(...args)
    })
  })


  test('makeTarget-single', () => {
    const ctx = makeCtx()
    const target = {
      parts: ['items', '{id}'],
      args: { params: [] },
      params: [],
      alias: {},
      select: {},
      active: true,
      transform: { req: undefined, res: undefined },
    }
    ctx.op.targets = [target]

    const result = utility.makeTarget(ctx)
    ok(!(result instanceof Error))
    equal(ctx.target, target)
  })


  test('makeFetchDef', () => {
    const ctx = makeFullCtx()
    ctx.spec = {
      base: 'http://localhost:8080',
      prefix: '/api',
      path: 'items/{id}',
      suffix: '',
      params: { id: 'item01' },
      query: {},
      headers: { 'content-type': 'application/json' },
      method: 'GET',
      step: 'start',
      body: undefined,
    } as any

    const fetchdef = utility.makeFetchDef(ctx)
    ok(!(fetchdef instanceof Error), 'should not be error')
    equal(fetchdef.method, 'GET')
    ok(fetchdef.url.includes('/api/items/item01'))
    equal(fetchdef.headers['content-type'], 'application/json')
    ok(null == fetchdef.body)
  })


  test('makeFetchDef-with-body', () => {
    const ctx = makeFullCtx()
    ctx.spec = {
      base: 'http://localhost:8080',
      prefix: '',
      path: 'items',
      suffix: '',
      params: {},
      query: {},
      headers: {},
      method: 'POST',
      step: 'start',
      body: { name: 'test' },
    } as any

    const fetchdef = utility.makeFetchDef(ctx)
    ok(!(fetchdef instanceof Error))
    equal(fetchdef.method, 'POST')
    equal(fetchdef.body, '{"name":"test"}')
  })


  test('featureAdd', () => {
    const ctx = makeCtx()
    const startLen = client._features.length

    const feature = {
      version: '0.0.1',
      name: 'testfeat',
      active: true,
      init: () => { },
    }

    utility.featureAdd(ctx, feature)
    equal(client._features.length, startLen + 1)
    equal(client._features[client._features.length - 1].name, 'testfeat')
  })


  test('featureHook', () => {
    const ctx = makeCtx()

    let called = false
    client._features = [{
      name: 'hookfeat',
      TestHook: () => { called = true },
    }]

    utility.featureHook(ctx, 'TestHook')
    equal(called, true)
  })


  test('featureInit', () => {
    const ctx = makeCtx()

    let initCalled = false
    const feature: any = {
      name: 'initfeat',
      active: true,
      init: () => { initCalled = true },
    }

    ctx.options.feature.initfeat = { active: true }

    utility.featureInit(ctx, feature)
    equal(initCalled, true)
  })


  test('featureInit-inactive', () => {
    const ctx = makeCtx()

    let initCalled = false
    const feature: any = {
      name: 'nofeat',
      active: false,
      init: () => { initCalled = true },
    }

    ctx.options.feature.nofeat = { active: false }

    utility.featureInit(ctx, feature)
    equal(initCalled, false)
  })


  test('fetcher-live', async () => {
    const calls: any[] = []
    const liveClient = new (SDK as any)({
      system: {
        fetch: async (url: string, init: any) => {
          calls.push({ url, init })
          return { status: 200, statusText: 'OK' }
        }
      }
    })
    const ctx = makeCtx({ client: liveClient })

    const fetchdef = { method: 'GET', headers: {} }
    const response = await utility.fetcher(ctx, 'http://example.com/test', fetchdef)
    ok(!(response instanceof Error))
    equal(calls.length, 1)
    equal(calls[0].url, 'http://example.com/test')
  })


  test('fetcher-blocked-test-mode', async () => {
    const testClient = new (SDK as any)({
      system: { fetch: async () => ({}) }
    })
    testClient._mode = 'test'

    const ctx = makeCtx({ client: testClient })
    const fetchdef = { method: 'GET', headers: {} }

    try {
      await utility.fetcher(ctx, 'http://example.com/test', fetchdef)
      assert.fail('should throw')
    }
    catch (err: any) {
      ok(err.message.includes('mode'))
    }
  })


  test('makeError-no-throw', () => {
    const ctx = makeFullCtx()
    ctx.ctrl.throw = false
    ctx.result = { ok: false, resdata: { id: 'safe01' } } as any

    const out = utility.makeError(ctx, ctx.error('test_code', 'test message'))
    deepStrictEqual(out, { id: 'safe01' })
  })


  test('clean', () => {
    const ctx = makeFullCtx()
    const val = { key: 'secret123', name: 'test' }
    const cleaned = utility.clean(ctx, val)
    ok(null != cleaned)
  })


  // Helper functions for manual tests
  function makeCtx(overrides?: any) {
    return utility.makeContext({
      opname: 'load',
      ...overrides,
    }, client._rootctx)
  }


  function makeFullCtx(overrides?: any) {
    const ctx = makeCtx(overrides)
    ctx.target = {
      parts: ['items', '{id}'],
      args: { params: [{ name: 'id', reqd: true }] },
      params: ['id'],
      alias: {},
      select: {},
      active: true,
      relations: [],
      transform: { req: undefined, res: undefined },
    }
    ctx.match = { id: 'item01' }
    ctx.reqmatch = { id: 'item01' }
    return ctx
  }

})
