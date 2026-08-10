/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

// GraphQL transport tests.
//
// The transport lives in a shipped TEMPLATE (project/.sdk/tm/ts/src/utility/
// GraphqlUtility.ts) that only compiles inside a generated SDK, so it is
// outside sdkgen's own tsconfig. Load it the way featureharness.ts loads
// feature templates: transpile the real file and evaluate it, so these tests
// exercise exactly the code that ships.

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { test, describe } from 'node:test'
import assert from 'node:assert'

import { transform } from 'sucrase'
import * as struct from '@voxgig/struct'

import { loadFeature } from './featureharness'


const TM_TS = Path.resolve(
  __dirname, '..', 'project', '.sdk', 'tm', 'ts', 'src', 'utility')

const TM_JS = Path.resolve(
  __dirname, '..', 'project', '.sdk', 'tm', 'js', 'src', 'utility')


function loadTemplate(file: string): any {
  const src = readFileSync(file, 'utf8')
  const code = file.endsWith('.ts') ?
    transform(src, { transforms: ['typescript', 'imports'] }).code : src

  const mod: any = { exports: {} }
  // eslint-disable-next-line no-new-func
  const fn = new Function('module', 'exports', 'require', code)
  fn(mod, mod.exports, (spec: string) => {
    if (spec.endsWith('GraphqlUtility')) {
      return loadTemplate(Path.join(TM_JS, 'GraphqlUtility.js'))
    }
    if (spec.endsWith('/types') || '../types' === spec) {
      return loadTemplate(Path.join(TM_TS, '..', 'Spec.ts'))
    }
    if (spec.startsWith('.')) {
      const rp = Path.resolve(Path.dirname(file), spec)
      return loadTemplate(rp.endsWith('.ts') || rp.endsWith('.js') ? rp :
        rp + (file.endsWith('.ts') ? '.ts' : '.js'))
    }
    return require(spec)
  })
  return mod.exports
}


// A minimal stand-in for the generated operation context: just the parts
// graphqlBody / graphqlErrors read.
function makeCtx(point: any, opts?: any): any {
  const o = opts || {}
  const errors: any[] = []
  return {
    point,
    op: { name: o.opname || 'load', input: o.input || 'match' },
    reqmatch: o.reqmatch,
    reqdata: o.reqdata,
    match: o.match,
    data: o.data,
    result: o.result,
    utility: { struct },
    errors,
    error: (code: string, msg: string) => {
      const err: any = new Error(msg)
      err.code = code
      errors.push(err)
      return err
    },
  }
}


const LOAD_POINT = {
  kind: 'graphql',
  method: 'POST',
  graphql: {
    optype: 'query',
    field: 'issue',
    doc: 'query IssueLoad($id: String!) { issue(id: $id) { id title } }',
    vars: [{ name: 'id', from: 'id', gqltype: 'String!' }],
  },
  transform: { res: '`body.data.issue`' },
}


const CREATE_POINT = {
  kind: 'graphql',
  method: 'POST',
  graphql: {
    optype: 'mutation',
    field: 'issueCreate',
    doc: 'mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { issue { id } } }',
    vars: [{ name: 'input', from: '', gqltype: 'IssueCreateInput!' }],
  },
  transform: { res: '`body.data.issueCreate.issue`' },
}


