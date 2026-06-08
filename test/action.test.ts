
import { test, describe } from 'node:test'
import { strictEqual } from 'node:assert'

import { appendIndexEntries } from '../dist/action/action.js'


describe('appendIndexEntries', () => {

  test('appends a missing entry', () => {
    strictEqual(
      appendIndexEntries('a: 1', ['feat']),
      'a: 1\n@"feat.jsonic"',
    )
  })

  test('leaves an already-present entry untouched', () => {
    const content = '@"feat.jsonic"'
    strictEqual(appendIndexEntries(content, ['feat']), content)
  })

  test('appends multiple distinct entries', () => {
    strictEqual(
      appendIndexEntries('', ['a', 'b']),
      '\n@"a.jsonic"\n@"b.jsonic"',
    )
  })

  test('deduplicates repeated names within one call', () => {
    // Regression: previously each duplicate was appended because the
    // presence check ran against the original (unmodified) content.
    strictEqual(appendIndexEntries('', ['a', 'a']), '\n@"a.jsonic"')
  })

  test('does not false-match on a name that is a prefix of an existing one', () => {
    // '@"feature.jsonic"' must not satisfy the check for 'feat'.
    const out = appendIndexEntries('@"feature.jsonic"', ['feat'])
    strictEqual(out, '@"feature.jsonic"\n@"feat.jsonic"')
  })
})
