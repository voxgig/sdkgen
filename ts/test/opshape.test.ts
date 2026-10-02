
import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, ok } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import {
  opRequestShape, opTypeName, OP_SUFFIX, entityClassName, pickExampleEntity,
  opReachable, opNeedsAction, entityOps, guardFlowSteps, ungeneratedOps, warnUngeneratedOps,
} from '../dist/sdkgen.js'
import { targetOrigins, resolvesBundled, resolveSource, BUNDLED } from '../dist/action/resolve.js'


// A model entity with a mix of required/optional fields, a per-op exclusion,
// and one op that declares explicit params. `each(...)` iterates object keys in
// sorted order, so assertions look items up by name rather than by position.
function makeEntity() {
  return {
    Name: 'Advice',
    name: 'advice',
    fields: {
      id:     { n: 'id', t: '`$STRING`', r: true },
      note:   { n: 'note', t: '`$STRING`', r: false },
      code:   { n: 'code', t: '`$INTEGER`' },              // req undefined -> required
      secret: { n: 'secret', t: '`$STRING`', op: { create: { active: false } } },
    },
    op: {
      load:   {},
      list:   {},
      create: {},
      update: {},
      remove: {},
      // params take precedence over the field fallback
      search: { points: [ { g: { params: {
        q:    { n: 'q', t: '`$STRING`', r: false },
        kind: { n: 'kind', t: '`$STRING`', r: true },
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
      fields: { label: { n: 'label', t: '`$STRING`', r: true } },
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
          { g: { params: {
            page_access_group_id: { n: 'page_access_group_id', t: '`$STRING`', r: true },
            page_id: { n: 'page_id', t: '`$STRING`', r: true },
          } } },
          { g: { params: {
            page_access_user_id: { n: 'page_access_user_id', t: '`$STRING`', r: true },
            page_id: { n: 'page_id', t: '`$STRING`', r: true },
          } } },
          { g: { params: {
            page_id: { n: 'page_id', t: '`$STRING`', r: true },
          } } },
        ] },
        // A real remove route plus folded-in sub-resource action routes.
        remove: { points: [
          { q: { '$action': 'page_access_group' }, g: { params: {
            id: { n: 'id', t: '`$STRING`', r: true },
            page_id: { n: 'page_id', t: '`$STRING`', r: true },
          } } },
          { g: { params: {
            page_id: { n: 'page_id', t: '`$STRING`', r: true },
          } } },
        ] },
        // Only action points: they are all that exists, so they are kept.
        invoke: { points: [
          { q: { '$action': 'resend' }, g: { params: {
            id: { n: 'id', t: '`$STRING`', r: true },
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

  // Genuinely unrelated cross-references (Trello's board load via
  // /boards/{id} vs /notifications/{id}/board) share no param at all —
  // fall back to the shortest, canonical path rather than nothing required.
  test('an empty intersection falls back to the shortest path', () => {
    const entity = {
      Name: 'Board', name: 'board',
      fields: {},
      op: {
        load: { points: [
          {
            s: [{ lit: 'notifications' }, { var: 'id' }, { lit: 'board' }],
            g: { params: {
              notification_id: { n: 'notification_id', t: '`$STRING`', r: true },
            } },
          },
          {
            s: [{ lit: 'boards' }, { var: 'id' }],
            g: { params: { id: { n: 'id', t: '`$STRING`', r: true } } },
          },
        ] },
      },
    }

    const { items } = opRequestShape(entity, 'load')
    const opt = optionalByName(items)
    deepStrictEqual(opt, { id: false },
      'did not fall back to the shortest, canonical path')
  })


  // Alternative selectors on ONE route — /users?email= and /users?name= —
  // legitimately require nothing, and are not cross-references. Collapsing
  // them to a single point would drop the other's field from the generated
  // type, leaving a caller unable to express that call at all.
  test('all-optional points on one path keep every field', () => {
    const entity = {
      Name: 'User', name: 'user',
      fields: {},
      op: {
        load: { points: [
          {
            s: [{ lit: 'users' }],
            g: { params: {
              email: { n: 'email', t: '`$STRING`', r: false },
            } },
          },
          {
            s: [{ lit: 'users' }],
            g: { params: {
              name: { n: 'name', t: '`$STRING`', r: false },
            } },
          },
        ] },
      },
    }

    const { items } = opRequestShape(entity, 'load')
    const opt = optionalByName(items)
    deepStrictEqual(opt, { email: true, name: true },
      'the all-optional fallback dropped a sibling route\'s field')
  })


  // The cross-reference fallback picks the entity's OWN route even when that
  // route is nested more deeply than the one pointing at it — depth alone
  // generated this op's required params from /posts/{id}/author.
  test('a deeply nested own route wins over a shallower cross-reference', () => {
    const entity = {
      Name: 'User', name: 'user',
      fields: {},
      op: {
        load: { points: [
          {
            s: [{ lit: 'posts' }, { var: 'id' }, { lit: 'author' }],
            g: { params: {
              post_id: { n: 'post_id', t: '`$STRING`', r: false },
            } },
          },
          {
            s: [{ lit: 'accounts' }, { var: 'account_id' }, { lit: 'users' }, { var: 'id' }],
            g: { params: {
              account_id: { n: 'account_id', t: '`$STRING`', r: true },
              id: { n: 'id', t: '`$STRING`', r: true },
            } },
          },
        ] },
      },
    }

    const { items } = opRequestShape(entity, 'load')
    const opt = optionalByName(items)
    deepStrictEqual(opt, { account_id: false, id: false },
      'took the required params from the cross-reference, not the own route')
  })


  test('$action points are excluded from the canonical shape', () => {
    const { items } = opRequestShape(makeNestedEntity(), 'remove')
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


describe('opRequestShape — body ops take fields, not path params', () => {

  function makeItemEntity() {
    return {
      Name: 'Todoitem', name: 'todoitem',
      fields: {
        done: { n: 'done', t: '`$BOOLEAN`', r: false },
        id: { n: 'id', t: '`$STRING`', r: false },
        title: { n: 'title', t: '`$STRING`', r: true },
      },
      op: {
        update: { points: [
          { g: { params: { id: { n: 'id', t: '`$STRING`', r: true } } } },
        ] },
        // POST /v1/proj/{project_id}/item — sub-resource create: the parent
        // id is a path param too, so the same rule has to hold.
        create: { points: [
          { g: { params: {
            project_id: { n: 'project_id', t: '`$STRING`', r: true },
          } } },
        ] },
        load: { points: [
          { g: { params: { id: { n: 'id', t: '`$STRING`', r: true } } } },
        ] },
      },
    }
  }

  test('update takes the path param AND the entity fields', () => {
    const { items, fromParams } = opRequestShape(makeItemEntity(), 'update')
    strictEqual(fromParams, false, 'must not be shaped by params alone')
    // `id` is the path param (required, and not duplicated by the field of
    // the same name); the rest are the partial-update fields.
    deepStrictEqual(optionalByName(items),
      { id: false, done: true, title: true })
  })

  test('create takes the parent path param AND the entity fields', () => {
    const { items, fromParams } = opRequestShape(makeItemEntity(), 'create')
    strictEqual(fromParams, false)
    const opt = optionalByName(items)
    strictEqual(opt.project_id, false, 'the sub-resource path param is required')
    strictEqual(opt.title, false, 'req:true field stays required')
    strictEqual(opt.done, true)
  })

  test('load still takes its params — only body ops changed', () => {
    const { items, fromParams } = opRequestShape(makeItemEntity(), 'load')
    strictEqual(fromParams, true)
    deepStrictEqual(optionalByName(items), { id: false })
  })
})


// Points as apidef writes them: typed segments, and $action in the selector.
function pt(path: string, action?: string): any {
  return {
    s: path.split('/').filter((x) => '' !== x)
      .map((x) => /^\{[^{}]+\}$/.test(x) ? { var: x.slice(1, -1) } : { lit: x }),
    q: null == action ? { exist: [] } : { exist: [], $action: action },
  }
}


describe('opReachable — the route makePoint would take', () => {

  test('a lone point is taken whatever its action, if the call fills it', () => {
    strictEqual(opReachable({ points: [pt('/planet/{id}')] }, ['id']), true)
    strictEqual(opReachable({ points: [pt('/planet/{id}')] }, []), false)
    strictEqual(opReachable({ points: [pt('/signal/strong', 'strong')] }, []), true)
  })

  test('otherwise only a point without an action, and one the call fills', () => {
    const op = { points: [pt('/planet/{id}/terraform', 'terraform'), pt('/planet/{planet_id}/moon')] }
    strictEqual(opReachable(op, ['planet_id']), true)
    strictEqual(opReachable(op, ['id']), false)
    strictEqual(opReachable({ points: [pt('/a', 'x'), pt('/b', 'y')] }, ['id']), false)
  })

  test('a placeholder inside a literal segment needs a value too', () => {
    const op = { points: [{ s: [{ var: 'board' }, { lit: 'thread' }, { lit: '{threadId}.json' }] }] }
    strictEqual(opReachable(op, ['board', 'thread_id']), false)
    strictEqual(opReachable(op, ['board', 'threadId']), true)
  })

  test('an op with no points, or no op, is not reachable', () => {
    strictEqual(opReachable({ points: [] }, []), false)
    strictEqual(opReachable(undefined, []), false)
  })
})


describe('opNeedsAction and entityOps', () => {

  test('every route an action, and more than one of them', () => {
    strictEqual(opNeedsAction({ points: [pt('/a', 'x'), pt('/b', 'y')] }), true)
    strictEqual(opNeedsAction({ points: [pt('/a', 'x')] }), false)
    strictEqual(opNeedsAction({ points: [pt('/a', 'x'), pt('/b')] }), false)
    strictEqual(opNeedsAction({}), false)
  })

  test('an op that needs an action gets no plain example', () => {
    const ent = {
      name: 'signal',
      op: {
        list: { points: [pt('/signal/strong', 'strong'), pt('/signal/weak', 'weak')] },
        load: { points: [pt('/signal/{id}')] },
      },
    }
    deepStrictEqual(entityOps(ent), ['load'])
  })
})


describe('pickExampleEntity — a call the runtime takes', () => {

  // Same name length and field count, so only reachability separates them.
  const moon = {
    name: 'moon', Name: 'Moon', active: true, fields: { id: { n: 'id' } },
    op: { list: { points: [pt('/planet/{planet_id}/moon')] } },
  }
  const star = {
    name: 'star', Name: 'Star', active: true, fields: { id: { n: 'id' } },
    op: { list: { points: [pt('/star')] } },
  }

  test('a nested list, which a bare example cannot fill, is passed over', () => {
    strictEqual(pickExampleEntity({ moon, star }).entity.name, 'star')
    strictEqual(pickExampleEntity({ star, moon }).entity.name, 'star')
  })

  test('with nothing reachable the median pick still stands', () => {
    strictEqual(pickExampleEntity({ moon }).entity.name, 'moon')
  })
})


describe('guardFlowSteps — a generated flow test makes only calls the runtime takes', () => {

  function model(op: any, step: any[]): any {
    return {
      main: {
        kit: {
          entity: { moon: { name: 'moon', fields: { id: { n: 'id' }, title: { n: 'title' } }, op } },
          flow: { BasicMoonFlow: { entity: 'moon', step } },
        },
      },
    }
  }

  test('a step whose routes all need an action is switched off', () => {
    const m = model({
      list: { points: [pt('/moon/new', 'new'), pt('/moon/old', 'old')] },
      load: { points: [pt('/moon/{id}')] },
    }, [{ o: 'list' }, { o: 'load' }])

    const sink: any[] = []
    const log = { warn: (e: any) => sink.push(e) }
    deepStrictEqual(guardFlowSteps(m, log), [{ flow: 'BasicMoonFlow', step: 0, op: 'list' }])
    deepStrictEqual(m.main.kit.flow.BasicMoonFlow.step.map((s: any) => s.a), [false, undefined])
    strictEqual(sink.length, 1)
    strictEqual(sink[0].point, 'flow-step-unreachable')
  })

  test('a step that fills no route is switched off; one that does is kept', () => {
    const op = { list: { points: [pt('/planet/{planet_id}/moon')] } }
    const m = model(op, [{ o: 'list' }, { o: 'list', m: { planet_id: 'planet01' } }])
    guardFlowSteps(m)
    deepStrictEqual(m.main.kit.flow.BasicMoonFlow.step.map((s: any) => s.a), [false, undefined])
  })

  test('a record an earlier create stored fills a later step', () => {
    const op = {
      create: { points: [pt('/moon')] },
      load: { points: [pt('/moon/{title}/{id}')] },
    }
    const created = model(op, [{ o: 'create' }, { o: 'load' }])
    deepStrictEqual(guardFlowSteps(created), [])

    const bare = model(op, [{ o: 'load' }])
    deepStrictEqual(guardFlowSteps(bare), [{ flow: 'BasicMoonFlow', step: 0, op: 'load' }])

    // A create's record has no id yet, so an {id} route is out of reach.
    const upsert = model({ create: { points: [pt('/moon/{id}')] } }, [{ o: 'create' }])
    deepStrictEqual(guardFlowSteps(upsert), [{ flow: 'BasicMoonFlow', step: 0, op: 'create' }])
  })

  test('a step already off, or an op the entity lacks, is left alone', () => {
    const m = model({ list: { points: [pt('/a', 'x'), pt('/b', 'y')] } },
      [{ o: 'list', a: false }, { o: 'remove' }])
    deepStrictEqual(guardFlowSteps(m), [])
    deepStrictEqual(guardFlowSteps({}), [])
  })
})


// Novu's workflow keeps its PUT as update and its PATCH as a sixth op, which
// no bundled target generates a method for.
function patchModel(): any {
  return {
    main: {
      kit: {
        entity: {
          workflow: {
            name: 'workflow',
            op: {
              update: { name: 'update', points: [{ m: 'PUT', o: '/v2/workflows/{workflowId}' }] },
              patch: { name: 'patch', points: [{ m: 'PATCH', o: '/v2/workflows/{workflowId}' }] },
            },
          },
          project: {
            name: 'project',
            op: {
              load: { name: 'load', points: [{ m: 'GET', o: '/projects/{id}' }] },
              patch: {
                name: 'patch', points: [
                  { m: 'PATCH', o: '/projects/{project_id}' },
                  { m: 'PATCH', o: '/projects/{project_id}/off', a: false },
                ],
              },
            },
          },
          archived: {
            name: 'archived', active: false,
            op: { patch: { name: 'patch', points: [{ m: 'PATCH', o: '/archived/{id}' }] } },
          },
          planet: {
            name: 'planet',
            op: {
              list: { name: 'list', points: [{ m: 'GET', o: '/planet' }] },
              patch: { name: 'patch', active: false, points: [{ m: 'PATCH', o: '/planet/{id}' }] },
            },
          },
          ambient: { name: 'ambient' },
        },
      },
    },
  }
}


describe('ungeneratedOps — operations the bundled targets do not generate', () => {

  test('names each active op outside the five, with its active points', () => {
    deepStrictEqual(ungeneratedOps(patchModel()), [
      { entity: 'project', op: 'patch', points: ['PATCH /projects/{project_id}'] },
      { entity: 'workflow', op: 'patch', points: ['PATCH /v2/workflows/{workflowId}'] },
    ])
  })

  test('an inactive entity or op is switched off, not dropped', () => {
    const found = ungeneratedOps(patchModel()).map((d: any) => d.entity)
    ok(!found.includes('archived'), 'inactive entity reported')
    ok(!found.includes('planet'), 'inactive op reported')
  })

  test('a model without entities reports nothing', () => {
    deepStrictEqual(ungeneratedOps({}), [])
    deepStrictEqual(ungeneratedOps({ main: { kit: { entity: {} } } }), [])
  })

  test('warns once, listing every entity and op', () => {
    const warns: any[] = []
    const dropped = warnUngeneratedOps(patchModel(),
      { warn: (e: any) => warns.push(e) }, BUNDLED_ONLY)

    strictEqual(dropped.length, 2)
    strictEqual(warns.length, 1)
    strictEqual(warns[0].point, 'entity-op-ungenerated')
    for (const part of [
      'the bundled targets do not generate',
      'project.patch (PATCH /projects/{project_id})',
      'workflow.patch (PATCH /v2/workflows/{workflowId})',
      'list, load, create, update and remove',
      '.sdk/model/guide/guide.aontu',
      'op: <name>: active: false',
    ]) {
      ok(warns[0].note.includes(part), 'note names ' + part + ': ' + warns[0].note)
    }
    ok(!warns[0].note.includes('no target'), warns[0].note)
  })

  test('stays quiet when every op is generated', () => {
    const warns: any[] = []
    const model = patchModel()
    delete model.main.kit.entity.workflow.op.patch
    delete model.main.kit.entity.project.op.patch
    deepStrictEqual(warnUngeneratedOps(model,
      { warn: (e: any) => warns.push(e) }, BUNDLED_ONLY), [])
    strictEqual(warns.length, 0)
  })

  // A target from another package may generate the op, so the warning must
  // not say the op is out of reach, nor advise switching it off for all.
  test('a target from another package is named outside the claim', () => {
    const warns: any[] = []
    const dropped = warnUngeneratedOps(patchModel(),
      { warn: (e: any) => warns.push(e) }, MIXED)

    strictEqual(dropped.length, 2)
    strictEqual(warns.length, 1)
    deepStrictEqual(warns[0].bundled, ['go', 'ts'])
    deepStrictEqual(warns[0].external, MIXED.external)
    const note = warns[0].note
    for (const part of [
      'the bundled targets (go, ts) do not generate',
      'so their SDKs have no method for them',
      'workflow.patch (PATCH /v2/workflows/{workflowId})',
      'dart from node_modules/@voxgig/sdkgen-langpack/.sdk',
    ]) {
      ok(note.includes(part), 'note names ' + part + ': ' + note)
    }
    for (const claim of ['no target', 'the SDK has no method', 'active: false']) {
      ok(!note.includes(claim), 'note claims ' + claim + ': ' + note)
    }
  })

  test('says nothing when no bundled target is generated', () => {
    const warns: any[] = []
    const external = { bundled: [], external: MIXED.external }
    deepStrictEqual(warnUngeneratedOps(patchModel(),
      { warn: (e: any) => warns.push(e) }, external), [])
    deepStrictEqual(warnUngeneratedOps(patchModel(),
      { warn: (e: any) => warns.push(e) }, { bundled: [], external: [] }), [])
    strictEqual(warns.length, 0)
  })
})


const BUNDLED_ONLY = { bundled: ['go', 'ts'], external: [] }

const MIXED = {
  bundled: ['go', 'ts'],
  external: [{ name: 'dart', from: 'node_modules/@voxgig/sdkgen-langpack/.sdk' }],
}


// Every form of provenance a target's model file can carry: stamped by an add
// from the bundled scaffold (plain and aliased), the raw scaffold placeholder,
// none at all (a copy predating provenance), another package, a project-local
// package, and a checkout named by an absolute path.
function provenanceModel(checkout: string): any {
  const scaffold = { base: BUNDLED, package: '@voxgig/sdkgen' }
  return {
    main: {
      kit: {
        target: {
          go: { ...scaffold, origname: 'go' },
          go2: { ...scaffold, origname: 'go' },
          ts: { base: 'BASE' },
          js: {},
          rb: { ...scaffold, origname: 'rb', active: false },
          dart: {
            base: 'node_modules/@voxgig/sdkgen-langpack/.sdk', origname: 'dart',
            package: '@voxgig/sdkgen-langpack',
          },
          bash: { base: 'ext/.sdk', origname: 'bash' },
          py: { base: checkout, origname: 'py', package: '@voxgig/sdkgen' },
        },
      },
    },
  }
}


describe('targetOrigins — which targets the ungenerated-op warning speaks for', () => {

  test('splits the active targets by where their provenance leads', () => {
    deepStrictEqual(targetOrigins(provenanceModel('/elsewhere/sdkgen/ts/project/.sdk')), {
      bundled: ['go', 'go2', 'js', 'ts'],
      external: [
        { name: 'bash', from: 'ext/.sdk' },
        { name: 'dart', from: 'node_modules/@voxgig/sdkgen-langpack/.sdk' },
        { name: 'py', from: '/elsewhere/sdkgen/ts/project/.sdk' },
      ],
    })
    deepStrictEqual(targetOrigins({}), { bundled: [], external: [] })
  })

  // The same answer resolveSource gives when the next add re-resolves each
  // bare name from its recorded provenance, so the two cannot drift apart.
  test('agrees with resolveSource on every recorded form', () => {
    const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-origins-'))
    try {
      const root = Path.join(tmp, 'project')
      const checkout = Path.join(tmp, 'checkout', 'ts', 'project', '.sdk')
      for (const dir of [
        BUNDLED, 'node_modules/@voxgig/sdkgen-langpack/.sdk', 'ext/.sdk',
      ]) {
        Fs.mkdirSync(Path.join(root, dir), { recursive: true })
      }
      Fs.mkdirSync(checkout, { recursive: true })

      const model = provenanceModel(checkout)
      const ctx$ = { model, folder: root, fs: () => Fs, log: makeQuietLog() }
      const bundled = Path.normalize(Path.join(root, BUNDLED))
      const targets = model.main.kit.target

      let seen = 0
      for (const name of Object.keys(targets)) {
        const resolved = resolveSource(name, 'target', ctx$).folder === bundled
        strictEqual(resolvesBundled(targets[name], name), resolved, name)
        seen += resolved ? 1 : 0
      }
      strictEqual(seen, 5, 'every bundled form resolves to the scaffold')
    }
    finally {
      Fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
})


function makeQuietLog(): any {
  const noop = () => { }
  return { info: noop, warn: noop, debug: noop, error: noop }
}
