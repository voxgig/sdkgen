
import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

const { CANON_TYPE, CANON_ANY } = require('../dist/helpers/canonType.js')
const { canonKey, canonToType } = require('../dist/sdkgen.js')


// The sentinel vocabulary apidef produces, mirrored here so the table is
// guarded even when apidef cannot be interrogated. Adding a sentinel to
// apidef without adding it here AND to CANON_TYPE is the drift this catches
// on the sdkgen side; the apidef cross-check below catches the other side.
const EXPECTED_SENTINELS = [
  'STRING', 'INTEGER', 'NUMBER', 'BOOLEAN', 'NULL', 'ARRAY', 'OBJECT', 'ANY',
]


let apidef: any = null
try {
  apidef = require('@voxgig/apidef')
}
catch {
}


function apidefVersion(): string {
  try {
    return require('@voxgig/apidef/package.json').version
  }
  catch {
    return '(not installed)'
  }
}


describe('CANON_TYPE is internally complete', () => {

  test('every expected sentinel has a row', () => {
    for (const key of EXPECTED_SENTINELS) {
      ok(null != CANON_TYPE[key], `CANON_TYPE row missing for sentinel $${key}`)
    }
  })

  test('no unexpected extra rows', () => {
    const extra = Object.keys(CANON_TYPE).filter((k) => !EXPECTED_SENTINELS.includes(k))
    deepStrictEqual(extra, [],
      'CANON_TYPE has rows for sentinels apidef does not produce — ' +
      'either apidef gained them (update EXPECTED_SENTINELS) or they are dead')
  })

  test('every row covers every language column', () => {
    const langs = Object.keys(CANON_ANY).sort()
    const gaps: string[] = []
    for (const key of Object.keys(CANON_TYPE)) {
      for (const lang of langs) {
        if (null == CANON_TYPE[key][lang]) {
          gaps.push(`${key}.${lang}`)
        }
      }
    }
    deepStrictEqual(gaps, [], 'incomplete CANON_TYPE cells')
  })

  test('every column renders a non-empty type for every sentinel', () => {
    const bad: string[] = []
    for (const key of EXPECTED_SENTINELS) {
      for (const lang of Object.keys(CANON_ANY)) {
        const t = canonToType('`$' + key + '`', lang)
        if ('string' !== typeof t || 0 === t.length) {
          bad.push(`${key}.${lang}`)
        }
      }
    }
    deepStrictEqual(bad, [])
  })
})


describe('CANON_TYPE covers the apidef sentinel vocabulary', () => {

  test('every VALID_CANON sentinel has a CANON_TYPE row', (t) => {
    if (null == apidef || null == apidef.VALID_CANON) {
      t.skip('@voxgig/apidef ' + apidefVersion() +
        ' does not export VALID_CANON — local vocabulary check applies instead')
      return
    }

    for (const sentinel of Object.values(apidef.VALID_CANON) as string[]) {
      const key = canonKey(sentinel)
      ok(null != CANON_TYPE[key], `CANON_TYPE row missing for apidef sentinel ${sentinel}`)
    }
  })

  test('the union sentinel (CANON_ONE) renders, not falls through silently', (t) => {
    if (null == apidef || null == apidef.CANON_ONE) {
      t.skip('@voxgig/apidef ' + apidefVersion() + ' does not export CANON_ONE')
      return
    }

    // The array union form apidef's validator produces must render as a real
    // union in ts (the reference target), proving the form is recognised.
    const u = [apidef.CANON_ONE, ['`$STRING`', '`$INTEGER`']]
    ok('string | number' === canonToType(u, 'ts'), 'union form recognised')
  })


  test('the union form renders without needing apidef installed', () => {
    // Same assertion as above against the literal sentinel, so the union
    // path is covered on every run rather than only when apidef exports
    // CANON_ONE (which it currently does not).
    const u = ['`$ONE`', ['`$STRING`', '`$INTEGER`']]
    ok('string | number' === canonToType(u, 'ts'), 'ts union')
    ok('str | int' === canonToType(u, 'py'), 'py union')
    ok(CANON_ANY.go === canonToType(u, 'go'), 'go degrades to any')
  })
})
