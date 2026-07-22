// CANON_TYPE <-> @voxgig/apidef sentinel-vocabulary sync check.
//
// apidef (>= the version that exports VALID_CANON/CANON_ONE) is the source of
// truth for the sentinel set; sdkgen's CANON_TYPE is the per-language inverse
// table. This test fails when apidef gains a sentinel CANON_TYPE does not
// cover, closing the "keep the two in sync by hand" gap. On an apidef too old
// to export the vocabulary (or with apidef not installed — it is a peer
// dependency), the check skips with a note instead of failing.

import { test, describe } from 'node:test'
import { ok } from 'node:assert'

const { CANON_TYPE } = require('../dist/helpers/canonType.js')
const { canonKey, canonToType } = require('../dist/sdkgen.js')


let apidef: any = null
try {
  apidef = require('@voxgig/apidef')
}
catch {
  // peer dep not installed — skip below
}


describe('CANON_TYPE covers the apidef sentinel vocabulary', () => {

  test('every VALID_CANON sentinel has a CANON_TYPE row', (t) => {
    if (null == apidef || null == apidef.VALID_CANON) {
      t.skip('@voxgig/apidef missing or too old to export VALID_CANON')
      return
    }

    for (const sentinel of Object.values(apidef.VALID_CANON) as string[]) {
      const key = canonKey(sentinel)
      ok(null != CANON_TYPE[key], `CANON_TYPE row missing for apidef sentinel ${sentinel}`)
    }
  })

  test('the union sentinel (CANON_ONE) renders, not falls through silently', (t) => {
    if (null == apidef || null == apidef.CANON_ONE) {
      t.skip('@voxgig/apidef missing or too old to export CANON_ONE')
      return
    }

    // The array union form apidef's validator produces must render as a real
    // union in ts (the reference target), proving the form is recognised.
    const u = [apidef.CANON_ONE, ['`$STRING`', '`$INTEGER`']]
    ok('string | number' === canonToType(u, 'ts'), 'union form recognised')
  })
})
