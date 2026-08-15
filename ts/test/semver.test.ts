// THE ENGINE-RANGE CHECK, and the direction it is allowed to be wrong in.
//
// `satisfies` has THREE outcomes: true, false, and `undefined` for "this
// range is outside the subset I understand". That third one is the whole
// design. Getting a range check wrong in the strict direction refuses a
// package that would have worked — a worse failure than the incompatibility
// it guards against — so anything unparsed must come back undefined and let
// the caller proceed, never false.
//
// This exists instead of node-semver because the package has no runtime
// dependencies and the field being read is one optional manifest key.

import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual } from 'node:assert'

import { satisfies, parseVersion } from '../dist/helpers/semver.js'


describe('parseVersion', () => {

  test('plain X.Y.Z only', () => {
    deepStrictEqual(parseVersion('3.4.8'), [3, 4, 8])
    deepStrictEqual(parseVersion('v3.4.8'), [3, 4, 8])
    deepStrictEqual(parseVersion(' 3.4.8 '), [3, 4, 8])
  })


  test('a prerelease is NOT parsed', () => {
    // Comparing prereleases properly is most of what makes semver hard, and
    // this subset does not. Returning undefined sends the caller down the
    // "cannot compare" path rather than producing a confident wrong answer.
    for (const v of ['3.4.8-beta.1', '3.4', '3', '', 'x', '3.4.8+build']) {
      strictEqual(parseVersion(v), undefined, v + ' was parsed')
    }
  })
})


describe('satisfies', () => {

  test('anything matches an open range', () => {
    for (const range of ['*', 'x', 'X', '', '   ']) {
      strictEqual(satisfies('3.4.8', range), true, JSON.stringify(range))
    }
  })


  test('lower bounds — the spelling this field actually carries', () => {
    strictEqual(satisfies('3.4.8', '>=3.5'), false)
    strictEqual(satisfies('3.5.0', '>=3.5'), true)
    strictEqual(satisfies('3.5.1', '>=3.5'), true)
    strictEqual(satisfies('4.0.0', '>=3.5'), true)
    strictEqual(satisfies('3.4.8', '>=3.4.8'), true)
    strictEqual(satisfies('3.4.8', '>3.4.8'), false)
  })


  test('upper bounds', () => {
    strictEqual(satisfies('3.4.8', '<4'), true)
    strictEqual(satisfies('4.0.0', '<4'), false)
    strictEqual(satisfies('4.0.0', '<=4'), true)
  })


  test('caret narrows to the first NON-ZERO component', () => {
    // npm treats a leading zero as unstable. Getting this wrong would admit
    // 0.3.0 for ^0.2.3 — a breaking change by that convention.
    strictEqual(satisfies('1.9.9', '^1.2.3'), true)
    strictEqual(satisfies('2.0.0', '^1.2.3'), false)
    strictEqual(satisfies('1.2.2', '^1.2.3'), false)

    strictEqual(satisfies('0.2.9', '^0.2.3'), true)
    strictEqual(satisfies('0.3.0', '^0.2.3'), false)

    strictEqual(satisfies('0.0.3', '^0.0.3'), true)
    strictEqual(satisfies('0.0.4', '^0.0.3'), false)
  })


  test('tilde bounds by how much was written', () => {
    strictEqual(satisfies('1.2.9', '~1.2.3'), true)
    strictEqual(satisfies('1.3.0', '~1.2.3'), false)
    strictEqual(satisfies('1.2.0', '~1.2'), true)
    strictEqual(satisfies('1.3.0', '~1.2'), false)
    strictEqual(satisfies('1.9.0', '~1'), true)
    strictEqual(satisfies('2.0.0', '~1'), false)
  })


  test('a bare or partial version is a PREFIX match', () => {
    strictEqual(satisfies('3.4.8', '3.4.8'), true)
    strictEqual(satisfies('3.4.9', '3.4.8'), false)
    strictEqual(satisfies('3.4.9', '3.4'), true)
    strictEqual(satisfies('3.5.0', '3.4'), false)
    strictEqual(satisfies('3.9.9', '3'), true)
    strictEqual(satisfies('4.0.0', '3'), false)
  })


  test('a conjunction needs every comparator', () => {
    strictEqual(satisfies('3.6.0', '>=3.5 <4'), true)
    strictEqual(satisfies('4.0.0', '>=3.5 <4'), false)
    strictEqual(satisfies('3.4.0', '>=3.5 <4'), false)
  })


  test('alternatives need only one', () => {
    strictEqual(satisfies('3.9.0', '^3 || ^4'), true)
    strictEqual(satisfies('4.1.0', '^3 || ^4'), true)
    strictEqual(satisfies('5.0.0', '^3 || ^4'), false)
  })
})


// The half that matters most: everything below must come back `undefined`,
// because `false` here would refuse a package that works.
describe('satisfies: what it refuses to guess at', () => {

  test('an unparsed VERSION is undecidable, not a failure', () => {
    strictEqual(satisfies('3.4.8-beta.1', '>=3.5'), undefined)
    strictEqual(satisfies('not-a-version', '>=3.5'), undefined)
  })


  test('a hyphen range is rejected EXPLICITLY', () => {
    // Read as a conjunction of two bare versions it would be unsatisfiable —
    // a false refusal — so it is caught before the split rather than after.
    strictEqual(satisfies('2.0.0', '1.2.3 - 2.3.4'), undefined)
  })


  test('an unknown comparator does not become a refusal', () => {
    for (const range of ['~>3.5', '>=3.5.x', 'latest', '>= 3.5']) {
      strictEqual(satisfies('3.4.8', range), undefined,
        JSON.stringify(range) + ' produced a verdict it could not justify')
    }
  })


  test('a PARTIALLY understood alternation is undecidable', () => {
    // The subtle one. `^3` is understood and does not match; `latest` is not
    // understood. Reporting false would refuse on the strength of having
    // checked only half the range.
    strictEqual(satisfies('4.0.0', '^3 || latest'), undefined)

    // ...but an alternative that MATCHES still wins, whatever the rest says.
    strictEqual(satisfies('3.1.0', '^3 || latest'), true)
  })


  test('a partially understood CONJUNCTION is undecidable', () => {
    strictEqual(satisfies('3.6.0', '>=3.5 ~>4'), undefined)
  })
})
