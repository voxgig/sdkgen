// One return shape for every entity operation.
//
// WHAT WENT WRONG
//
// The shape a generated SDK resolved to depended on WHICH operation you
// called. `list()` returned entity INSTANCES; `load()`, `create()` and
// `update()` returned plain objects. Same record, two types — and, because
// an entity instance serialises through `toJSON()`, two different key sets:
// the list form carried an `entity$` marker the load form did not.
//
// Every consumer touching both paths had to normalise defensively:
//
//   const plain = (res) => (res && 'function' === typeof res.data) ? res.data() : res
//
// And the marker was worse than inconsistent. Seneca uses `entity$` on its
// own entities to hold the canon, so an SDK record fed straight into
// `entize` overwrote it and produced entities claiming a canon that does not
// exist — no error, just wrong entities.
//
// WHAT THIS PINS
//
// `makeResult` is a TEMPLATE (`tm/ts/src/utility/MakeResultUtility.ts`): it
// ships to users verbatim and is outside sdkgen's own tsconfig, so nothing
// here compiled it. This suite transpiles the real shipped file and runs it,
// the same trick featureharness.ts uses for the feature templates.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


// Load a shipped template module. Type-only imports (`../types`) vanish in
// the transpile; value imports of sibling templates are shimmed, since the
// point is to exercise THIS file, not its neighbours.
function loadTemplate(rel: string, shims: Record<string, any> = {}): any {
  const file = Path.join(TM, rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code

  const req = (p: string) => {
    for (const key of Object.keys(shims)) {
      if (p === key || p.endsWith(key)) {
        return shims[key]
      }
    }
    return require(p)
  }

  const mod: any = { exports: {} }
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}


const { makeResult } = loadTemplate('ts/src/utility/MakeResultUtility.ts')


// A context shaped the way the generated pipeline builds one. `entity`
// records every make()/data() call so the test can prove nothing was
// wrapped, rather than just that the count came out right.
function makeCtx(opname: string, resdata: any) {
  const made: any[] = []

  return {
    made,
    ctx: {
      out: {},
      ctrl: {},
      op: { name: opname, entity: 'planet' },
      entity: { make: () => ({ data: (d: any) => made.push(d) }) },
      spec: { step: '' },
      result: { resdata },
      utility: { transformResponse: () => { } },
      error: (code: string) => ({ code }),
    },
  }
}


describe('entity operation result contract', () => {

  const RECORDS = [{ id: 'mercury', name: 'Mercury' }, { id: 'venus', name: 'Venus' }]


  // The defect, stated directly.
  test('list resolves to plain records, not entity instances', () => {
    const { ctx, made } = makeCtx('list', RECORDS)

    const result: any = makeResult(ctx as any)

    deepStrictEqual(result.resdata, RECORDS,
      'list changed the records it was given')
    strictEqual(made.length, 0,
      'list still wraps records in entity instances')

    for (const record of result.resdata) {
      strictEqual(Object.getPrototypeOf(record), Object.prototype,
        'a list record is not a plain object')
      ok(!('data' in record), 'a list record exposes an entity method')
      ok(!('entity$' in record), 'a list record carries the old entity$ marker')
      ok(!('voxgig$entity' in record), 'a list record carries a marker at all')
    }
  })


  // The contract is that the shape does NOT depend on the operation.
  test('every operation resolves to the same shape', () => {
    const single = { id: 'earth', name: 'Earth' }

    const shapes = ['load', 'create', 'update'].map((opname) => {
      const { ctx } = makeCtx(opname, single)
      return (makeResult(ctx as any) as any).resdata
    })

    for (const shape of shapes) {
      deepStrictEqual(shape, single, 'an operation reshaped its record')
    }

    // ...and a list of one is that same record in an array.
    const { ctx } = makeCtx('list', [single])
    deepStrictEqual((makeResult(ctx as any) as any).resdata, [single])
  })


  // Callers iterate a list result unconditionally, so an absent or empty
  // list must still be an array.
  test('an absent or empty list normalises to an empty array', () => {
    for (const resdata of [[], null, undefined]) {
      const { ctx } = makeCtx('list', resdata)
      deepStrictEqual((makeResult(ctx as any) as any).resdata, [],
        'list resdata ' + JSON.stringify(resdata) + ' did not normalise')
    }
  })


  // Non-list operations are not normalised — `remove` resolves to whatever
  // the server sent, which for a 204 is nothing.
  test('a non-list operation is left alone', () => {
    const { ctx } = makeCtx('remove', undefined)
    strictEqual((makeResult(ctx as any) as any).resdata, undefined)
  })
})


// HTTP status, reachable without spelunking.
//
// The status used to live only at `err.result.status` — two levels into an
// object that reads as internal — so every consumer of every generated SDK
// wrote the same `404 === e?.result?.status` branch and coupled itself to
// the internal shape of `result`. Mapping "not found" to a null result is
// table stakes for a client integration.
describe('error contract', () => {

  const { makeError } = loadTemplate('ts/src/utility/MakeErrorUtility.ts', {
    '../types': {},
    './CleanUtility': { clean: (_c: any, v: any) => v },
    './StructUtility': {
      clone: (v: any) => JSON.parse(JSON.stringify(v)),
      delprop: (o: any, k: string) => { delete o[k] },
    },
  })


  // A minimal context whose `error()` builds the real generated error class
  // shape (status defaulting to -1, notFound derived from it).
  function errorCtx(status: any) {
    class SdkError extends Error {
      code: string
      status = -1
      get notFound(): boolean { return 404 === this.status }
      constructor(code: string, msg: string) { super(msg); this.code = code }
    }

    return {
      op: { name: 'load' },
      ctrl: { throw: true },
      spec: {},
      result: { status, statusText: 'Not Found', ok: false },
      utility: { clean: (_c: any, v: any) => v },
      error: (code: string, msg: string) => new SdkError(code, msg),
    }
  }


  function thrown(ctx: any): any {
    try {
      makeError(ctx as any)
    }
    catch (err: any) {
      return err
    }
    return null
  }


  test('the status is on the error itself', () => {
    const err = thrown(errorCtx(404))

    ok(null != err, 'makeError did not throw')
    strictEqual(err.status, 404, 'err.status was not promoted')
    strictEqual(err.notFound, true, 'err.notFound did not derive from the status')

    // And the old path still works, so this is additive.
    strictEqual(err.result.status, 404)
  })


  test('a non-404 is not notFound', () => {
    const err = thrown(errorCtx(500))
    strictEqual(err.status, 500)
    strictEqual(err.notFound, false)
  })


  // A transport failure never got a response, so there is no status to
  // report — and -1 says that, where `undefined` would look like a bug.
  test('a request with no response reports -1', () => {
    const err = thrown(errorCtx(undefined))
    strictEqual(err.status, -1)
    strictEqual(err.notFound, false)
  })
})
