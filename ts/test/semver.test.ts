
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


  test('a PARTIAL version is a range, not zeroes', () => {
    // `>3.4` means "past all of 3.4.x", i.e. >=3.5.0 — read as `>3.4.0` it
    // admitted 3.4.8, letting an incompatible package through. `<=3.4` means
    // "within 3.4.x", i.e. <3.5.0 — read as `<=3.4.0` it refused 3.4.8, a
    // compatible package rejected. Both failures, one comparator.
    strictEqual(satisfies('3.4.8', '>3.4'), false)
    strictEqual(satisfies('3.5.0', '>3.4'), true)
    strictEqual(satisfies('3.4.8', '<=3.4'), true)
    strictEqual(satisfies('3.5.0', '<=3.4'), false)

    strictEqual(satisfies('3.9.9', '>3'), false)
    strictEqual(satisfies('4.0.0', '>3'), true)
    strictEqual(satisfies('3.9.9', '<=3'), true)
    strictEqual(satisfies('4.0.0', '<=3'), false)

    // The other two need no adjustment, and must not gain one.
    strictEqual(satisfies('3.4.0', '>=3.4'), true)
    strictEqual(satisfies('3.4.8', '>=3.4'), true)
    strictEqual(satisfies('3.3.9', '>=3.4'), false)
    strictEqual(satisfies('3.4.0', '<3.4'), false)
    strictEqual(satisfies('3.3.9', '<3.4'), true)

    strictEqual(satisfies('3.4.8', '>3.4.0'), true)
    strictEqual(satisfies('3.4.8', '<=3.4.8'), true)
    strictEqual(satisfies('3.4.9', '<=3.4.8'), false)
  })


  test('caret narrows to the first NON-ZERO component', () => {
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


  test('whitespace after supported operators preserves their bounds', () => {
    const cases: [string, string, boolean][] = [
      ['>=', '3.4.8', true], ['>=', '3.5', false],
      ['>', '3.4.7', true], ['>', '3.4.8', false],
      ['<=', '3.4.8', true], ['<=', '3.4.7', false],
      ['<', '3.4.9', true], ['<', '3.4.8', false],
      ['=', '3.4.8', true], ['=', '3.4.7', false],
      ['^', '3.4', true], ['^', '4', false],
      ['~', '3.4', true], ['~', '3.5', false],
      ['>', '3', false], ['<=', '3', true],
      ['>', '3.4', false], ['<=', '3.4', true],
    ]

    for (const [op, version, expected] of cases) {
      for (const space of [' ', '   ', '\t', ' \t ', '\n', '\r\n']) {
        for (const prefix of ['', 'v']) {
          const range = '  ' + op + space + prefix + version + '  '
          strictEqual(satisfies('3.4.8', range), expected, JSON.stringify(range))
        }
      }
    }
  })


  test('spaced comparators combine with conjunctions and alternatives', () => {
    for (const range of ['>= 3.5 < 4', '>=3.5\t<\t4', '>=\n3.5\r\n<4']) {
      strictEqual(satisfies('3.6.0', range), true, range)
      strictEqual(satisfies('3.4.0', range), false, range)
      strictEqual(satisfies('4.0.0', range), false, range)
    }

    for (const range of ['^ 3 || ^ 4', '^ 3||^ 4', '>= 3 <4 || >=4 < 5']) {
      strictEqual(satisfies('3.9.0', range), true, range)
      strictEqual(satisfies('4.1.0', range), true, range)
      strictEqual(satisfies('5.0.0', range), false, range)
    }
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
    strictEqual(satisfies('2.0.0', '1.2.3 - 2.3.4'), undefined)
  })


  test('an unknown comparator does not become a refusal', () => {
    for (const range of ['~>3.5', '>=3.5.x', 'latest']) {
      strictEqual(satisfies('3.4.8', range), undefined,
        JSON.stringify(range) + ' produced a verdict it could not justify')
    }
  })


  test('whitespace does not repair malformed or unsupported comparators', () => {
    for (const range of [
      '> = 3.4.8', '< = 3.4.8', '^ > 3.4.8', '~ > 3.4.8', '~> 3.4.8',
      '>=', '>= || <', '>= *', '>= v 3.4.8', '>= 3.4 .8',
      '>= 3.4.x', '>= 3.4.8-beta.1', '>= 3.4.8+build',
      '>= 3.4.8< 4', '>= 3.4.8 <', 'latest >= 3.4.8',
    ]) {
      for (const version of ['3.4.8', '5.0.0']) {
        strictEqual(satisfies(version, range), undefined, JSON.stringify(range))
      }
    }
  })


  test('a PARTIALLY understood alternation is undecidable', () => {
    // The subtle one. `^3` is understood and does not match; `latest` is not
    // understood. Reporting false would refuse on the strength of having
    // checked only half the range.
    strictEqual(satisfies('4.0.0', '^3 || latest'), undefined)

    strictEqual(satisfies('3.1.0', '^3 || latest'), true)
    strictEqual(satisfies('4.0.0', '^ 3 || latest'), undefined)
    strictEqual(satisfies('3.1.0', '^ 3 || latest'), true)
    strictEqual(satisfies('3.1.0', 'latest || ^ 3'), true)
  })


  test('a partially understood CONJUNCTION is undecidable', () => {
    strictEqual(satisfies('3.6.0', '>=3.5 ~>4'), undefined)
    strictEqual(satisfies('3.6.0', '>= 3.5 ~> 4'), undefined)
    strictEqual(satisfies('3.4.0', '>= 3.5 ~> 4'), undefined)
  })
})
