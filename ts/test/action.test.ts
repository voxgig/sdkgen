
import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual } from 'node:assert'

import { appendIndexEntries, parseAddNames } from '../dist/action/action.js'


describe('appendIndexEntries', () => {

  test('appends a missing entry', () => {
    strictEqual(
      appendIndexEntries('a: 1', ['feat']),
      'a: 1\n@"feat.aontu"',
    )
  })

  test('leaves an already-present entry untouched', () => {
    const content = '@"feat.aontu"'
    strictEqual(appendIndexEntries(content, ['feat']), content)
  })

  test('appends multiple distinct entries', () => {
    strictEqual(
      appendIndexEntries('', ['a', 'b']),
      '\n@"a.aontu"\n@"b.aontu"',
    )
  })

  test('deduplicates repeated names within one call', () => {
    // Regression: previously each duplicate was appended because the
    // presence check ran against the original (unmodified) content.
    strictEqual(appendIndexEntries('', ['a', 'a']), '\n@"a.aontu"')
  })

  test('does not false-match on a name that is a prefix of an existing one', () => {
    // '@"feature.aontu"' must not satisfy the check for 'feat'.
    const out = appendIndexEntries('@"feature.aontu"', ['feat'])
    strictEqual(out, '@"feature.aontu"\n@"feat.aontu"')
  })
})


describe('parseAddNames', () => {

  test('comma-separated names in one positional', () => {
    deepStrictEqual(parseAddNames(['target', 'add', 'ts,py,go']), ['ts', 'py', 'go'])
  })

  test('space-separated names as extra positionals', () => {
    // Regression: extras after args[2] used to be silently dropped.
    deepStrictEqual(parseAddNames(['target', 'add', 'ts', 'py', 'go']), ['ts', 'py', 'go'])
  })

  test('mixed comma and space forms', () => {
    deepStrictEqual(parseAddNames(['target', 'add', 'ts,py', 'go']), ['ts', 'py', 'go'])
  })

  test('single name and empty fragments', () => {
    deepStrictEqual(parseAddNames(['feature', 'add', 'test']), ['test'])
    deepStrictEqual(parseAddNames(['feature', 'add', 'test,']), ['test'])
    deepStrictEqual(parseAddNames(['feature', 'add']), [])
  })
})