describe('graphql-transport', () => {

  const gql = loadTemplate(Path.join(TM_TS, 'GraphqlUtility.ts'))


  test('exists', () => {
    assert.equal('function', typeof gql.graphqlBody)
    assert.equal('function', typeof gql.graphqlErrors)
    assert.equal('application/json', gql.GRAPHQL_CONTENT_TYPE)
  })


  // Named variables bind to the like-named op argument.
  test('body-scalar-vars', () => {
    const ctx = makeCtx(LOAD_POINT, { reqmatch: { id: 'i1' } })
    const body = gql.graphqlBody(ctx)

    assert.equal(body.query, LOAD_POINT.graphql.doc)
    assert.deepStrictEqual(body.variables, { id: 'i1' })
  })


  // Absent arguments are omitted rather than sent as null: an explicit null
  // clears the field on many APIs.
  test('body-omits-missing', () => {
    const ctx = makeCtx(LOAD_POINT, { reqmatch: {} })
    assert.deepStrictEqual(gql.graphqlBody(ctx).variables, {})
  })


  // The input-object variable takes the whole request body, so a generated
  // create call looks exactly like its REST equivalent.
  test('body-input-object', () => {
    const ctx = makeCtx(CREATE_POINT, {
      opname: 'create', input: 'data',
      reqdata: { title: 'T', teamId: 'tm1' },
    })
    const body = gql.graphqlBody(ctx)

    assert.deepStrictEqual(body.variables, {
      input: { title: 'T', teamId: 'tm1' },
    })
  })


  // $action is an SDK-side point discriminator, never an API field.
  test('body-strips-action', () => {
    const ctx = makeCtx(CREATE_POINT, {
      opname: 'create', input: 'data',
      reqdata: { title: 'T', $action: 'archive' },
    })
    assert.deepStrictEqual(gql.graphqlBody(ctx).variables, {
      input: { title: 'T' },
    })
  })


  // A GraphQL failure rides HTTP 200, so the status-driven path never sees
  // it; graphqlErrors must lift it into the SDK's error surface.
  test('errors-lifted', () => {
    const result: any = { ok: true, body: { errors: [{ message: 'nope' }] } }
    const ctx = makeCtx(LOAD_POINT, { result })

    assert.equal(true, gql.graphqlErrors(ctx))
    assert.equal(false, result.ok)
    assert.equal('request_graphql', result.err.code)
    assert.ok(result.err.message.includes('nope'))
  })


  // Extension codes map onto the same errors the HTTP path produces, so a
  // caller handles auth and rate limiting identically on both transports.
  test('errors-code-mapping', () => {
    const cases: [any, string][] = [
      [{ code: 'UNAUTHENTICATED' }, 'request_auth'],
      [{ type: 'AUTHENTICATION_ERROR' }, 'request_auth'],
      [{ type: 'RATELIMITED' }, 'request_ratelimit'],
      [{ code: 'BAD_USER_INPUT' }, 'request_invalid'],
      [{ code: 'SOMETHING_ELSE' }, 'request_graphql'],
      [undefined, 'request_graphql'],
    ]

    for (const [ext, expected] of cases) {
      assert.equal(gql.graphqlErrorCode({ extensions: ext }), expected,
        JSON.stringify(ext))
    }
  })


  // Partial data is still a failure: the REST surface has no partial-success
  // concept, and returning half an object silently would be worse.
  test('errors-partial-data-fails', () => {
    const result: any = {
      ok: true,
      body: { data: { issue: { id: 'i1' } }, errors: [{ message: 'partial' }] },
    }
    const ctx = makeCtx(LOAD_POINT, { result })

    assert.equal(true, gql.graphqlErrors(ctx))
    assert.equal(false, result.ok)
  })


  test('errors-none-on-success', () => {
    const result: any = { ok: true, body: { data: { issue: { id: 'i1' } } } }
    const ctx = makeCtx(LOAD_POINT, { result })

    assert.equal(false, gql.graphqlErrors(ctx))
    assert.equal(true, result.ok)
  })


  // http points must be untouched by the graphql error path.
  test('errors-ignores-http-points', () => {
    const result: any = { ok: true, body: { errors: [{ message: 'x' }] } }
    const ctx = makeCtx({ kind: 'http', transform: {} }, { result })

    assert.equal(false, gql.graphqlErrors(ctx))
    assert.equal(true, result.ok)
  })


  // The js target is a hand-maintained transliteration of ts; both are
  // reference implementations, so they must expose the same surface and
  // behave identically.
  test('js-mirror-parity', () => {
    const jsgql = loadTemplate(Path.join(TM_JS, 'GraphqlUtility.js'))

    assert.deepStrictEqual(
      Object.keys(jsgql).sort(), Object.keys(gql).sort())

    const mk = () => makeCtx(CREATE_POINT, {
      opname: 'create', input: 'data', reqdata: { title: 'T', $action: 'a' },
    })
    assert.deepStrictEqual(
      jsgql.graphqlBody(mk()), gql.graphqlBody(mk()))

    for (const ext of [{ code: 'UNAUTHENTICATED' }, { type: 'RATELIMITED' }]) {
      assert.equal(
        jsgql.graphqlErrorCode({ extensions: ext }),
        gql.graphqlErrorCode({ extensions: ext }))
    }
  })

})


