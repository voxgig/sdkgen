import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, ok, throws } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'
import * as struct from '@voxgig/struct'

import { CLEAN_DEFAULTS, sandboxLoad } from './featureharness'


// The shipped ts clean utility, run for real against a case table (the
// resultcontract pattern): what every port must reproduce, in data.

const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')
const MODEL = Path.resolve(__dirname, '..', 'model', 'sdkgen.aontu')

const MASK = '[redacted]'


function loadClean(): any {
  return sandboxLoad(Path.join(TM, 'ts', 'src', 'utility', 'CleanUtility.ts'), {
    '../types': {},
    '../Schema': { OPTSPEC: { clean: CLEAN_DEFAULTS } },
  })
}


// A context carrying a derived clean block, as makeOptions leaves it.
function ctxWith(mod: any, over?: any, values?: string[]): any {
  const ctx = { options: { __derived__: { clean: mod.makeCleanConfig({ ...CLEAN_DEFAULTS, ...(over || {}) }) } } }
  for (const v of values || []) mod.cleanAdd(ctx, v)
  return ctx
}


describe('clean: the shipped ts utility', () => {

  test('the harness defaults are the model defaults', () => {
    const src = readFileSync(MODEL, 'utf8')
    const errs: any[] = []
    const base: any = new Aontu().generate(src, { path: MODEL, errs })
    strictEqual(errs.length, 0, 'model errors: ' + errs.map((e: any) => e.msg).join(' | '))
    deepStrictEqual(base.main.kit.optspec.clean, CLEAN_DEFAULTS)
  })


  test('a registered value is masked wherever it appears in a string', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod, {}, ['SECRET-abc123'])
    strictEqual(mod.clean(ctx, 'token SECRET-abc123 here'), 'token ' + MASK + ' here')
    strictEqual(mod.clean(ctx, 'twice SECRET-abc123 SECRET-abc123'), 'twice ' + MASK + ' ' + MASK)
    strictEqual(mod.clean(ctx, 'nothing here'), 'nothing here')
  })


  test('the encoded forms travel with the value', () => {
    const mod = loadClean()
    const raw = 'k"e/y+SECRET'
    const ctx = ctxWith(mod, {}, [raw])
    strictEqual(mod.clean(ctx, 'Basic ' + Buffer.from(raw).toString('base64')), 'Basic ' + MASK)
    strictEqual(mod.clean(ctx, '?api_key=' + encodeURIComponent(raw)), '?api_key=' + MASK)
    strictEqual(mod.clean(ctx, JSON.stringify({ k: raw })), '{"k":"' + MASK + '"}')
  })


  test('longer values win, so a prefix of one secret cannot break another', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod, {}, ['SECRET', 'SECRET-LONGER'])
    strictEqual(mod.clean(ctx, 'SECRET-LONGER and SECRET'), MASK + ' and ' + MASK)
  })


  test('a value shorter than min is not registered', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod, {}, ['abc'])
    strictEqual(mod.clean(ctx, 'abc abc'), 'abc abc')
    const ctx2 = ctxWith(mod, { min: '2' }, ['abc'])
    strictEqual(mod.clean(ctx2, 'abc abc'), MASK + ' ' + MASK)
  })


  test('mask and hint are configurable', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod, { mask: '***', hint: '3' }, ['SECRET-abc123'])
    strictEqual(mod.clean(ctx, 'SECRET-abc123'), '***123')
    strictEqual(mod.clean(ctx, { apikey: 'plain-value-xyz' }).apikey, '***xyz')
  })


  test('a sensitive key masks its value by normalised containment', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod)
    const out = mod.clean(ctx, {
      headers: {
        Authorization: 'Bearer whatever',
        'X-Api-Key': 'k1',
        'PRIVATE-TOKEN': 'k2',
        'set-cookie': 'session=1',
        'content-type': 'application/json',
      },
      query: { api_key: 'q1', page: '2' },
      body: { password: 'p', passwd: 'p', client_secret: 's', signature: 'sig', name: 'n' },
      nested: [{ refresh_token: 'r' }, { token: 't', ok: true }],
    })
    deepStrictEqual(out, {
      headers: {
        Authorization: MASK, 'X-Api-Key': MASK, 'PRIVATE-TOKEN': MASK, 'set-cookie': MASK,
        'content-type': 'application/json',
      },
      query: { api_key: MASK, page: '2' },
      body: { password: MASK, passwd: MASK, client_secret: MASK, signature: MASK, name: 'n' },
      nested: [{ refresh_token: MASK }, { token: MASK, ok: true }],
    })
  })


  test('a sensitive key masks a non-string value too', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod)
    deepStrictEqual(mod.clean(ctx, { token: 12345, secret: { inner: 'x' }, n: 7 }),
      { token: MASK, secret: MASK, n: 7 })
  })


  test('the copy is plain data and the live object is untouched', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod, {}, ['SECRET-abc123'])
    class Spec { headers: any = { authorization: 'Bearer SECRET-abc123' }; fn() { return 1 } }
    const spec = new Spec()
    const out = mod.clean(ctx, spec)
    strictEqual(out.headers.authorization, MASK)
    strictEqual(spec.headers.authorization, 'Bearer SECRET-abc123')
    strictEqual(out.fn, undefined)
    strictEqual(Object.getPrototypeOf(out), Object.prototype)
  })


  test('toJSON is honoured and a cycle is cut', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod, {}, ['SECRET-abc123'])
    const entity: any = { _client: {}, toJSON() { return { id: 'e1', note: 'SECRET-abc123' } } }
    entity._client.entity = entity
    const out = mod.clean(ctx, { entity })
    deepStrictEqual(out, { entity: { id: 'e1', note: MASK } })

    const loop: any = { a: 'SECRET-abc123' }
    loop.self = loop
    deepStrictEqual(mod.clean(ctx, loop), { a: MASK, self: '[circular]' })
  })


  test('an Error is cleaned in place: message, stack and own properties', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod, {}, ['SECRET-abc123'])
    const err: any = new Error('failed with SECRET-abc123')
    err.spec = { headers: { authorization: 'Bearer SECRET-abc123' } }
    err.detail = 'SECRET-abc123'
    const out = mod.clean(ctx, err)
    strictEqual(out, err)
    strictEqual(err.message, 'failed with ' + MASK)
    ok(!String(err.stack).includes('SECRET-abc123'))
    strictEqual(err.spec.headers.authorization, MASK)
    strictEqual(err.detail, MASK)
  })


  test('non-string scalars pass through', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod)
    strictEqual(mod.clean(ctx, 42), 42)
    strictEqual(mod.clean(ctx, true), true)
    strictEqual(mod.clean(ctx, null), null)
    strictEqual(mod.clean(ctx, undefined), undefined)
  })


  test('active false returns the value untouched', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod, { active: false }, ['SECRET-abc123'])
    const val = { authorization: 'SECRET-abc123' }
    strictEqual(mod.clean(ctx, val), val)
  })


  test('a context without options still masks by the schema defaults', () => {
    const mod = loadClean()
    deepStrictEqual(mod.clean({}, { apikey: 'k1', name: 'n' }), { apikey: MASK, name: 'n' })
  })


  test('cleanKey answers the key rule and values register once', () => {
    const mod = loadClean()
    const ctx = ctxWith(mod)
    ok(mod.cleanKey(ctx, 'X-Api-Key'))
    ok(mod.cleanKey(ctx, 'refresh_token'))
    ok(!mod.cleanKey(ctx, 'content-type'))
    ok(!mod.cleanKey(ctx, 0))
    mod.cleanAdd(ctx, 'SECRET-abc123')
    mod.cleanAdd(ctx, 'SECRET-abc123')
    const values = ctx.options.__derived__.clean.values
    strictEqual(values.filter((v: string) => 'SECRET-abc123' === v).length, 1)
    ok(values.includes(Buffer.from('SECRET-abc123').toString('base64')))
  })


  test('splitvalues reads the comma-separated option and a list alike', () => {
    const mod = loadClean()
    deepStrictEqual(mod.splitvalues('a1234, b5678,,'), ['a1234', 'b5678'])
    deepStrictEqual(mod.splitvalues(['x', 1, 'y']), ['x', 'y'])
    deepStrictEqual(mod.splitvalues(undefined), [])
  })
})


describe('clean: the option spec', () => {

  test('the clean block validates by example and rejects a wrong type', () => {
    const src = readFileSync(MODEL, 'utf8')
    const errs: any[] = []
    const base: any = new Aontu().generate(src, { path: MODEL, errs })
    const spec = struct.clone(base.main.kit.optspec.clean)

    const good = struct.validate({ keys: 'a,b', values: 'v1', hint: '2' }, spec)
    strictEqual(good.active, true)
    strictEqual(good.mask, MASK)
    strictEqual(good.min, '4')

    throws(() => struct.validate({ active: 'yes' }, struct.clone(spec)))
  })
})
