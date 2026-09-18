import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual, ok } from 'node:assert'

import {
  pointSegments,
  pointParts,
  pointTerminalParam,
  pointPathKey,
  configDefinition,
} from '../dist/sdkgen'


describe('pointPath', () => {

  const point = {
    segments: [{ lit: 'element' }, { var: 'id' }, { lit: 'ionize' }]
  }


  test('pointParts: the braced form the runtimes still read', () => {
    deepStrictEqual(pointParts(point), ['element', '{id}', 'ionize'])
  })


  // GraphQL points address the single endpoint and carry no path. A missing
  // or malformed vector is empty, never a crash — this helper runs inside
  // every component that touches a route.
  test('pointParts: no path is empty, not a fault', () => {
    deepStrictEqual(pointParts({ segments: [] }), [])
    deepStrictEqual(pointParts({}), [])
    deepStrictEqual(pointParts(null), [])
    deepStrictEqual(pointParts({ segments: 'nonsense' }), [])
    deepStrictEqual(pointSegments(undefined), [])
  })


  test('pointSegments: a stale `parts` model is refused, not read as pathless', () => {
    const stale = { orig: '/element/{element_id}', parts: ['element', '{id}'] }

    let msg = ''
    try {
      pointSegments(stale)
    }
    catch (e: any) {
      msg = String(e.message)
    }

    ok(msg.includes('/element/{element_id}'), 'names the offending path: ' + msg)
    ok(msg.includes('segments'), 'names what is missing: ' + msg)
    ok(msg.includes('npm run generate'), 'says how to fix it: ' + msg)

    deepStrictEqual(pointSegments({ orig: '', segments: [] }), [])
    deepStrictEqual(pointSegments({}), [])
  })


  // A literal that CONTAINS braces is a literal. apidef leaves a compound
  // element like `{a}.{b}` literal because it names no single parameter, and
  // reconstruction must not promote it back into one.
  test('pointParts: a literal containing braces stays literal', () => {
    deepStrictEqual(
      pointParts({ segments: [{ lit: 'x' }, { lit: '{a}.{b}' }] }),
      ['x', '{a}.{b}'])
  })


  test('pointTerminalParam: does the route end in a parameter?', () => {
    strictEqual(pointTerminalParam({ segments: [{ lit: 'a' }, { var: 'id' }] }), true)
    strictEqual(pointTerminalParam({ segments: [{ var: 'id' }, { lit: 'a' }] }), false)
    strictEqual(pointTerminalParam({ segments: [] }), false)
    strictEqual(pointTerminalParam(null), false)
  })


  test('pointTerminalParam: agrees with the runtime rule, brace-for-brace', () => {
    const runtime = (point: any) => {
      const parts = pointParts(point)
      const last = 0 < parts.length ? parts[parts.length - 1] : ''
      return 'string' === typeof last && 0 === last.indexOf('{')
    }

    const points = [
      { segments: [{ lit: 'a' }, { var: 'id' }] },
      { segments: [{ var: 'id' }, { lit: 'a' }] },
      { segments: [{ lit: 'reports' }, { lit: '{id}.json' }] },
      { segments: [{ lit: 'v{version}' }] },
      { segments: [] },
    ]

    for (const pt of points) {
      strictEqual(pointTerminalParam(pt), runtime(pt),
        'diverged from the runtime on ' + JSON.stringify(pt.segments))
    }

    strictEqual(
      pointTerminalParam({ segments: [{ lit: 'reports' }, { lit: '{id}.json' }] }), true)
  })


  // The route-identity test the braced form could not make safely: a LITERAL
  // spelled `{id}` is not the same route as a PARAMETER named `id`, but
  // joining the reconstructed strings makes them identical.
  test('pointPathKey: a literal never collides with a parameter', () => {
    const asParam = { segments: [{ lit: 'a' }, { var: 'id' }] }
    const asLiteral = { segments: [{ lit: 'a' }, { lit: '{id}' }] }

    deepStrictEqual(pointParts(asParam), pointParts(asLiteral))
    strictEqual(pointPathKey(asParam) === pointPathKey(asLiteral), false)
  })


  // configDefinition is the ONLY place a point reaches generated output, so
  // it is the only place `parts` has to be reconstructed. If this stops
  // happening the SDKs generate empty paths.
  test('configDefinition: the embedded config carries parts', () => {
    const model = {
      const: { Name: 'Element' },
      main: {
        kit: {
          entity: {
            element: {
              name: 'element',
              fields: {},
              op: {
                load: {
                  name: 'load',
                  points: [{ method: 'GET', orig: '/element/{element_id}', segments: point.segments, contract: { version: 1, json: '{"requestBody":{}}' } }]
                }
              }
            }
          },
          config: { headers: {} },
          info: { servers: [{ url: 'http://x' }] },
        }
      }
    }

    const { def } = configDefinition(model as any)
    const emitted = def.entity.element.op.load.points[0]

    deepStrictEqual(emitted.parts, ['element', '{id}', 'ionize'])
    deepStrictEqual(emitted.segments, point.segments)
    strictEqual(emitted.contract, undefined, 'test contracts must not inflate runtime configuration')
    strictEqual(model.main.kit.entity.element.op.load.points[0].contract.json,
      '{"requestBody":{}}', 'test generators still need the original contract')
  })

})
