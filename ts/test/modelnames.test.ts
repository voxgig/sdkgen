/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */


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
            points: [{ m: 'GET', o: '/3ds-sessions' }],
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

  test('cases the prefix to the name', () => {
    equal(prefixLeadingDigit('3ds_session'), 'n3ds_session')
    equal(prefixLeadingDigit('2fa_token'), 'n2fa_token')
    equal(prefixLeadingDigit('3DSecure'), 'N3DSecure')
    equal(prefixLeadingDigit('404'), 'n404')
  })


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

    equal(ents.n3ds_session.Name, undefined)
  })


  // THE WIRE IS NOT THE NAME. A request path comes from the point's `orig`,
  // so renaming the entity must not change what the SDK calls — that would
  // turn a compile failure into a silent 404.
  test('leaves the route untouched', () => {
    const model = digitModel()
    guardModelNames(model)

    const point = model.main[KIT].entity.n3ds_session.op.list.points[0]
    equal(point.o, '/3ds-sessions')
  })


  test('moves the flow that references it', () => {
    const model = digitModel()
    guardModelNames(model)

    const flow = model.main[KIT].flow
    equal(flow.Basic3dsSessionFlow, undefined, 'old flow key removed')
    ok(null != flow.BasicN3dsSessionFlow, 'flow rekeyed to the new Name')
    equal(flow.BasicN3dsSessionFlow.entity, 'n3ds_session')
    equal(flow.BasicN3dsSessionFlow.name, 'BasicN3dsSessionFlow')

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


  test('is a no-op on a clean model', () => {
    const model = makeModel({
      entity: { planet: { name: 'planet' } },
      flow: { BasicPlanetFlow: { name: 'BasicPlanetFlow', entity: 'planet' } },
    })
    const before = JSON.stringify(model)

    deepEqual(guardModelNames(model), [])
    equal(JSON.stringify(model), before)
  })


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


// SMSAPI's /contacts/fields gave apidef both `contacts_field` and
// `contactsfield`: classes ContactsFieldEntity and ContactsfieldEntity, one
// file on macOS and Windows, one class in PHP everywhere.
function foldModel(): any {
  return makeModel({
    entity: {
      contacts_field: {
        name: 'contacts_field',
        op: {
          list: { name: 'list', points: [{ m: 'GET', o: '/contacts/fields' }] },
        },
      },
      contactsfield: {
        name: 'contactsfield',
        op: {
          create: { name: 'create', points: [{ m: 'POST', o: '/contacts/fields' }] },
          remove: {
            name: 'remove', points: [{ m: 'DELETE', o: '/contacts/fields/{id}' }],
          },
        },
      },
      planet: {
        name: 'planet',
        relations: { ancestors: [['$.main.kit.entity.contactsfield']] },
      },
    },
    flow: {
      BasicContactsFieldFlow: {
        name: 'BasicContactsFieldFlow', entity: 'contacts_field', kind: 'basic',
      },
      BasicContactsfieldFlow: {
        name: 'BasicContactsfieldFlow', entity: 'contactsfield', kind: 'basic',
      },
    },
  })
}


describe('guard-model-names: names that meet once case is ignored', () => {

  test('renames one of the pair, with its key and derived forms', () => {
    const model = foldModel()
    model.main[KIT].entity.contactsfield.Name = 'Contactsfield'

    deepEqual(guardModelNames(model),
      [{ from: 'contactsfield', to: 'contactsfield2', key: 'contactsfield2' }])

    const ents = model.main[KIT].entity
    equal(ents.contactsfield, undefined, 'old key removed')
    equal(ents.contactsfield2.name, 'contactsfield2')
    equal(ents.contactsfield2.Name, undefined, 'derived form re-derived later')
    equal(ents.contacts_field.name, 'contacts_field', 'the other keeps its name')
  })


  test('leaves every route untouched', () => {
    const model = foldModel()
    guardModelNames(model)

    const op = model.main[KIT].entity.contactsfield2.op
    equal(op.create.points[0].o, '/contacts/fields')
    equal(op.remove.points[0].o, '/contacts/fields/{id}')
  })


  test('moves the flow and the ancestor reference with it', () => {
    const model = foldModel()
    guardModelNames(model)

    const flow = model.main[KIT].flow
    equal(flow.BasicContactsfieldFlow, undefined, 'old flow key removed')
    equal(flow.BasicContactsfield2Flow.entity, 'contactsfield2')
    equal(flow.BasicContactsfield2Flow.name, 'BasicContactsfield2Flow')
    equal(flow.BasicContactsFieldFlow.entity, 'contacts_field')

    deepEqual(model.main[KIT].entity.planet.relations.ancestors,
      [['$.main.kit.entity.contactsfield2']])
  })


  test('renames the same entity whatever order the model holds them in', () => {
    const model = foldModel()
    const ents = model.main[KIT].entity
    model.main[KIT].entity = {
      planet: ents.planet, contactsfield: ents.contactsfield,
      contacts_field: ents.contacts_field,
    }

    deepEqual(guardModelNames(model),
      [{ from: 'contactsfield', to: 'contactsfield2', key: 'contactsfield2' }])
  })


  test('names that differ only in case collide too', () => {
    const model = makeModel({
      entity: { Widget: { name: 'Widget' }, widget: { name: 'widget' } },
    })

    deepEqual(guardModelNames(model),
      [{ from: 'widget', to: 'widget2', key: 'widget2' }])
  })


  // rust, c, cpp, zig and ocaml name files and identifiers by turning every
  // non-word character into `_`, which the PascalCase form keeps.
  test('names the C-family targets fold together collide', () => {
    const model = makeModel({
      entity: { 'foo.bar': { name: 'foo.bar' }, foo_bar: { name: 'foo_bar' } },
    })

    deepEqual(guardModelNames(model),
      [{ from: 'foo_bar', to: 'foo_bar2', key: 'foo_bar2' }])
  })


  test('an inactive entity yields its name to an active one', () => {
    const model = foldModel()
    model.main[KIT].entity.contacts_field.active = false

    deepEqual(guardModelNames(model),
      [{ from: 'contacts_field', to: 'contacts_field2', key: 'contacts_field2' }])
  })


  // The digit guard runs first; its own product must not push aside a name
  // the model chose.
  test('a name the digit guard produced yields to one the model chose', () => {
    const model = makeModel({
      entity: {
        '3ds_session': { name: '3ds_session' },
        n3dssession: { name: 'n3dssession' },
      },
    })

    deepEqual(guardModelNames(model), [
      { from: '3ds_session', to: 'n3ds_session', key: 'n3ds_session' },
      { from: 'n3ds_session', to: 'n3ds_session2', key: 'n3ds_session2' },
    ])
    ok(null != model.main[KIT].entity.n3dssession, 'the model name kept')
  })


  test('the new name avoids every other name, case ignored', () => {
    const model = foldModel()
    model.main[KIT].entity.Contacts_Field2 = { name: 'Contacts_Field2' }

    deepEqual(guardModelNames(model),
      [{ from: 'contactsfield', to: 'contactsfield3', key: 'contactsfield3' }])
  })


  test('a flow already on the new key moves the suffix on', () => {
    const model = foldModel()
    model.main[KIT].flow.BasicContactsfield2Flow = {
      name: 'BasicContactsfield2Flow', entity: 'something_else', kind: 'basic',
    }

    deepEqual(guardModelNames(model),
      [{ from: 'contactsfield', to: 'contactsfield3', key: 'contactsfield3' }])
    equal(model.main[KIT].flow.BasicContactsfield2Flow.entity, 'something_else')
    equal(model.main[KIT].flow.BasicContactsfield3Flow.entity, 'contactsfield3')
  })


  test('every member past the first of a larger group is renamed', () => {
    const model = makeModel({
      entity: {
        ab: { name: 'ab' }, a_b: { name: 'a_b' }, 'a-b': { name: 'a-b' },
      },
    })

    deepEqual(guardModelNames(model), [
      { from: 'a_b', to: 'a_b2', key: 'a_b2' },
      { from: 'ab', to: 'ab3', key: 'ab3' },
    ])
    deepEqual(Object.keys(model.main[KIT].entity).sort(), ['a-b', 'a_b2', 'ab3'])
  })


  test('keeps a key that is not the name', () => {
    const model = makeModel({
      entity: {
        contacts_field: { name: 'contacts_field' },
        fields: { name: 'contactsfield' },
      },
    })

    deepEqual(guardModelNames(model),
      [{ from: 'contactsfield', to: 'contactsfield2', key: 'fields' }])
    equal(model.main[KIT].entity.fields.name, 'contactsfield2')
  })


  test('names that only look alike are left alone', () => {
    const model = makeModel({
      entity: {
        contact: { name: 'contact' }, contacts: { name: 'contacts' },
        field_set: { name: 'field_set' }, fieldset_item: { name: 'fieldset_item' },
      },
    })
    const before = JSON.stringify(model)

    deepEqual(guardModelNames(model), [])
    equal(JSON.stringify(model), before)
  })


  test('warns once per pair, naming both, the new name and the guide', () => {
    const warns: any[] = []
    guardModelNames(foldModel(), { warn: (e: any) => warns.push(e) })

    equal(warns.length, 1)
    equal(warns[0].point, 'entity-name-case-guard')
    deepEqual(warns[0].names, ['contacts_field', 'contactsfield'])
    deepEqual(warns[0].renames,
      [{ from: 'contactsfield', to: 'contactsfield2', key: 'contactsfield2' }])

    const note = warns[0].note
    for (const part of [
      'contacts_field, contactsfield', 'ContactsField, Contactsfield',
      'contactsfield -> contactsfield2',
      '/contacts/fields, /contacts/fields/{id}',
      '.sdk/model/guide/guide.aontu',
      'guide: entity: contactsfield: active: false',
      '.sdk/test/entity/contactsfield/ContactsfieldTestData.json',
      '.sdk/test/entity/contactsfield2/Contactsfield2TestData.json',
    ]) {
      ok(note.includes(part), 'note names ' + part + ': ' + note)
    }
  })

})
