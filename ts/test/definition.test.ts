
import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'
import { operationFacts } from '@voxgig/apidef'

import { definitionPlan } from '../dist/sdkgen.js'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


// Lob's shapes: a page composed with allOf, HTTP Basic with the key as the
// user and a blank password, and a path parameter renamed in the model.
const DEF: any = {
  openapi: '3.0.3',
  info: { title: 'lob', version: '1' },
  security: [{ basicAuth: [] }],
  components: { securitySchemes: { basicAuth: { type: 'http', scheme: 'basic' } } },
  paths: {
    '/addresses': {
      get: {
        parameters: [{ in: 'query', name: 'limit', schema: { type: 'integer' } }],
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: { allOf: [{ properties: { count: { type: 'integer' } } }] },
                example: {
                  data: [{ id: 'adr_1' }, { id: 'adr_2' }, { id: 'adr_3' }, { id: 'adr_4' }],
                  object: 'list',
                  count: 4,
                },
              },
            },
          },
        },
      },
    },
    '/addresses/{adr_id}': {
      parameters: [{ in: 'path', name: 'adr_id', required: true, schema: { type: 'string' } }],
      get: {
        responses: {
          '200': {
            content: { 'application/json': { schema: { properties: {
              id: { type: 'string' }, name: { type: 'string' },
            } } } },
          },
        },
      },
      delete: {
        responses: { '200': { content: { 'application/json': { example: { id: 'adr_1', deleted: true } } } } },
      },
    },
  },
}

const MODEL: any = {
  main: { kit: { entity: { address: {
    name: 'address',
    id: { field: 'id', name: 'id' },
    op: {
      list: { points: [{ m: 'GET', o: '/addresses', q: { exist: ['limit'] }, g: { query: [{ n: 'limit' }] } }] },
      load: { points: [{ m: 'GET', o: '/addresses/{adr_id}', q: { exist: ['id'] },
        g: { params: [{ n: 'id', or: 'adr_id' }] }, r: { param: { adr_id: 'id' } } }] },
      remove: { points: [{ m: 'DELETE', o: '/addresses/{adr_id}', q: { exist: ['id'] },
        g: { params: [{ n: 'id', or: 'adr_id' }] } }] },
    },
  } } } },
}

// What apidef publishes for a build: the resolved definition, looked up per point.
const ctx$ = { model: MODEL, meta: { apidef: {
  operation: (m: string, o: string) => operationFacts(DEF, { m, o }),
} } }


describe('definitionPlan', () => {

  const plan = definitionPlan(ctx$)
  const point = (op: string) => plan.find((p: any) => op === p.op)!

  test('one point per operation, read from the definition', () => {
    deepStrictEqual(plan.map((p: any) => p.op + ' ' + p.method + ' ' + p.path), [
      'list GET /addresses',
      'load GET /addresses/{adr_id}',
      'remove DELETE /addresses/{adr_id}',
    ])
  })

  test('the credential comes from the security scheme', () => {
    deepStrictEqual(point('load').auth, [[{ in: 'header', name: 'authorization', scheme: 'basic' }]])
  })

  test('a renamed path parameter keeps its wire name and its model name', () => {
    deepStrictEqual(point('load').args, [{ name: 'id', wire: 'adr_id', value: 'p1' }])
    deepStrictEqual(point('load').query, [])
  })

  // Released apidef writes a snakified `or`, `campaign_id` for `{campaignId}`.
  // The placeholder keeps its place in the path, so position pairs the names.
  test('a path placeholder is paired by position, whatever `or` holds', () => {
    const def = { ...DEF, paths: { '/campaigns/{campaignId}': {
      parameters: [{ in: 'path', name: 'campaignId', required: true, example: 'cmp_1',
        schema: { type: 'string' } }],
      get: { responses: { '200': { content: { 'application/json': { example: { id: 'cmp_1' } } } } } },
    } } }
    const model = { main: { kit: { entity: { campaign: {
      name: 'campaign', id: { field: 'id', name: 'id' },
      op: { load: { points: [{ m: 'GET', o: '/campaigns/{campaignId}', q: { exist: ['id'] },
        s: [{ lit: 'campaigns' }, { var: 'id' }],
        g: { params: [{ n: 'id', or: 'campaign_id' }] }, r: { param: { campaignId: 'id' } } }] } },
    } } } } }
    const [load] = definitionPlan({ model, meta: { apidef: {
      operation: (m: string, o: string) => operationFacts(def, { m, o }),
    } } })
    deepStrictEqual(load.args, [{ name: 'id', wire: 'campaignId', value: 'cmp_1' }])
  })

  test('the example is the sample, three items at most', () => {
    strictEqual(point('list').sample.data.length, 3)
    deepStrictEqual(point('list').query, ['limit'])
    strictEqual(point('list').select.limit, 'v1')
  })

  test('a schema with no example is synthesized', () => {
    deepStrictEqual(point('load').sample, { id: 'x', name: 'x' })
  })

  test('no resolved definition, no plan', () => {
    deepStrictEqual(definitionPlan({ model: MODEL, meta: {} }), [])
  })

  test('a model that switches auth off is not checked for it', () => {
    const off = { ...MODEL, main: { kit: { ...MODEL.main.kit, config: { auth: { active: false } } } } }
    ok(definitionPlan({ ...ctx$, model: off }).every((p: any) => null === p.auth))
  })
})


