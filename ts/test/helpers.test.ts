
import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import {
  collectDeps,
  buildIdNames,
  getMatchEntries,
  safeVarName,
  isRbCoreConstant,
  rbSafeTypeName,
} from '../dist/sdkgen.js'


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

    test('a package required by two features appears once', () => {
      // Duplicate manifest keys are a hard parse error in go.mod / Cargo.toml
      // and silently last-wins in package.json, so the same package required
      // by several features must collapse to a single entry.
      const model: any = makeModel()
      model.main.kit.feature.extra = {
        active: true,
        deps: { go: { 'github.com/x/auth': { active: true, version: 'v1.0.0' } } },
      }
      const names = collectDeps(model, 'go', undefined).map((d) => d.name)
      deepStrictEqual(names, ['github.com/x/auth'])
    })

    test('a conflicting duplicate version keeps the first and warns', () => {
      const model: any = makeModel()
      model.main.kit.feature.extra = {
        active: true,
        deps: { go: { 'github.com/x/auth': { active: true, version: 'v2.0.0' } } },
      }
      const warnings: any[] = []
      const log = { warn: (w: any) => warnings.push(w) }
      const out = collectDeps(model, 'go', undefined, log)
      deepStrictEqual(out.map((d) => d.name), ['github.com/x/auth'])
      strictEqual(out[0].version, 'v1.0.0', 'first (sorted-key) occurrence wins')
      strictEqual(warnings.length, 1)
      strictEqual(warnings[0].point, 'dep-version-conflict')
      strictEqual(warnings[0].dropped, 'v2.0.0')
    })

    test('a target dep duplicating a feature dep does not double up', () => {
      const out = collectDeps(makeModel(), 'go', {
        'github.com/x/auth': { version: 'v1.0.0' },
      } as any)
      deepStrictEqual(out.map((d) => d.name), ['github.com/x/auth'])
      strictEqual(out[0].source, 'feature', 'feature entry retained')
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


  describe('safeVarName', () => {

    test('sanitises reserved words per language with a trailing _', () => {
      // Ruby: `self = ...` is a SyntaxError (Cloudsmith's Self entity).
      strictEqual(safeVarName('self', 'rb'), 'self_')
      strictEqual(safeVarName('end', 'rb'), 'end_')
      // Python keyword.
      strictEqual(safeVarName('class', 'py'), 'class_')
      // Lua keyword — but `self` is NOT reserved in Lua.
      strictEqual(safeVarName('end', 'lua'), 'end_')
      strictEqual(safeVarName('self', 'lua'), 'self')
      // Existing languages still work.
      strictEqual(safeVarName('delete', 'ts'), 'delete_')
      strictEqual(safeVarName('type', 'go'), 'type_')
    })

    test('leaves non-reserved names untouched', () => {
      strictEqual(safeVarName('component', 'rb'), 'component')
      strictEqual(safeVarName('cargo', 'py'), 'cargo')
      strictEqual(safeVarName('abort', 'lua'), 'abort')
    })
  })


  describe('rbSafeTypeName', () => {

    test('suffixes constants Ruby core already owns', () => {
      // The Customs Window regression: `/files` -> entity File -> the typed
      // model emitted `File = Struct.new(...)`, silently REPLACING ::File, so
      // the generated test runner's File.join raised NoMethodError.
      strictEqual(rbSafeTypeName('File'), 'FileType')
      strictEqual(rbSafeTypeName('Time'), 'TimeType')
      strictEqual(rbSafeTypeName('Data'), 'DataType')
      strictEqual(rbSafeTypeName('Dir'), 'DirType')
      strictEqual(rbSafeTypeName('IO'), 'IOType')
      strictEqual(rbSafeTypeName('Set'), 'SetType')
      strictEqual(rbSafeTypeName('Process'), 'ProcessType')
      strictEqual(rbSafeTypeName('Hash'), 'HashType')
    })

    test('leaves every other entity name untouched', () => {
      // The guard must not churn the existing fleet: names that merely LOOK
      // builtin are not core constants and stay as they are.
      strictEqual(rbSafeTypeName('Response'), 'Response')
      strictEqual(rbSafeTypeName('Record'), 'Record')
      strictEqual(rbSafeTypeName('BulkUpload'), 'BulkUpload')
      strictEqual(rbSafeTypeName('Submission'), 'Submission')
      strictEqual(rbSafeTypeName('Account'), 'Account')
    })

    test('matches exactly — case-sensitive, no partial hits', () => {
      // Only the exact constant is owned by Ruby; compounds are free.
      strictEqual(rbSafeTypeName('FileUpload'), 'FileUpload')
      strictEqual(rbSafeTypeName('TimeSeries'), 'TimeSeries')
      strictEqual(rbSafeTypeName('Filetype'), 'Filetype')
      strictEqual(isRbCoreConstant('File'), true)
      strictEqual(isRbCoreConstant('file'), false)
    })

    test('per-op type names never need the guard', () => {
      // EntityTypes_rb applies the guard to the bare data type only; op names
      // always carry a suffix, and no core constant ends with one.
      strictEqual(rbSafeTypeName('FileCreateData'), 'FileCreateData')
      strictEqual(rbSafeTypeName('FileLoadMatch'), 'FileLoadMatch')
    })
  })

})
