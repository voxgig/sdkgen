import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fs from 'node:fs'
import { Aontu } from 'aontu'
import {
  buildIdNames, configDefinition, entityDataSpec, flowSteps, guardModelNames,
  liveHint, opRequestShape, pointFacts, pointSegments,
} from '../dist/sdkgen'

test('compact schema preserves field, argument, point, flow and relation semantics', () => {
  const schema = Fs.readFileSync(require.resolve('@voxgig/apidef/model/apidef.aontu'), 'utf8')
  const model = new Aontu().generate(schema + `
    const: Name: Demo
    main: kit: config: headers: {}
    main: kit: info: auth: false
    main: kit: feature: {}
    main: kit: entity: {
      planet: {}
      moon: {
        fields: {
          radius: { h: Radius, r: false, t: "\`$NUMBER\`", fo: "float" }
          id: { h: Id, r: true, t: "\`$STRING\`" }
          hidden: { h: Hidden, r: true, t: "\`$STRING\`", a: false }
        }
        relations: ancestors: [[path($.main.kit.entity.planet)]]
        op: load: {
          name: load
          points: [{
            m: GET, o: '/planet/{planet_id}/moon/{id}'
            s: [{lit: planet}, {var: planet_id}, {lit: moon}, {var: id}]
            g: params: [
              {n: planet_id, r: true, t: "\`$STRING\`", ex: p01}
              {n: id, r: true, t: "\`$STRING\`"}
            ]
          }]
        }
      }
    }
    main: kit: flow: BasicMoonFlow: step: [
      {o: load, m: {planet_id: planet01}}
      {a: false, o: remove, m: {id: unused01}}
    ]
  `)
  const entity = model.main.kit.entity.moon
  const flow = model.main.kit.flow.BasicMoonFlow
  assert.deepEqual(buildIdNames(entity, flow), ['moon01', 'moon02', 'moon03', 'planet01', 'planet02', 'planet03'])
  assert.equal(flowSteps(flow).length, 1)
  assert.equal(entity.fields.radius.n, 'radius')
  assert.equal(entityDataSpec(entity).hidden, undefined)
  assert.deepEqual(opRequestShape(entity, 'load').items.map(i => i.name), ['planet_id', 'id'])
  const runtime = configDefinition(model).def.entity.moon
  assert.equal(runtime.fields.find((f: any) => f.name === 'radius').title, 'Radius')
  assert.equal(runtime.fields.find((f: any) => f.name === 'radius').format, 'float')
  assert.equal(runtime.fields.some((f: any) => f.name === 'hidden'), false)
  assert.equal(runtime.op.load.points[0].args.params[0].example, 'p01')
  assert.deepEqual(runtime.op.load.points[0].parts, ['planet', '{planet_id}', 'moon', '{id}'])
})

test('relation addresses follow entity renames', () => {
  const model: any = { main: { kit: { entity: {
    '3planet': { name: '3planet' },
    moon: { name: 'moon', relations: { ancestors: [['$.main.kit.entity.3planet']] } },
  } } } }
  guardModelNames(model)
  assert.deepEqual(model.main.kit.entity.moon.relations.ancestors, [['$.main.kit.entity.n3planet']])
})

test('live facts come from the resolved specification and hints from li', () => {
  const point = { m: 'POST', o: '/moon', li: { id: 'create-moon' } }
  const facts = { protocol: 'http', requestBody: { required: true } }
  const ctx = { meta: { apidef: { operation(method: string, path: string) {
    assert.equal(method, 'POST')
    assert.equal(path, '/moon')
    return facts
  } } } }
  assert.equal(pointFacts(ctx, point), facts)
  assert.deepEqual(pointFacts({}, point), {})
  assert.deepEqual(liveHint(point), { id: 'create-moon' })
  assert.throws(() => pointSegments({ orig: '/old', segments: [{ lit: 'old' }] }), /regenerate/)
})
