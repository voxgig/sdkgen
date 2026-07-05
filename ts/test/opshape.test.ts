
import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, ok } from 'node:assert'

import { opRequestShape, opTypeName, OP_SUFFIX } from '../dist/sdkgen.js'


// A model entity with a mix of required/optional fields, a per-op exclusion,
// and one op that declares explicit params. `each(...)` iterates object keys in
// sorted order, so assertions look items up by name rather than by position.
function makeEntity() {
  return {
    Name: 'Advice',
    name: 'advice',
    fields: {
      id:     { name: 'id', type: '`$STRING`', req: true },
      note:   { name: 'note', type: '`$STRING`', req: false },
      code:   { name: 'code', type: '`$INTEGER`' },              // req undefined -> required
      secret: { name: 'secret', type: '`$STRING`', op: { create: { active: false } } },
    },
    op: {
      load:   {},
      list:   {},
      create: {},
      update: {},
      remove: {},
      // params take precedence over the field fallback
      search: { points: [ { args: { params: {
        q:    { name: 'q', type: '`$STRING`', reqd: false },
        kind: { name: 'kind', type: '`$STRING`', reqd: true },
      } } } ] },
    },
  }
}

// name -> optional, for order-independent assertions.
function optionalByName(items: any[]): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  items.forEach((it) => { out[it.name] = it.optional })
  return out
}


describe('opTypeName / OP_SUFFIX', () => {
  test('name scheme matches the documented convention', () => {
    strictEqual(opTypeName('Advice', 'load'), 'AdviceLoadMatch')
    strictEqual(opTypeName('Advice', 'list'), 'AdviceListMatch')
    strictEqual(opTypeName('Advice', 'remove'), 'AdviceRemoveMatch')
    strictEqual(opTypeName('Advice', 'create'), 'AdviceCreateData')
    strictEqual(opTypeName('Advice', 'update'), 'AdviceUpdateData')
    deepStrictEqual(
      { load: OP_SUFFIX.load, create: OP_SUFFIX.create },
      { load: 'Match', create: 'Data' },
    )
  })
})


describe('opRequestShape — partiality policy', () => {

  test('op-declared params take precedence and use reqd', () => {
    const { items, fromParams } = opRequestShape(makeEntity(), 'search')
    strictEqual(fromParams, true)
    const opt = optionalByName(items)
    deepStrictEqual(opt, { kind: false, q: true })
  })

  test('create: required fields required, optional optional, excludes create-inactive', () => {
    const { items, fromParams } = opRequestShape(makeEntity(), 'create')
    strictEqual(fromParams, false)
    const opt = optionalByName(items)
    // secret is op.create.active === false -> excluded
    ok(!('secret' in opt), 'create excludes the create-inactive field')
    strictEqual(opt.id, false, 'req:true -> required')
    strictEqual(opt.code, false, 'req undefined -> required')
    strictEqual(opt.note, true, 'req:false -> optional')
  })

  test('update: every participating field optional (patch), keeps non-create fields', () => {
    const { items } = opRequestShape(makeEntity(), 'update')
    const opt = optionalByName(items)
    ok('secret' in opt, 'secret participates in update (no update exclusion)')
    ok(Object.values(opt).every((v) => v === true), 'all update members optional')
  })

  test('load / remove: id required, the rest optional', () => {
    for (const opname of ['load', 'remove']) {
      const { items } = opRequestShape(makeEntity(), opname)
      const opt = optionalByName(items)
      strictEqual(opt.id, false, `${opname}: id required`)
      strictEqual(opt.note, true, `${opname}: note optional`)
      strictEqual(opt.code, true, `${opname}: code optional`)
    }
  })

  test('list: every field optional (filter)', () => {
    const { items } = opRequestShape(makeEntity(), 'list')
    const opt = optionalByName(items)
    ok(Object.values(opt).every((v) => v === true), 'all list members optional')
  })

  test('missing op -> empty shape', () => {
    const { items, fromParams } = opRequestShape(makeEntity(), 'nope')
    deepStrictEqual(items, [])
    strictEqual(fromParams, false)
  })

  test('load with no id field degrades to fully-optional (never over-constrains)', () => {
    const ent = {
      Name: 'Tag', name: 'tag',
      fields: { label: { name: 'label', type: '`$STRING`', req: true } },
      op: { load: {} },
    }
    const { items } = opRequestShape(ent, 'load')
    const opt = optionalByName(items)
    strictEqual(opt.label, true, 'no id -> required-key convention does not fire')
  })
})
