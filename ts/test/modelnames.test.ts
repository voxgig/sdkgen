/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

// The leading-digit entity-name guard (issue #124).
//
// An entity name is a model KEY and an identifier STEM at once. Every target
// builds identifiers from it — the PascalCase Name for classes, the SDK
// accessor and every generated type; the snake stem for python modules and
// test functions; the bare key in the emitted config map — and no target
// language permits an identifier that starts with a digit. `/3ds-sessions`
// produces the entity `3ds_session`, and the generated SDK does not compile
// at all.
//
// These tests pin the RENAME and, just as importantly, everything it must not
// disturb: the wire route, an already-clean model, and the model's own
// references to the entity it renamed.

import { test, describe } from 'node:test'
import { equal, deepEqual, ok } from 'node:assert'

import { guardModelNames, prefixLeadingDigit } from '../dist/sdkgen'

import { KIT } from '@voxgig/apidef'


function makeModel(spec: any): any {
  return { main: { [KIT]: spec } }
}


function digitModel(): any {
  return makeModel({
    entity: {
      '3ds_session': {
        name: '3ds_session',
        op: {
          list: {
            name: 'list',
            points: [{ method: 'GET', orig: '/3ds-sessions' }],
          },
        },
      },
      planet: { name: 'planet' },
    },
    flow: {
      Basic3dsSessionFlow: {
        name: 'Basic3dsSessionFlow', entity: '3ds_session', kind: 'basic',
      },
      BasicPlanetFlow: {
        name: 'BasicPlanetFlow', entity: 'planet', kind: 'basic',
      },
    },
  })
}


describe('prefix-leading-digit', () => {

  // The prefix takes the case of the name it guards, so the result stays in
  // whatever casing convention the caller works in. The guard runs on the
  // snake STEM, which is why the PascalCase comes out `N3dsSession`.
  test('cases the prefix to the name', () => {
    equal(prefixLeadingDigit('3ds_session'), 'n3ds_session')
    equal(prefixLeadingDigit('2fa_token'), 'n2fa_token')
    equal(prefixLeadingDigit('3DSecure'), 'N3DSecure')
    equal(prefixLeadingDigit('404'), 'n404')
  })


  // Identity on anything already legal — which is every name in every model
  // apidef produces, since apidef applies the same rule at the source.
  test('is identity on a legal name', () => {
    for (const n of ['planet', 'payment_method', '_private', 'n3ds_session']) {
      equal(prefixLeadingDigit(n), n)
    }
  })

})


