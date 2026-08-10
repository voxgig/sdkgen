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