function loadRunner(): any {
  const file = Path.join(TM, 'ts', 'test', 'definition-runner.ts')
  const js = transform(readFileSync(file, 'utf8'), { transforms: ['typescript', 'imports'] }).code
  const mod: any = { exports: {} }
  new Function('exports', 'require', 'module', js)(mod.exports, require, mod)
  return mod.exports
}


// An SDK stand-in whose behaviour is a switch, so each defect the runner
// exists to catch can be switched on alone.
function fakeSDK(defect: '' | 'basic-blank' | 'unwrap' | 'query-echo') {
  return class {
    opts: any
    constructor(opts: any) { this.opts = opts }

    Address() {
      const opts = this.opts
      const send = async (method: string, path: string, match: any, query: any) => {
        const headers: any = {}
        if ('basic-blank' !== defect) {
          headers.authorization = 'Basic ' + Buffer.from(opts.apikey + ':').toString('base64')
        }
        const qs = new URLSearchParams(query).toString()
        const res = await opts.system.fetch(opts.base + path + (qs ? '?' + qs : ''),
          { method, headers })
        return res.json()
      }
      const wrap = (rec: any) => ({ data: () => rec })
      return {
        list: async (match: any) => {
          const body = await send('GET', '/addresses', match, { limit: match.limit })
          const records = 'unwrap' === defect ? body : body.data
          return Array.isArray(records) ? records.map(wrap) : []
        },
        load: async (match: any) => {
          const query = 'query-echo' === defect ? { id: match.id } : {}
          return wrap(await send('GET', '/addresses/' + match.id, match, query))
        },
        remove: async (match: any) => {
          return wrap(await send('DELETE', '/addresses/' + match.id, match, {}))
        },
      }
    }
  }
}


for (const [lang, runner] of [
  ['ts', loadRunner()],
  ['js', require(Path.join(TM, 'js', 'test', 'definition-runner.js'))],
] as [string, any][]) {
  describe(lang + ' definition runner', () => {

    const { runDefinitionPoint } = runner
    const plan = definitionPlan(ctx$)
    const point = (op: string) => plan.find((p: any) => op === p.op)!

    test('a correct SDK passes every point', async () => {
      for (const p of plan) {
        await runDefinitionPoint(fakeSDK(''), p)
      }
    })

    test('catches Basic auth dropped for a blank password', async () => {
      await rejects(runDefinitionPoint(fakeSDK('basic-blank'), point('load')),
        /credential not sent as the definition declares it/)
    })

    test('catches a list read at the envelope instead of its records', async () => {
      await rejects(runDefinitionPoint(fakeSDK('unwrap'), point('list')),
        /list read 0 records where the definition example holds 3/)
    })

    test('catches a path parameter echoed into the query', async () => {
      await rejects(runDefinitionPoint(fakeSDK('query-echo'), point('load')),
        /query parameter not in the definition: id/)
    })
  })
}