describe('guard-model-names', () => {

  test('renames the entity, its key and its derived forms', () => {
    const model = digitModel()
    const renames = guardModelNames(model)

    deepEqual(renames,
      [{ from: '3ds_session', to: 'n3ds_session', key: 'n3ds_session' }])

    const ents = model.main[KIT].entity
    equal(ents['3ds_session'], undefined, 'old key removed')
    equal(ents.n3ds_session.name, 'n3ds_session')

    // Any `Name` an earlier pass derived has to go, or the rename leaves the
    // model inconsistent with itself.
    equal(ents.n3ds_session.Name, undefined)
  })


  // THE WIRE IS NOT THE NAME. A request path comes from the point's `orig`,
  // so renaming the entity must not change what the SDK calls — that would
  // turn a compile failure into a silent 404.
  test('leaves the route untouched', () => {
    const model = digitModel()
    guardModelNames(model)

    const point = model.main[KIT].entity.n3ds_session.op.list.points[0]
    equal(point.orig, '/3ds-sessions')
  })


  // The Test components find an entity's flow by a key REBUILT from the
  // PascalCase Name (`Basic${nom(entity, 'Name')}Flow`), so a rename that
  // leaves the flow key behind generates no tests for that entity — and says
  // nothing about it.
  test('moves the flow that references it', () => {
    const model = digitModel()
    guardModelNames(model)

    const flow = model.main[KIT].flow
    equal(flow.Basic3dsSessionFlow, undefined, 'old flow key removed')
    ok(null != flow.BasicN3dsSessionFlow, 'flow rekeyed to the new Name')
    equal(flow.BasicN3dsSessionFlow.entity, 'n3ds_session')
    equal(flow.BasicN3dsSessionFlow.name, 'BasicN3dsSessionFlow')

    // An unrelated entity's flow is not touched.
    equal(flow.BasicPlanetFlow.entity, 'planet')
  })


  test('rewrites ancestor references', () => {
    const model = digitModel()
    model.main[KIT].entity.planet.relations = {
      ancestors: [['3ds_session'], 'other'],
    }
    guardModelNames(model)

    deepEqual(model.main[KIT].entity.planet.relations.ancestors,
      [['n3ds_session'], 'other'])
  })


  // A no-op has to be a REAL no-op: no rename, and nothing in the model
  // rewritten. This is the case for every model apidef produces.
  test('is a no-op on a clean model', () => {
    const model = makeModel({
      entity: { planet: { name: 'planet' } },
      flow: { BasicPlanetFlow: { name: 'BasicPlanetFlow', entity: 'planet' } },
    })
    const before = JSON.stringify(model)

    deepEqual(guardModelNames(model), [])
    equal(JSON.stringify(model), before)
  })


  // Renaming onto a name another entity already owns would merge two
  // unrelated entities silently — the model is a plain map. Refuse, and warn:
  // the SDK still will not compile, but the reason is in the log instead of
  // in a syntax error many files later.
  test('refuses a rename that would collide, and warns', () => {
    const model = makeModel({
      entity: {
        '3ds_session': { name: '3ds_session' },
        n3ds_session: { name: 'n3ds_session' },
      },
    })

    const warns: any[] = []
    deepEqual(guardModelNames(model, { warn: (e: any) => warns.push(e) }), [])

    equal(model.main[KIT].entity['3ds_session'].name, '3ds_session')
    equal(warns.length, 1)
    equal(warns[0].point, 'entity-name-guard-blocked')
    deepEqual(warns[0].names, ['3ds_session'])
  })


  // `name` is authoritative, not the key. A collection whose key is not the
  // entity's own name still gets the name guarded — every derived identifier
  // comes from `name` — but the key stays where the model put it, because
  // moving a key the model did not derive from the name would break whatever
  // set it.
  test('guards the name but keeps a key that is not the name', () => {
    const model = makeModel({
      entity: { sessions: { name: '3ds_session' } },
    })

    deepEqual(guardModelNames(model),
      [{ from: '3ds_session', to: 'n3ds_session', key: 'sessions' }])

    const ents = model.main[KIT].entity
    equal(ents.n3ds_session, undefined, 'the key did not move')
    equal(ents.sessions.name, 'n3ds_session', 'the name was guarded')
  })


  // An ARRAY is not a name-keyed collection — its keys are indices — so
  // treating index `0` as a name would rewrite the model into nonsense.
  test('leaves an array-shaped collection alone', () => {
    const model = makeModel({ entity: [{ name: 'planet' }] })
    deepEqual(guardModelNames(model), [])
    deepEqual(model.main[KIT].entity, [{ name: 'planet' }])
  })


  // The basic flow key is REBUILT from the guarded `Name` by every Test
  // component. If that key is already held by a different flow, renaming
  // would point all of them at that one and strand this entity's own flow
  // under its old key — generated tests that exercise the wrong entity,
  // silently. Refuse, as for an entity-name collision.
  test('refuses a rename that would strand the flow', () => {
    const model = digitModel()
    model.main[KIT].flow.BasicN3dsSessionFlow = {
      name: 'BasicN3dsSessionFlow', entity: 'something_else', kind: 'basic',
    }

    const warns: any[] = []
    deepEqual(guardModelNames(model, { warn: (e: any) => warns.push(e) }), [])

    // Nothing moved: not the entity, not its flow, not the flow's `entity`.
    const ents = model.main[KIT].entity
    equal(ents['3ds_session'].name, '3ds_session')

    const flow = model.main[KIT].flow
    equal(flow.Basic3dsSessionFlow.entity, '3ds_session')
    equal(flow.BasicN3dsSessionFlow.entity, 'something_else')

    equal(warns.length, 1)
    equal(warns[0].point, 'entity-name-guard-blocked')
  })


  // The generated flow test reads its fixture from
  // `.sdk/test/entity/<name>/<Name>TestData.json`, which sdkgen READS and
  // never writes — it is the project's own content. The rename cannot carry
  // it, so the warning has to name the file, or the project owner is left
  // with a compiling SDK and an unexplained missing-fixture failure.
  test('warns with the fixture path the rename cannot carry', () => {
    const warns: any[] = []
    guardModelNames(digitModel(), { warn: (e: any) => warns.push(e) })

    equal(warns.length, 1)
    equal(warns[0].point, 'entity-name-guard')
    deepEqual(warns[0].renames,
      [{ from: '3ds_session', to: 'n3ds_session', key: 'n3ds_session' }])

    const note = warns[0].note
    ok(note.includes('.sdk/test/entity/3ds_session/3dsSessionTestData.json'),
      'names the fixture to move: ' + note)
    ok(note.includes('.sdk/test/entity/n3ds_session/N3dsSessionTestData.json'),
      'names where it goes: ' + note)
    ok(note.includes('existing.3ds_session'), 'names the key inside it')
  })


  test('survives a model with no entities', () => {
    deepEqual(guardModelNames({}), [])
    deepEqual(guardModelNames(makeModel({})), [])
  })

})
