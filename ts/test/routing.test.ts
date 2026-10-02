
import { test, describe } from 'node:test'
import { ok, deepStrictEqual, strictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'

import * as struct from '@voxgig/struct'

import { configDefinition } from '../dist/sdkgen'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


// A ts template, with its sibling imports loaded from the templates beside it.
function loadTs(rel: string): any {
  const file = Path.join(TM, rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code

  const req = (p: string) => '../types' === p ? {} : p.startsWith('.') ?
    loadTs(Path.relative(TM, Path.resolve(Path.dirname(file), p)) + '.ts') : require(p)

  const mod: any = { exports: {} }
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}


const STEPS = [
  'MakePoint', 'Param', 'PrepareParams', 'PrepareQuery', 'PrepareHeaders',
  'TransformRequest', 'MakeUrl',
]

const PIPES: Record<string, any> = {
  ts: Object.assign({}, ...STEPS.map((s) => loadTs('ts/src/utility/' + s + 'Utility.ts'))),
  js: Object.assign({}, ...STEPS.map((s) =>
    require(Path.join(TM, 'js', 'src', 'utility', s + 'Utility.js')))),
}


// Points as apidef writes them, made runtime config by configDefinition, the
// function every generated SDK's config comes from.
function points(entity: string, opname: string, mpoints: any[]): any[] {
  const model = {
    const: { Name: 'Umbrella' },
    main: {
      kit: {
        entity: {
          [entity]: { name: entity, fields: {}, op: { [opname]: { name: opname, points: mpoints } } },
        },
        config: { headers: {} },
        info: { servers: [{ url: 'https://api.test' }] },
      },
    },
  }
  return configDefinition(model as any).def.entity[entity].op[opname].points
}


function seg(path: string): any[] {
  return path.split('/').filter((s) => '' !== s)
    .map((s) => /^\{[^{}]+\}$/.test(s) ? { var: s.slice(1, -1) } : { lit: s })
}


function arg(k: string, n: string, or: string, r = true): any {
  return { k, n, or, r, t: '`$STRING`' }
}


const TRANSFORM = { req: '`reqdata`', res: '`body`' }


// A call through the shipped templates, as the entity operation runs them,
// stopping at the URL the fetcher would be given.
function call(lang: string, opname: string, opoints: any[], args: any, stored: any = {}) {
  const pipe = PIPES[lang]
  const input = 'create' === opname || 'update' === opname ? 'data' : 'match'

  const ctx: any = {
    out: {},
    op: { name: opname, input, points: opoints },
    options: { allow: { op: opname } },
    client: { options: () => ({ headers: {} }) },
    utility: { struct, param: pipe.param, makeError: (_c: any, err: any) => { throw err } },
    match: stored.match || {},
    data: stored.data || {},
    reqmatch: 'match' === input ? args : {},
    reqdata: 'data' === input ? args : {},
    result: {},
    error: (code: string, msg: string) => Object.assign(new Error(msg), { code }),
  }

  const point = pipe.makePoint(ctx)
  if (point instanceof Error) {
    return point
  }

  ctx.spec = {
    base: 'https://api.test', prefix: '', suffix: '', alias: {},
    path: struct.join(point.parts, '/', true),
    params: pipe.prepareParams(ctx),
    query: pipe.prepareQuery(ctx),
    headers: pipe.prepareHeaders(ctx),
  }

  if ('data' === input) {
    ctx.spec.body = pipe.transformRequest(ctx)
  }

  const url = pipe.makeUrl(ctx)
  if (url instanceof Error) {
    return url
  }

  return {
    method: point.method,
    url,
    path: url.split('?')[0].replace('https://api.test', ''),
    query: ctx.spec.query,
    headers: ctx.spec.headers,
    body: ctx.spec.body,
  }
}


// LINK Mobility's Permission API: an optional `apiKey` on every route keeps
// either remove route from matching unless the caller passes the deprecated
// key, which leaves the choice to the fallback.
const REMOVE = points('permission', 'remove', [
  {
    m: 'DELETE', o: '/public/database/{id}/permission/{msisdn}',
    s: seg('/public/database/{database_id}/permission/{id}'),
    g: {
      params: [arg('param', 'database_id', 'id'), arg('param', 'id', 'msisdn')],
      query: [arg('query', 'api_key', 'apiKey', false)],
    },
    q: { exist: ['api_key', 'database_id', 'id'] },
    t: TRANSFORM,
  },
  {
    m: 'DELETE', o: '/public/database/{id}/permission/permanent/{msisdn}',
    s: seg('/public/database/{database_id}/permission/permanent/{msisdn}'),
    g: {
      params: [arg('param', 'database_id', 'id'), arg('param', 'msisdn', 'msisdn')],
      query: [arg('query', 'api_key', 'apiKey', false)],
    },
    q: { exist: ['api_key', 'database_id', 'msisdn'] },
    t: TRANSFORM,
  },
])


const CREATE = points('paginated_permission_list', 'create', [
  {
    m: 'POST', o: '/public/database/{id}/permission/paged/list',
    s: seg('/public/database/{database_id}/permission/paged/list'),
    g: {
      params: [arg('param', 'database_id', 'id')],
      query: [arg('query', 'api_key', 'apiKey', false)],
      header: [arg('header', 'idempotency_key', 'Idempotency-Key', false)],
    },
    q: { exist: ['api_key', 'database_id', 'idempotency_key'] },
    t: TRANSFORM,
  },
])


describe('routing: the fallback takes a route the call can fill', () => {

  test('the runtime points carry what the fallback reads', () => {
    deepStrictEqual(REMOVE.map((p: any) => p.parts), [
      ['public', 'database', '{database_id}', 'permission', '{id}'],
      ['public', 'database', '{database_id}', 'permission', 'permanent', '{msisdn}'],
    ])
    deepStrictEqual(REMOVE[0].select.exist, ['api_key', 'database_id', 'id'])
  })

  for (const lang of Object.keys(PIPES)) {

    // Sent as DELETE /public/database/1/permission/{id}?msisdn=4712345678.
    test(lang + ': a call without {id} takes the route its msisdn fills', () => {
      deepStrictEqual(call(lang, 'remove', REMOVE, { database_id: 1, msisdn: '4712345678' }), {
        method: 'DELETE',
        url: 'https://api.test/public/database/1/permission/permanent/4712345678',
        path: '/public/database/1/permission/permanent/4712345678',
        query: {},
        headers: {},
        body: undefined,
      })
    })


    test(lang + ': a call that fills no route is refused, naming what is missing', () => {
      const err: any = call(lang, 'remove', REMOVE, { database_id: 1 })
      ok(err instanceof Error, 'a request was built: ' + JSON.stringify(err))
      strictEqual((err as any).code, 'point_no_match')
      ok(err.message.includes('"remove"'), err.message)
      ok(err.message.includes('missing: id'), err.message)
    })


    test(lang + ': a call that matches a route is unchanged', () => {
      const out: any = call(lang, 'remove', REMOVE, { database_id: 1, id: '4712345678', api_key: 'x' })
      strictEqual(out.path, '/public/database/1/permission/4712345678')
      deepStrictEqual(out.query, { apiKey: 'x' })
    })


    test(lang + ': the entity\'s stored match fills a route as before', () => {
      const out: any = call(lang, 'remove', REMOVE, {},
        { match: { database_id: 1, id: '4712345678' } })
      strictEqual(out.path, '/public/database/1/permission/4712345678')
    })


    test(lang + ': a single route called without its {id} is an error, not a request', () => {
      const load = points('planet', 'load', [{
        m: 'GET', o: '/planet/{id}', s: seg('/planet/{id}'),
        g: { params: [arg('param', 'id', 'id')] }, q: { exist: ['id'] }, t: TRANSFORM,
      }])
      const err: any = call(lang, 'load', load, {})
      ok(err instanceof Error, 'a request was built: ' + JSON.stringify(err))
      strictEqual((err as any).code, 'url_param_missing')
      ok(err.message.includes('{id}'), err.message)
    })


    // param() reads a path parameter under the point's alias too, so the
    // route the alias fills is the one taken, and filled.
    test(lang + ': a path parameter given under its alias fills that route', () => {
      const aliased = REMOVE.map((p: any, i: number) =>
        0 === i ? { ...p, alias: { id: 'number' } } : p)
      const out: any = call(lang, 'remove', aliased, { database_id: 1, number: '4712345678' })
      ok(!(out instanceof Error), String(out?.message))
      strictEqual(out.path, '/public/database/1/permission/4712345678')
    })


    test(lang + ': a call without an action is refused when every route is one', () => {
      const list = points('signal', 'list', [
        { m: 'GET', o: '/signal/strong', s: seg('/signal/strong'), g: {}, q: { exist: [], $action: 'strong' }, t: TRANSFORM },
        { m: 'GET', o: '/signal/weak', s: seg('/signal/weak'), g: {}, q: { exist: [], $action: 'weak' }, t: TRANSFORM },
      ])
      const err: any = call(lang, 'list', list, {})
      ok(err instanceof Error, 'a request was built: ' + JSON.stringify(err))
      strictEqual((err as any).code, 'point_action_required')
      strictEqual(err.message, 'Operation "list" has only action endpoints; pass $action to choose one.')
      strictEqual((call(lang, 'list', list, { $action: 'weak' }) as any).path, '/signal/weak')
    })


    test(lang + ': a lone action route is taken without one', () => {
      const list = points('signal', 'list', [
        { m: 'GET', o: '/signal/strong', s: seg('/signal/strong'), g: {}, q: { exist: [], $action: 'strong' }, t: TRANSFORM },
      ])
      strictEqual((call(lang, 'list', list, {}) as any).path, '/signal/strong')
    })


    // A placeholder that shares its segment with other text is kept as a
    // literal by the model, so nothing fills it.
    test(lang + ': a placeholder inside a segment is an error, not a request', () => {
      const list = points('thread_id', 'list', [{
        m: 'GET', o: '/{board}/thread/{threadId}.json',
        s: [{ var: 'board' }, { lit: 'thread' }, { lit: '{threadId}.json' }],
        g: { params: [arg('param', 'board', 'board'), arg('param', 'thread_id', 'threadId')] },
        q: { exist: ['board', 'thread_id'] }, t: TRANSFORM,
      }])
      const err: any = call(lang, 'list', list, { board: 'p1', thread_id: 'p2' })
      ok(err instanceof Error, 'a request was built: ' + JSON.stringify(err))
      strictEqual((err as any).code, 'url_param_missing')
      ok(err.message.includes('{threadId}'), err.message)
    })
  }
})


describe('routing: an argument travels where the definition puts it', () => {

  for (const lang of Object.keys(PIPES)) {

    // Sent as body={"api_key":"x","database_id":1}, with no query string.
    test(lang + ': a create sends its query argument in the query, not the body', () => {
      const args = { database_id: 1, api_key: 'x', idempotency_key: 'k1', page: 2 }
      const before = JSON.stringify(args)

      deepStrictEqual(call(lang, 'create', CREATE, args), {
        method: 'POST',
        url: 'https://api.test/public/database/1/permission/paged/list?apiKey=x',
        path: '/public/database/1/permission/paged/list',
        query: { apiKey: 'x' },
        headers: { 'idempotency-key': 'k1' },
        body: { database_id: 1, page: 2 },
      })
      strictEqual(JSON.stringify(args), before, 'the caller\'s data was changed')
    })


    test(lang + ': the entity\'s stored data never supplies a query argument', () => {
      const out: any = call(lang, 'create', CREATE, { database_id: 1 },
        { data: { api_key: 'stored', idempotency_key: 'stored' } })
      deepStrictEqual(out.query, {})
      deepStrictEqual(out.headers, {})
      deepStrictEqual(out.body, { database_id: 1 })
    })
  }
})