// Relay pagination rides the SAME `list`-with-cursor surface REST uses: the
// difference is only where the cursor goes out (an operation variable, not a
// query parameter) and where it comes back (pageInfo, at the path the model
// recorded for the op).
describe('graphql-paging', () => {

  const PagingFeature = loadFeature('paging')

  const LIST_POINT: any = {
    kind: 'graphql',
    method: 'POST',
    graphql: {
      optype: 'query',
      field: 'issues',
      doc: 'query IssueList($first: Int, $after: String) { issues(first: $first, after: $after) { nodes { id } pageInfo { endCursor hasNextPage } } }',
      vars: [
        { name: 'first', from: 'first', gqltype: 'Int' },
        { name: 'after', from: 'after', gqltype: 'String' },
      ],
      page: {
        style: 'relay',
        nodes: 'nodes',
        cursor: 'pageInfo.endCursor',
        more: 'pageInfo.hasNextPage',
      },
    },
    transform: { res: '`body.data.issues.nodes`' },
  }

  function makeFeature(options?: any) {
    const f = new PagingFeature()
    f.init({ client: {} } as any, { active: true, ...(options || {}) })
    return f
  }

  function pagingCtx(point: any, opts?: any) {
    const o = opts || {}
    return {
      op: { name: 'list' },
      point,
      spec: o.spec,
      ctrl: { paging: o.paging },
      result: o.result,
      utility: { struct },
    }
  }


  test('outbound-cursor-into-variables', () => {
    const f = makeFeature({ limit: 25 })
    const spec: any = { body: { query: 'q', variables: {} }, query: {} }
    const ctx = pagingCtx(LIST_POINT, { spec, paging: { cursor: 'CUR1' } })

    f.PreRequest(ctx)

    // Cursor and page size go into the operation's variables...
    assert.deepStrictEqual(spec.body.variables, { after: 'CUR1', first: 25 })
    // ...and never into the query string.
    assert.deepStrictEqual(spec.query, {})
  })


  // Binding a variable the document does not declare makes the server reject
  // the whole operation, so undeclared names must be skipped.
  test('outbound-skips-undeclared-vars', () => {
    const f = makeFeature({ limit: 25 })
    const point = {
      ...LIST_POINT,
      graphql: { ...LIST_POINT.graphql, vars: [] },
    }
    const spec: any = { body: { query: 'q', variables: {} }, query: {} }

    f.PreRequest(pagingCtx(point, { spec, paging: { cursor: 'CUR1' } }))

    assert.deepStrictEqual(spec.body.variables, {})
  })


  test('inbound-pageinfo-into-result-paging', () => {
    const f = makeFeature()
    const result: any = {
      body: {
        data: {
          issues: {
            nodes: [{ id: 'i1' }],
            pageInfo: { endCursor: 'CUR2', hasNextPage: true },
          },
        },
      },
    }
    const ctx = pagingCtx(
      { ...LIST_POINT, graphql: { ...LIST_POINT.graphql,
        page: { ...LIST_POINT.graphql.page, connpath: 'data.issues' } } },
      { result })

    f.PreResult(ctx)

    assert.equal(result.paging.cursor, 'CUR2')
    assert.equal(result.paging.hasMore, true)
  })


  // The last Relay page normally carries BOTH an end cursor and
  // hasNextPage: false. Inferring hasMore from the cursor there would send
  // the caller back for a page that does not exist, forever.
  test('inbound-explicit-false-beats-cursor', () => {
    const f = makeFeature()
    const result: any = {
      body: {
        data: {
          issues: {
            nodes: [{ id: 'i9' }],
            pageInfo: { endCursor: 'LAST', hasNextPage: false },
          },
        },
      },
    }
    const ctx = pagingCtx(
      { ...LIST_POINT, graphql: { ...LIST_POINT.graphql,
        page: { ...LIST_POINT.graphql.page, connpath: 'data.issues' } } },
      { result })

    f.PreResult(ctx)

    assert.equal(result.paging.cursor, 'LAST')
    assert.equal(result.paging.hasMore, false)
  })


  test('inbound-last-page-has-no-more', () => {
    const f = makeFeature()
    const result: any = {
      body: { data: { issues: { nodes: [], pageInfo: { hasNextPage: false } } } },
    }
    const ctx = pagingCtx(
      { ...LIST_POINT, graphql: { ...LIST_POINT.graphql,
        page: { ...LIST_POINT.graphql.page, connpath: 'data.issues' } } },
      { result })

    f.PreResult(ctx)

    assert.equal(result.paging.hasMore, false)
    assert.equal(result.paging.cursor, undefined)
  })


  // REST list ops must be completely unaffected.
  test('http-point-uses-query-params', () => {
    const f = makeFeature({ limit: 10 })
    const spec: any = { query: {} }
    const ctx = pagingCtx({ kind: 'http' }, { spec, paging: { cursor: 'C' } })

    f.PreRequest(ctx)

    assert.equal(spec.query.cursor, 'C')
    assert.equal(spec.query.limit, 10)
  })

})


