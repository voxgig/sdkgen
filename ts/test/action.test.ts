
import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual } from 'node:assert'

import {
  appendIndexEntries, removeIndexEntries, hasIndexEntry, parseAddNames,
} from '../dist/action/action.js'


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

  test('a COMMENTED-OUT entry does not count as present', () => {
    // Regression: the check was a substring test, and '# @"go.aontu"'
    // CONTAINS '@"go.aontu"' — so `target add go` on a project that had
    // commented the include out appended nothing and reported success, while
    // the target stayed absent from the model. Commenting an include out is
    // the obvious way to switch a target off by hand, so projects reach this.
    const out = appendIndexEntries('# @"go.aontu"', ['go'])
    strictEqual(out, '# @"go.aontu"\n@"go.aontu"')
  })

  test('an indented entry does count as present', () => {
    // Indentation does not change what aontu includes, so it must not change
    // what this sees.
    const content = '  @"go.aontu"'
    strictEqual(appendIndexEntries(content, ['go']), content)
  })
})


describe('hasIndexEntry', () => {

  test('line-exact, not substring', () => {
    strictEqual(hasIndexEntry('@"go.aontu"', 'go'), true)
    strictEqual(hasIndexEntry('# @"go.aontu"', 'go'), false)
    strictEqual(hasIndexEntry('@"gogo.aontu"', 'go'), false)
    strictEqual(hasIndexEntry('', 'go'), false)
  })
})


describe('removeIndexEntries', () => {

  test('drops the named entry and leaves the rest', () => {
    strictEqual(
      removeIndexEntries('# Targets\n@"go.aontu"\n@"ts.aontu"', ['go']),
      '# Targets\n@"ts.aontu"',
    )
  })

  test('is the inverse of append', () => {
    const before = '# Targets\n@"ts.aontu"'
    const after = appendIndexEntries(before, ['go'])
    strictEqual(removeIndexEntries(after, ['go']), before)
  })

  test('leaves a commented-out entry alone', () => {
    // Symmetric with append: a commented line is not an entry, so removing
    // the name must not silently delete the user's comment.
    const content = '# @"go.aontu"'
    strictEqual(removeIndexEntries(content, ['go']), content)
  })

  test('removing an absent name changes nothing', () => {
    const content = '# Targets\n@"ts.aontu"'
    strictEqual(removeIndexEntries(content, ['go']), content)
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
