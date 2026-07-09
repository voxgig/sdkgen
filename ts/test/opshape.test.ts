
import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, ok } from 'node:assert'

import { opRequestShape, opTypeName, OP_SUFFIX, entityClassName, pickExampleEntity } from '../dist/sdkgen.js'


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


describe('opRequestShape — multi-point param merging', () => {

  // An op serving several alternative routes: a param is required only if
  // every canonical point requires it, and $action points do not shape the
  // canonical payload at all.
  function makeNestedEntity() {
    return {
      Name: 'Component', name: 'component',
      fields: {},
      op: {
        // Alternative list routes: by page, by page+group, by page+user.
        list: { points: [
          { args: { params: {
            page_access_group_id: { name: 'page_access_group_id', type: '`$STRING`', reqd: true },
            page_id: { name: 'page_id', type: '`$STRING`', reqd: true },
          } } },
          { args: { params: {
            page_access_user_id: { name: 'page_access_user_id', type: '`$STRING`', reqd: true },
            page_id: { name: 'page_id', type: '`$STRING`', reqd: true },
          } } },
          { args: { params: {
            page_id: { name: 'page_id', type: '`$STRING`', reqd: true },
          } } },
        ] },
        // A real create route plus folded-in sub-resource action routes.
        create: { points: [
          { select: { '$action': 'page_access_group' }, args: { params: {
            id: { name: 'id', type: '`$STRING`', reqd: true },
            page_id: { name: 'page_id', type: '`$STRING`', reqd: true },
          } } },
          { args: { params: {
            page_id: { name: 'page_id', type: '`$STRING`', reqd: true },
          } } },
        ] },
        // Only action points: they are all that exists, so they are kept.
        invoke: { points: [
          { select: { '$action': 'resend' }, args: { params: {
            id: { name: 'id', type: '`$STRING`', reqd: true },
          } } },
        ] },
      },
    }
  }

  test('required is the intersection across alternative points', () => {
    const { items, fromParams } = opRequestShape(makeNestedEntity(), 'list')
    strictEqual(fromParams, true)
    const opt = optionalByName(items)
    deepStrictEqual(opt, {
      page_id: false,
      page_access_group_id: true,
      page_access_user_id: true,
    }, 'shared parent id required; per-route siblings optional')
  })

  test('$action points are excluded from the canonical shape', () => {
    const { items } = opRequestShape(makeNestedEntity(), 'create')
    const opt = optionalByName(items)
    deepStrictEqual(opt, { page_id: false },
      'the action route neither adds params nor makes them required')
  })

  test('an op with only $action points keeps them', () => {
    const { items } = opRequestShape(makeNestedEntity(), 'invoke')
    const opt = optionalByName(items)
    deepStrictEqual(opt, { id: false })
  })
})


describe('entityClassName — collision-free class names', () => {

  // GitLab's shape: `project` (class ProjectEntity) vs `project_entity`
  // (data type ProjectEntity). Keys iterate in sorted order.
  const coll = {
    project: { name: 'project', Name: 'Project', op: { load: {}, list: {} } },
    project_entity: { name: 'project_entity', Name: 'ProjectEntity', op: { create: {} } },
    user: { name: 'user', Name: 'User', op: { load: {} } },
  }

  test('the colliding class yields to the canonical data type', () => {
    // project's natural class ProjectEntity == project_entity's data type,
    // so project's class becomes ProjectEntityClient.
    strictEqual(entityClassName(coll.project, coll), 'ProjectEntityClient')
    // project_entity's own class (ProjectEntityEntity) is free — unchanged.
    strictEqual(entityClassName(coll.project_entity, coll), 'ProjectEntityEntity')
    // a non-colliding entity keeps the natural <Name>Entity.
    strictEqual(entityClassName(coll.user, coll), 'UserEntity')
  })

  test('assignment is stable/idempotent (memoised) across calls', () => {
    strictEqual(entityClassName(coll.project, coll), 'ProjectEntityClient')
    strictEqual(entityClassName(coll.project, coll), 'ProjectEntityClient')
  })

  test('no collision -> plain <Name>Entity for every entity', () => {
    const plain = {
      a: { name: 'a', Name: 'Alpha', op: { load: {} } },
      b: { name: 'b', Name: 'Beta', op: { list: {} } },
    }
    strictEqual(entityClassName(plain.a, plain), 'AlphaEntity')
    strictEqual(entityClassName(plain.b, plain), 'BetaEntity')
  })
})


describe('pickExampleEntity', () => {

  test('prefers an entity with a read (list/load) op', () => {
    const coll = {
      abort: { name: 'abort', Name: 'Abort', active: true, op: {} },
      cargo: { name: 'cargo', Name: 'Cargo', active: true, op: { list: {} } },
    }
    const { entity, primaryOp } = pickExampleEntity(coll)
    strictEqual(entity.name, 'cargo')
    strictEqual(primaryOp, 'list')
  })

  test('falls back to any op, never fabricating one', () => {
    const coll = {
      abort: { name: 'abort', Name: 'Abort', active: true, op: {} },
      make: { name: 'make', Name: 'Make', active: true, op: { create: {} } },
    }
    const { entity, primaryOp } = pickExampleEntity(coll)
    strictEqual(entity.name, 'make')
    strictEqual(primaryOp, 'create')
  })

  test('an all-op-less model yields a null primaryOp (caller skips the call)', () => {
    const coll = { abort: { name: 'abort', Name: 'Abort', active: true, op: {} } }
    const { entity, primaryOp } = pickExampleEntity(coll)
    strictEqual(entity.name, 'abort')
    strictEqual(primaryOp, null)
  })
})
