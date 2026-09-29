
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

  // Lob's uploads, where a list point selected by `campaign_id` sits beside
  // one selected by nothing. The latter's test leaves `campaign_id` out.
  const uploads = (listOp: any) => {
    const def = { ...DEF, paths: { '/uploads': { get: {
      parameters: [{ in: 'query', name: 'campaignId' }, { in: 'query', name: 'resource_ids' }],
      responses: { '200': { content: { 'application/json': { example: [] } } } },
    } } } }
    const model = { main: { kit: { entity: { upload: {
      name: 'upload', id: { field: 'id', name: 'id' }, op: { list: listOp },
    } } } } }
    return definitionPlan({ model, meta: { apidef: {
      operation: (m: string, o: string) => operationFacts(def, { m, o }),
    } } })
  }
  const query = [{ n: 'campaign_id', or: 'campaignId' }, { n: 'resource_id', or: 'resource_ids' }]

  test('every query argument is sent, in the model spelling', () => {
    const [list] = uploads({ points: [{ m: 'GET', o: '/uploads', g: { query } }] })
    deepStrictEqual(list.select, { campaign_id: 'v1', resource_id: 'v1' })
    deepStrictEqual(list.query, ['campaignId', 'resource_ids'])
  })

  test('a query argument another point selects on stays out', () => {
    const plan = uploads({ points: [
      { m: 'GET', o: '/uploads', q: { exist: ['campaign_id'] }, g: { query } },
      { m: 'GET', o: '/uploads', g: { query } },
    ] })
    deepStrictEqual(plan.map((p: any) => p.select), [
      { campaign_id: 'v1', resource_id: 'v1' },
      { resource_id: 'v1' },
    ])
  })

  test('an inactive operation is left out', () => {
    deepStrictEqual(uploads({ active: false, points: [{ m: 'GET', o: '/uploads' }] }), [])
  })

  // Novu's workflow has a patch beside its update, and no target generates a
  // patch method to call.
  test('an operation no target generates is left out', () => {
    const def = { ...DEF, paths: { '/workflows/{id}': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      put: { responses: { '200': { content: { 'application/json': { example: { id: 'w1' } } } } } },
      patch: { responses: { '200': { content: { 'application/json': { example: { id: 'w1' } } } } } },
    } } }
    const g = { params: [{ n: 'id', or: 'id' }] }
    const model = { main: { kit: { entity: { workflow: {
      name: 'workflow', id: { field: 'id', name: 'id' }, op: {
        update: { points: [{ m: 'PUT', o: '/workflows/{id}', q: { exist: ['id'] }, g }] },
        patch: { points: [{ m: 'PATCH', o: '/workflows/{id}', q: { exist: ['id'] }, g }] },
      },
    } } } } }
    const plan = definitionPlan({ model, meta: { apidef: {
      operation: (m: string, o: string) => operationFacts(def, { m, o }),
    } } })
    deepStrictEqual(plan.map((p: any) => p.op), ['update'])
  })

  // Novu selects every point on its `idempotency-key` header. The argument
  // is sent, as a header, never as a selector in the query.
  test('a header argument is planned under its definition name', () => {
    const def = { ...DEF, paths: { '/uploads': { get: {
      parameters: [{ in: 'header', name: 'Idempotency-Key', example: 'k-1' }],
      responses: { '200': { content: { 'application/json': { example: [] } } } },
    } } } }
    const model = { main: { kit: { entity: { upload: {
      name: 'upload', id: { field: 'id', name: 'id' }, op: { list: { points: [{
        m: 'GET', o: '/uploads', q: { exist: ['idempotency_key'] },
        g: { header: [{ n: 'idempotency_key', or: 'Idempotency-Key' }] },
      }] } },
    } } } } }
    const [list] = definitionPlan({ model, meta: { apidef: {
      operation: (m: string, o: string) => operationFacts(def, { m, o }),
    } } })
    deepStrictEqual(list.headers, [{ name: 'idempotency_key', wire: 'Idempotency-Key', value: 'k-1' }])
    deepStrictEqual(list.select, {})
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

  // LearnWorlds declares no security scheme, and an Authorization header
  // parameter on every operation. The SDK's credential goes in that header.
  test('a header parameter in the credential header is left to the credential', () => {
    const def = { ...DEF, security: undefined, components: {}, paths: { '/courses': { get: {
      parameters: [
        { in: 'header', name: 'Authorization', schema: { type: 'string' } },
        { in: 'header', name: 'Lw-Client', schema: { type: 'string' } },
      ],
      responses: { '200': { content: { 'application/json': { example: [] } } } },
    } } } }
    const model = { main: { kit: { info: { auth: false }, entity: { course: {
      name: 'course', id: { field: 'id' }, op: { list: { points: [{ m: 'GET', o: '/courses',
        g: { header: [{ n: 'authorization', or: 'Authorization' }, { n: 'lw_client', or: 'Lw-Client' }] },
      }] } },
    } } } } }
    const [list] = definitionPlan({ model, meta: { apidef: {
      operation: (m: string, o: string) => operationFacts(def, { m, o }),
    } } })
    deepStrictEqual(list.headers, [{ name: 'lw_client', wire: 'Lw-Client', value: 'h1' }])
  })

  // Petstore secures its pets with OAuth and its store with an API key, and
  // its SDK sends the API key. A pet operation cannot be checked for OAuth.
  test('only the alternatives the SDK scheme meets are checked', () => {
    const def = { ...DEF, security: undefined,
      components: { securitySchemes: {
        api_key: { type: 'apiKey', in: 'header', name: 'api_key' },
        petstore_auth: { type: 'oauth2', flows: {} },
      } },
      paths: {
        '/pet': { get: { security: [{ petstore_auth: [] }],
          responses: { '200': { content: { 'application/json': { example: [] } } } } } },
        '/store': { get: { security: [{ api_key: [] }],
          responses: { '200': { content: { 'application/json': { example: [] } } } } } },
        '/either': { get: { security: [{ petstore_auth: [] }, { api_key: [] }],
          responses: { '200': { content: { 'application/json': { example: [] } } } } } },
      } }
    const list = (o: string) => ({ list: { points: [{ m: 'GET', o }] } })
    const model = { main: { kit: {
      info: { security: { scheme: 'api_key', type: 'apiKey', in: 'header', name: 'api_key' } },
      entity: {
        pet: { name: 'pet', id: { field: 'id' }, op: list('/pet') },
        store: { name: 'store', id: { field: 'id' }, op: list('/store') },
        either: { name: 'either', id: { field: 'id' }, op: list('/either') },
      },
    } } }
    const plan = definitionPlan({ model, meta: { apidef: {
      operation: (m: string, o: string) => operationFacts(def, { m, o }),
    } } })
    const api = [[{ in: 'header', name: 'api_key' }]]
    deepStrictEqual(Object.fromEntries(plan.map((p: any) => [p.entity, p.auth])),
      { pet: null, store: api, either: api })
  })

  // GitHub writes the example of its page of deployment rule apps as a list
  // of the page's parts, where the schema is an object.
  test('an example that contradicts its schema is no sample', () => {
    const page = { type: 'object', properties: { total_count: { type: 'integer' },
      apps: { type: 'array', items: { type: 'object' } } } }
    const def = { ...DEF, paths: { '/apps': { get: { responses: { '200': { content: {
      'application/json': { schema: page, example: [{ total_count: 1 }, { apps: [{ id: 1 }] }] },
    } } } } }, '/apps/{id}': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      get: { responses: { '200': { content: { 'application/json': {
        schema: { type: 'array', items: { type: 'object' } }, example: { id: 1 },
      } } } } },
    } } }
    const model = { main: { kit: { entity: { app: {
      name: 'app', id: { field: 'id' }, op: {
        list: { points: [{ m: 'GET', o: '/apps' }] },
        load: { points: [{ m: 'GET', o: '/apps/{id}', q: { exist: ['id'] },
          g: { params: [{ n: 'id', or: 'id' }] } }] },
      },
    } } } } }
    const plan = definitionPlan({ model, meta: { apidef: {
      operation: (m: string, o: string) => operationFacts(def, { m, o }),
    } } })
    deepStrictEqual(plan.map((p: any) => p.sample), [null, null])
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
function fakeSDK(defect: '' | 'basic-blank' | 'basic-password' | 'unwrap' | 'query-echo' |
  'query-name' | 'header-query' | 'header-drop') {
  return class {
    opts: any
    constructor(opts: any) { this.opts = opts }

    Address() {
      const opts = this.opts
      const send = async (method: string, path: string, match: any, query: any) => {
        const headers: any = {}
        if ('basic-blank' !== defect) {
          const pass = 'basic-password' === defect ? 'x' : ''
          headers.authorization = 'Basic ' + Buffer.from(opts.apikey + ':' + pass).toString('base64')
        }
        if (undefined !== match.idempotency_key) {
          if ('header-query' === defect) query = { ...query, idempotency_key: match.idempotency_key }
          else if ('header-drop' !== defect) headers['idempotency-key'] = match.idempotency_key
        }
        const qs = new URLSearchParams(Object.entries(query)
          .filter(([, v]) => undefined !== v) as [string, string][]).toString()
        const res = await opts.system.fetch(opts.base + path + (qs ? '?' + qs : ''),
          { method, headers })
        return res.json()
      }
      const wrap = (rec: any) => ({ data: () => rec })
      return {
        list: async (match: any) => {
          const name = 'query-name' === defect ? 'resource_id' : 'resource_ids'
          const body = await send('GET', '/addresses', match,
            { limit: match.limit, [name]: match.resource_id })
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

    test('catches a password the client was never given', async () => {
      await rejects(runDefinitionPoint(fakeSDK('basic-password'), point('load')),
        /credential not sent as the definition declares it/)
    })

    test('catches a query parameter sent in the model spelling', async () => {
      const p = { ...point('list'), select: { limit: 2, resource_id: 'r1' },
        query: ['limit', 'resource_ids'] }
      await runDefinitionPoint(fakeSDK(''), p)
      await rejects(runDefinitionPoint(fakeSDK('query-name'), p),
        /query parameter not in the definition: resource_id/)
    })

    test('catches a list read at the envelope instead of its records', async () => {
      await rejects(runDefinitionPoint(fakeSDK('unwrap'), point('list')),
        /list read 0 records where the definition example holds 3/)
    })

    test('catches a path parameter echoed into the query', async () => {
      await rejects(runDefinitionPoint(fakeSDK('query-echo'), point('load')),
        /query parameter not in the definition: id/)
    })

    const withHeader = () => ({ ...point('load'),
      headers: [{ name: 'idempotency_key', wire: 'Idempotency-Key', value: 'k1' }] })

    test('a header parameter sent as a header passes', async () => {
      await runDefinitionPoint(fakeSDK(''), withHeader())
    })

    test('catches a header parameter sent in the query', async () => {
      await rejects(runDefinitionPoint(fakeSDK('header-query'), withHeader()),
        /query parameter not in the definition: idempotency_key/)
    })

    test('catches a header parameter never sent', async () => {
      await rejects(runDefinitionPoint(fakeSDK('header-drop'), withHeader()),
        /header parameter not sent as a header: Idempotency-Key/)
    })

    // Neon wraps a branch beside the operations the change started.
    test('catches a record read at its envelope', async () => {
      const p = { ...point('load'), entity: 'branch',
        sample: { branch: { id: 'br_1' }, operations: [{ id: 'op_1' }] } }
      await rejects(runDefinitionPoint(fakeSDK(''), p),
        /the entity does not hold the record the definition example returns/)
    })

    // Novu's channel connection names its identity `identifier` and holds a
    // workspace with an `id` of its own, which is not the record's.
    test('a record with data of its own is not read through an inner object', async () => {
      const p = { ...point('load'), sample: { identifier: 'cc_1', workspace: { id: 'T1' } } }
      await runDefinitionPoint(fakeSDK(''), p)
    })

    // Apicurio's GitOps status is one record that holds a list of errors.
    test('a record that holds a list is not a page', async () => {
      const p = { ...point('list'), sample: { sync_state: 'IDLE', errors: [{ detail: 'x' }] } }
      await runDefinitionPoint(fakeSDK(''), p)
    })

    // A key that only contains a paging word is data, not paging.
    test('a record whose fields mention paging is not a page', async () => {
      const p = { ...point('list'), sample: { homepage: 'h', preview: 'p', errors: [{ detail: 'x' }] } }
      await runDefinitionPoint(fakeSDK(''), p)
    })

    // GitHub's check suite preferences hold the repository they belong to,
    // which has an `id` of its own.
    test('an object beside other data is not read as an envelope', async () => {
      const p = { ...point('load'), entity: 'check_suite_preference',
        sample: { preferences: { auto_trigger_checks: [] }, repository: { id: 7 } } }
      await runDefinitionPoint(fakeSDK(''), p)
    })

    // GitLab writes a NuGet route as `Packages\(\)`, which the URL parser
    // turns into slashes on the way out, for every client alike.
    test('a route is compared as the URL parser reads it', async () => {
      const p = { ...point('load'), path: '/packages\\(\\)', args: [], select: {}, sample: null }
      const sdk = (path: string) => class {
        opts: any
        constructor(opts: any) { this.opts = opts }
        Address() {
          return { load: async () => {
            const auth = 'Basic ' + Buffer.from(this.opts.apikey + ':').toString('base64')
            await this.opts.system.fetch(this.opts.base + path,
              { method: 'GET', headers: { authorization: auth } })
            return { data: () => ({}) }
          } }
        }
      }
      await runDefinitionPoint(sdk('/packages\\(\\)'), p)
      await rejects(runDefinitionPoint(sdk('/packages'), p), /route/)
    })
  })
}