// The makeSpec integration: a GraphQL point must produce a POST to the
// single endpoint carrying the operation, with no path or query — and must
// leave the HTTP path completely unchanged.
describe('graphql-makespec', () => {

  const gql = loadTemplate(Path.join(TM_TS, 'GraphqlUtility.ts'))
  const makeSpec = loadTemplate(Path.join(TM_TS, 'MakeSpecUtility.ts')).makeSpec

  // Stand-ins for the prepare* steps makeSpec composes; each records that it
  // ran so the test can assert the graphql branch still applies auth/headers.
  function makeUtility(calls: string[]) {
    return {
      struct,
      graphqlBody: gql.graphqlBody,
      GRAPHQL_CONTENT_TYPE: gql.GRAPHQL_CONTENT_TYPE,
      prepareMethod: (ctx: any) => (calls.push('method'), ctx.point.method || 'GET'),
      prepareParams: () => (calls.push('params'), {}),
      prepareQuery: () => (calls.push('query'), {}),
      prepareHeaders: () => (calls.push('headers'), {}),
      prepareBody: () => (calls.push('body'), { rest: true }),
      preparePath: () => (calls.push('path'), '/rest/path'),
      prepareAuth: (ctx: any) => (calls.push('auth'), ctx.spec),
    }
  }

  function specCtx(point: any, utility: any, reqmatch?: any) {
    return {
      out: {},
      point,
      op: { name: 'load', input: 'match' },
      reqmatch: reqmatch || {},
      match: {},
      ctrl: {},
      utility,
      options: {
        base: 'https://api.example.test/graphql',
        prefix: '', suffix: '',
        allow: { method: 'GET,PUT,POST,PATCH,DELETE,OPTIONS' },
      },
      error: (code: string, msg: string) => Object.assign(new Error(msg), { code }),
    }
  }


  test('graphql-point-posts-operation', () => {
    const calls: string[] = []
    const ctx: any = specCtx(LOAD_POINT, makeUtility(calls), { id: 'i1' })

    const spec: any = makeSpec(ctx)

    assert.ok(!(spec instanceof Error), String(spec && spec.message))
    assert.equal(spec.method, 'POST')
    assert.deepStrictEqual(spec.body, {
      query: LOAD_POINT.graphql.doc,
      variables: { id: 'i1' },
    })
    assert.equal(spec.path, '')
    assert.equal(spec.headers['content-type'], 'application/json')

    // prepareQuery ran and its output must be discarded: the same values are
    // already bound as operation variables, so leaving them would send
    // /graphql?id=i1 and duplicate the argument into the URL.
    assert.deepStrictEqual(spec.query, {})

    // Auth and headers still run on the graphql path...
    assert.ok(calls.includes('auth'))
    assert.ok(calls.includes('headers'))
    // ...but prepareBody does NOT: it only emits a body for data-input ops,
    // while a GraphQL load must still post one.
    assert.ok(!calls.includes('body'))
    assert.ok(!calls.includes('path'))
  })


  test('http-point-unchanged', () => {
    const calls: string[] = []
    const point = { kind: 'http', method: 'GET', parts: ['api', 'thing'] }
    const ctx: any = specCtx(point, makeUtility(calls))

    const spec: any = makeSpec(ctx)

    assert.ok(!(spec instanceof Error))
    assert.equal(spec.method, 'GET')
    assert.deepStrictEqual(spec.body, { rest: true })
    assert.equal(spec.path, '/rest/path')
    assert.equal(spec.headers['content-type'], undefined)
    assert.ok(calls.includes('body'))
    assert.ok(calls.includes('path'))
  })


  // A point with no explicit kind is an ordinary HTTP point: every existing
  // OpenAPI-derived model must keep working untouched.
  test('missing-kind-defaults-http', () => {
    const calls: string[] = []
    const ctx: any = specCtx({ method: 'GET', parts: [] }, makeUtility(calls))

    const spec: any = makeSpec(ctx)

    assert.ok(!(spec instanceof Error))
    assert.deepStrictEqual(spec.body, { rest: true })
    assert.ok(calls.includes('body'))
  })

})
