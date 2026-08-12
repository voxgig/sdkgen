// Entity operations return ENTITIES.
//
// THE CONTRACT
//
// Every entity operation resolves to the Entity INSTANCE — `load`, `list`,
// `create`, `update` and `remove` alike. `remove` returns the entity marked
// as deleted. `.data()` gives back the entity data container instance.
//
// This is a fundamental design of the SDK, not a trade-off: entities are
// stateful (every generated README says so), the operation RESULT is the
// entity, and the record is reached through it.
//
// WHAT WAS WRONG
//
// The generated code half-implemented it, and the two halves disagreed:
//
//   - `done()` returned `ctx.result.resdata`, so `load`/`create`/`update`
//     resolved to plain data.
//   - `makeResult` re-wrapped `list` results into entity instances, so `list`
//     resolved to entities — while its DECLARED type said `Promise<Planet[]>`,
//     the data interface. The signature was a lie the compiler cannot catch,
//     and it is what broke the first downstream integration.
//
// Converging on plain records would have INVERTED the design. The fix runs
// the other way: `done()` returns the entity, and the declared types name the
// CLASS (`Promise<PlanetEntity>`).
//
// WHAT THIS PINS
//
// `done` and `makeResult` are TEMPLATES: they ship to users verbatim and are
// outside sdkgen's own tsconfig, so nothing here compiled them, let alone ran
// them. This suite transpiles the real shipped files and drives them.

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

const { done } = loadTemplate('ts/src/utility/DoneUtility.ts', {
  '../types': {},
  './CleanUtility': { clean: (_c: any, v: any) => v },
})


// A stand-in for the generated entity class: stateful, with the `data()` and
// `deleted()` surface the real EntityBase fragment emits.
function makeEntity(name = 'planet') {
  const ent: any = {
    Name: name,
    _data: {},
    _deleted: false,
    data(d?: any) {
      if (null != d) { ent._data = d }
      return ent._data
    },
    deleted() { return true === ent._deleted },
    make: () => makeEntity(name),
  }
  return ent
}


// A context shaped the way the generated pipeline builds one.
function makeCtx(opname: string, resdata: any, entity?: any) {
  return {
    out: {},
    ctrl: {},
    op: { name: opname, entity: 'planet' },
    entity: null === entity ? null : (entity || makeEntity()),
    spec: { step: '' },
    result: { ok: true, resdata },
    utility: {
      transformResponse: () => { },
      makeError: () => { throw new Error('makeError must not run on the ok path') },
      struct: { delprop: (o: any, k: string) => { delete o[k] } },
    },
    error: (code: string) => ({ code }),
  }
}


describe('entity operation return contract', () => {

  const RECORD = { id: 'earth', name: 'Earth' }


  // The defect, stated directly: these used to resolve to plain data.
  test('load, create and update resolve to the entity', () => {
    for (const opname of ['load', 'create', 'update']) {
      const entity = makeEntity()
      entity.data(RECORD)

      const out: any = done(makeCtx(opname, RECORD, entity) as any)

      strictEqual(out, entity, opname + ' did not resolve to the entity')
      deepStrictEqual(out.data(), RECORD,
        opname + ': the entity does not carry the record')
    }
  })


  // `list` is the one op that resolves to a COLLECTION — of entities, one per
  // record, which is what makeResult builds.
  test('list resolves to an array of entity instances', () => {
    const records = [{ id: 'mercury' }, { id: 'venus' }]
    const ctx: any = makeCtx('list', records)

    makeResult(ctx)
    const out: any = done(ctx)

    ok(Array.isArray(out), 'list did not resolve to an array')
    strictEqual(out.length, 2, 'list lost records')

    for (let i = 0; i < out.length; i++) {
      ok('function' === typeof out[i].data,
        'list element ' + i + ' is not an entity instance')
      deepStrictEqual(out[i].data(), records[i],
        'list element ' + i + ' does not carry its record')
    }
  })


  // `remove` resolves to the entity too — marked as deleted, and still
  // carrying what was removed.
  test('remove resolves to the entity, marked as deleted', () => {
    const entity = makeEntity()
    entity.data(RECORD)

    strictEqual(entity.deleted(), false, 'a fresh entity reports deleted')

    const out: any = done(makeCtx('remove', undefined, entity) as any)

    strictEqual(out, entity, 'remove did not resolve to the entity')
    strictEqual(out.deleted(), true, 'remove did not mark the entity deleted')
    deepStrictEqual(out.data(), RECORD,
      'remove discarded the data — a caller can no longer see what was deleted')
  })


  // Only `remove` marks. A load must not leave the entity looking deleted.
  test('no other operation marks the entity deleted', () => {
    for (const opname of ['load', 'create', 'update']) {
      const entity = makeEntity()
      const out: any = done(makeCtx(opname, RECORD, entity) as any)
      strictEqual(out.deleted(), false, opname + ' marked the entity deleted')
    }
  })


  // `direct()` / `prepare()` build a context with no entity. There is nothing
  // to return but the data, and that path must keep working.
  test('a context with no entity resolves to the data', () => {
    const out: any = done(makeCtx('load', RECORD, null) as any)
    deepStrictEqual(out, RECORD)
  })


  // Callers iterate a list result unconditionally, so an absent or empty list
  // must still be an array.
  test('an absent or empty list normalises to an empty array', () => {
    for (const resdata of [[], null, undefined]) {
      const ctx: any = makeCtx('list', resdata)
      makeResult(ctx)
      deepStrictEqual(done(ctx), [],
        'list resdata ' + JSON.stringify(resdata) + ' did not normalise')
    }
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
