import { deepStrictEqual, strictEqual } from 'node:assert'
import { describe, test } from 'node:test'
import { ifRangeHolds, matches, noneMatch, parseRange } from '../../src/content/conditional.js'

describe('parseRange', () => {
  const cases: [string | undefined, number, ReturnType<typeof parseRange>][] = [
    [undefined, 100, { kind: 'none' }],
    ['bytes=0-9', 100, { kind: 'range', start: 0, end: 9 }],
    ['bytes=90-', 100, { kind: 'range', start: 90, end: 99 }],
    ['bytes=90-500', 100, { kind: 'range', start: 90, end: 99 }],
    ['bytes=-10', 100, { kind: 'range', start: 90, end: 99 }],
    ['bytes=-500', 100, { kind: 'range', start: 0, end: 99 }],
    ['bytes=99-99', 100, { kind: 'range', start: 99, end: 99 }],
    ['bytes=100-', 100, { kind: 'unsatisfiable' }],
    ['bytes=-0', 100, { kind: 'unsatisfiable' }],
    ['bytes=0-0', 0, { kind: 'unsatisfiable' }],
    ['bytes=9-0', 100, { kind: 'none' }],
    ['bytes=0-1,5-6', 100, { kind: 'none' }],
    ['items=0-1', 100, { kind: 'none' }],
    ['bytes=-', 100, { kind: 'none' }],
    ['bytes=a-b', 100, { kind: 'none' }],
  ]
  for (const [header, size, want] of cases) {
    test(`${header} of ${size}`, () => deepStrictEqual(parseRange(header, size), want))
  }
})

describe('entity tags', () => {
  const tag = '"abc"'

  test('If-None-Match compares weakly and takes a list or *', () => {
    strictEqual(noneMatch(undefined, tag), false)
    strictEqual(noneMatch('"abc"', tag), true)
    strictEqual(noneMatch('W/"abc"', tag), true)
    strictEqual(noneMatch('"x", "abc"', tag), true)
    strictEqual(noneMatch('*', tag), true)
    strictEqual(noneMatch('"x"', tag), false)
  })

  test('If-Match compares strongly and needs a current representation', () => {
    strictEqual(matches(undefined, tag), true)
    strictEqual(matches(undefined, undefined), true)
    strictEqual(matches('"abc"', tag), true)
    strictEqual(matches('W/"abc"', tag), false)
    strictEqual(matches('*', tag), true)
    strictEqual(matches('*', undefined), false)
    strictEqual(matches('"abc"', undefined), false)
    strictEqual(matches('"x"', tag), false)
  })

  test('If-Range holds only for the same strong tag', () => {
    strictEqual(ifRangeHolds(undefined, tag), true)
    strictEqual(ifRangeHolds('"abc"', tag), true)
    strictEqual(ifRangeHolds('W/"abc"', tag), false)
    strictEqual(ifRangeHolds('"x"', tag), false)
    strictEqual(ifRangeHolds('Fri, 27 Nov 2026 00:00:00 GMT', tag), false)
  })
})
