
import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import {
  collectDeps,
  buildIdNames,
  getMatchEntries,
} from '../'


describe('helpers', () => {

  describe('collectDeps', () => {

    // Model shape mirrors what getModelPath(model, 'main.kit.feature')
    // expects: an active-flagged feature map, each feature carrying a
    // per-language `deps` block. `key$` is injected by jostraca's each()
    // during iteration, so plain object keys are enough here.
    function makeModel() {
      return {
        main: {
          kit: {
            feature: {
              auth: {
                active: true,
                deps: {
                  go: {
                    'github.com/x/auth': { active: true, version: 'v1.0.0' },
                    'github.com/x/off': { active: false, version: 'v9' },
                  },
                },
              },
              log: {
                active: true,
                deps: {
                  // No `active` → feature deps default OFF, so excluded.
                  go: { 'github.com/x/log': { version: 'v2.0.0' } },
                },
              },
              disabled: {
                active: false,
                deps: { go: { 'github.com/x/nope': { active: true, version: 'v3' } } },
              },
            },
          },
        },
      }
    }

    test('feature deps included only when active===true', () => {
      const out = collectDeps(makeModel(), 'go', undefined)
      deepStrictEqual(out.map((d) => d.name), ['github.com/x/auth'])
      strictEqual(out[0].source, 'feature')
      strictEqual(out[0].version, 'v1.0.0')
    })

    test('inactive features are excluded entirely', () => {
      // `disabled` is active:false → never contributes its deps.
      const names = collectDeps(makeModel(), 'go', undefined).map((d) => d.name)
      strictEqual(names.includes('github.com/x/nope'), false)
    })

    test('no deps for a language with none', () => {
      strictEqual(collectDeps(makeModel(), 'py', undefined).length, 0)
    })

    test('target deps included unless active===false', () => {
      const targetDeps = {
        'github.com/t/a': { version: 'v5' }, // default on
        'github.com/t/b': { active: false, version: 'v6' }, // off
        'github.com/t/c': { active: true, version: 'v7' }, // on
      }
      const out = collectDeps(makeModel(), 'go', targetDeps)
      const byName = Object.fromEntries(out.map((d) => [d.name, d]))

      // feature dep + the two active target deps
      deepStrictEqual(
        out.map((d) => d.name).sort(),
        ['github.com/t/a', 'github.com/t/c', 'github.com/x/auth'],
      )
      strictEqual(byName['github.com/t/a'].source, 'target')
      strictEqual(byName['github.com/t/c'].version, 'v7')
      strictEqual(byName['github.com/t/b'], undefined)
    })

    test('raw object is exposed for caller-specific fields', () => {
      const targetDeps = { 'github.com/t/a': { version: 'v5', replace: './local' } }
      const out = collectDeps(makeModel(), 'go', targetDeps)
      const a = out.find((d) => d.name === 'github.com/t/a')
      strictEqual(a?.raw.replace, './local')
    })
  })


  describe('buildIdNames', () => {

    test('entity ids plus ancestor ids plus match/data aliases', () => {
      const entity = { name: 'moon', relations: { ancestors: ['planet'] } }
      const flow = {
        step: {
          s1: { match: { year: 'year01', id: 'self$' } },
          s2: { data: { type_id: 'data_type01' } },
        },
      }
      deepStrictEqual(buildIdNames(entity, flow), [
        'moon01', 'moon02', 'moon03',
        'planet01', 'planet02', 'planet03',
        'year01',
        'data_type01',
      ])
    })

    test('skips $-suffixed sentinel values and dedupes', () => {
      const entity = { name: 'moon' }
      const flow = {
        step: {
          // 'moon01' duplicate must not be repeated; 'x$' is a sentinel.
          s1: { match: { a: 'moon01', b: 'x$' } },
        },
      }
      deepStrictEqual(buildIdNames(entity, flow), ['moon01', 'moon02', 'moon03'])
    })

    test('flattens nested ancestor arrays', () => {
      const entity = { name: 'leaf', relations: { ancestors: [['root'], ['branch']] } }
      const out = buildIdNames(entity, { step: {} })
      strictEqual(out.includes('root01'), true)
      strictEqual(out.includes('branch03'), true)
    })

    test('accepts array-form flow steps', () => {
      const entity = { name: 'moon' }
      const flow = { step: [{ match: { year: 'year01' } }] }
      strictEqual(buildIdNames(entity, flow).includes('year01'), true)
    })

    test('no relations and no steps yields just the entity ids', () => {
      deepStrictEqual(buildIdNames({ name: 'sun' }, {}), ['sun01', 'sun02', 'sun03'])
    })
  })


  describe('getMatchEntries', () => {

    test('returns non-sentinel entries only', () => {
      const step = { match: { a: 1, b$: 2, c: 'x' } }
      deepStrictEqual(getMatchEntries(step), [['a', 1], ['c', 'x']])
    })

    test('empty / missing match returns empty array', () => {
      deepStrictEqual(getMatchEntries({}), [])
      deepStrictEqual(getMatchEntries(undefined), [])
      deepStrictEqual(getMatchEntries({ match: {} }), [])
    })
  })

})
