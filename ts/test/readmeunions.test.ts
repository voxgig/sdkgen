/* Copyright (c) 2024-2026 Richard Rodger, MIT License */

// The "Open types" README section reports fields that could not be narrowed
// because the API definition describes them with UNTAGGED unions —
// `oneOf`/`anyOf` with no `discriminator`. apidef records the widest such union
// per field (ModelField.union); this section explains the resulting open type
// so it does not read as a modelling failure.
//
// The live case is the Typebot Builder spec: `groups` carries a 19-branch
// untagged union 14 levels down, which is why that SDK types it as a bare
// array.

import { describe, test } from 'node:test'
import { equal, match, doesNotMatch } from 'node:assert'

// Built module, matching the other suites: the compiled test runs from
// dist-test/, where a ../src path does not resolve.
import { MIN_REPORTED_BRANCHES } from '../dist/cmp/ReadmeUnions.js'


// Render the section the way the component does, from the same row-selection
// rules, so the thresholds and wording stay covered without standing up a full
// jostraca generation run.
function selectRows(entities: any) {
  const rows: any[] = []
  for (const ent of Object.values<any>(entities)) {
    if (false === ent.active) continue
    for (const field of ent.fields ?? []) {
      const union = field?.union
      if (null == union || union.branches < MIN_REPORTED_BRANCHES) continue
      rows.push({ entity: ent.name, field: field.name, ...union })
    }
  }
  rows.sort((a, b) => b.branches - a.branches || a.entity.localeCompare(b.entity) ||
    a.field.localeCompare(b.field))
  return rows
}


describe('readme-unions', () => {

  test('reports only unions at or above the threshold', () => {
    // A two-branch union is a routine either/or; reporting every one would
    // bury the cases that matter.
    equal(MIN_REPORTED_BRANCHES, 3)

    const rows = selectRows({
      typebot: {
        name: 'typebot', fields: [
          { name: 'groups', union: { count: 31, branches: 19, depth: 14 } },
          { name: 'events', union: { count: 1, branches: 3, depth: 1 } },
          { name: 'theme', union: { count: 2, branches: 2, depth: 6 } },
          { name: 'name' },
        ]
      },
    })

    equal(rows.length, 2)
    equal(rows.map((r) => r.field).join(','), 'groups,events')
  })


  test('widest union first', () => {
    const rows = selectRows({
      a: { name: 'a', fields: [{ name: 'small', union: { count: 1, branches: 3, depth: 1 } }] },
      b: { name: 'b', fields: [{ name: 'big', union: { count: 9, branches: 19, depth: 14 } }] },
    })
    equal(rows[0].field, 'big')
    equal(rows[1].field, 'small')
  })


  test('inactive entities are excluded', () => {
    const rows = selectRows({
      hidden: {
        name: 'hidden', active: false,
        fields: [{ name: 'groups', union: { count: 1, branches: 19, depth: 3 } }],
      },
    })
    equal(rows.length, 0)
  })


  test('no rows when every field is resolvable', () => {
    const rows = selectRows({
      a: { name: 'a', fields: [{ name: 'id' }, { name: 'name' }] },
    })
    equal(rows.length, 0)
  })


  test('section wording states the cause and avoids blaming the SDK', () => {
    // The point of the section is that the open type follows from the API
    // definition. Wording that reads as an SDK limitation defeats it.
    const src = require('node:fs')
      .readFileSync(__dirname + '/../src/cmp/ReadmeUnions.ts', 'utf8')
    match(src, /not from a gap in this SDK/)
    match(src, /discriminator/)
    match(src, /round-trip unchanged/)
    doesNotMatch(src, /\bhonest\b/i)
  })


  test('nesting depth is singular at one level', () => {
    const src = require('node:fs')
      .readFileSync(__dirname + '/../src/cmp/ReadmeUnions.ts', 'utf8')
    match(src, /1 === r\.depth \? 'level' : 'levels'/)
  })

})
