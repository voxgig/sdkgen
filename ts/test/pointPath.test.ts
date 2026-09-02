import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import {
  pointSegments,
  pointParts,
  pointTerminalParam,
  pointPathKey,
  configDefinition,
} from '../dist/sdkgen'


// apidef ADR-003: the model carries a typed segment vector, not a braced
// string. These are the ONE place sdkgen reconstructs the old form for the
// generated runtimes, so they are also the one place to test it.
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


  // The rule must stay IDENTICAL to the one in all 21 makePoint templates,
  // which read `parts` and cannot tell a braced literal from a parameter.
  // Asking the vector instead would be more accurate and would make
  // generation-time ownPoint pick a different route than the SDK picks at
  // request time, for the same model. Both sides move together or not at all.
  test('pointTerminalParam: agrees with the runtime rule, brace-for-brace', () => {
    // The runtime's rule, copied from tm/ts/src/utility/MakePointUtility.ts.
    const runtime = (point: any) => {
      const parts = pointParts(point)
      const last = 0 < parts.length ? parts[parts.length - 1] : ''
      return 'string' === typeof last && 0 === last.indexOf('{')
    }

    const points = [
      { segments: [{ lit: 'a' }, { var: 'id' }] },
      { segments: [{ var: 'id' }, { lit: 'a' }] },
      // The case that separates the two rules: a LITERAL containing braces.
      { segments: [{ lit: 'reports' }, { lit: '{id}.json' }] },
      { segments: [{ lit: 'v{version}' }] },
      { segments: [] },
    ]

    for (const pt of points) {
      strictEqual(pointTerminalParam(pt), runtime(pt),
        'diverged from the runtime on ' + JSON.stringify(pt.segments))
    }

    // And specifically: the braced literal reads as terminal, as it must.
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
                  points: [{ method: 'GET', orig: '/element/{element_id}', segments: point.segments }]
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
    // The vector is carried too, so a runtime can move over one at a time.
    deepStrictEqual(emitted.segments, point.segments)
  })

})
