
import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual } from 'node:assert'

import {
  appendIndexEntries, removeIndexEntries, hasIndexEntry, parseAddNames,
} from '../dist/action/action.js'


describe('appendIndexEntries', () => {

  test('appends a missing entry', () => {
    strictEqual(
      appendIndexEntries('a: 1', ['feat']),
      'a: 1\n@"./feat.aon"',
    )
  })

  test('leaves an already-present entry untouched', () => {
    const content = '@"./feat.aon"'
    strictEqual(appendIndexEntries(content, ['feat']), content)
  })

  test('an entry in the BARE pre-0.65 spelling counts as present', () => {
    const content = '@"feat.aon"'
    strictEqual(appendIndexEntries(content, ['feat']), content)
  })

  test('appends multiple distinct entries', () => {
    strictEqual(
      appendIndexEntries('', ['a', 'b']),
      '\n@"./a.aon"\n@"./b.aon"',
    )
  })

  test('deduplicates repeated names within one call', () => {
    strictEqual(appendIndexEntries('', ['a', 'a']), '\n@"./a.aon"')
  })

  test('does not false-match on a name that is a prefix of an existing one', () => {
    // '@"feature.aon"' must not satisfy the check for 'feat'.
    const out = appendIndexEntries('@"./feature.aon"', ['feat'])
    strictEqual(out, '@"./feature.aon"\n@"./feat.aon"')
  })

  test('a COMMENTED-OUT entry does not count as present', () => {
    const out = appendIndexEntries('# @"./go.aon"', ['go'])
    strictEqual(out, '# @"./go.aon"\n@"./go.aon"')
  })

  test('an entry with a TRAILING COMMENT counts as present', () => {
    // The other half of the line-exact fix: `@"go.aon" # pinned` is an
    // ACTIVE include with a comment after it. A whole-line equality test
    // reads it as absent and appends a second active include of the same
    // file — breaking the idempotence AGENTS.md pins as an invariant.
    const content = '@"go.aon" # pinned target'
    strictEqual(appendIndexEntries(content, ['go']), content)
  })

  test('an indented entry does count as present', () => {
    // Indentation does not change what aontu includes, so it must not change
    // what this sees.
    const content = '  @"go.aon"'
    strictEqual(appendIndexEntries(content, ['go']), content)
  })
})


describe('hasIndexEntry', () => {

  test('recognises active includes, and only those', () => {
    strictEqual(hasIndexEntry('@"go.aon"', 'go'), true)
    strictEqual(hasIndexEntry('  @"go.aon"', 'go'), true)
    strictEqual(hasIndexEntry('@"go.aon" # pinned', 'go'), true)
    strictEqual(hasIndexEntry('@"go.aon"\t#pinned', 'go'), true)

    strictEqual(hasIndexEntry('# @"go.aon"', 'go'), false)
    strictEqual(hasIndexEntry('  #@"go.aon"', 'go'), false)
    strictEqual(hasIndexEntry('@"gogo.aon"', 'go'), false)
    strictEqual(hasIndexEntry('', 'go'), false)
  })
})


describe('removeIndexEntries', () => {

  test('drops the named entry and leaves the rest', () => {
    strictEqual(
      removeIndexEntries('# Targets\n@"go.aon"\n@"ts.aon"', ['go']),
      '# Targets\n@"ts.aon"',
    )
  })

  test('is the inverse of append', () => {
    const before = '# Targets\n@"ts.aon"'
    const after = appendIndexEntries(before, ['go'])
    strictEqual(removeIndexEntries(after, ['go']), before)
  })

  test('leaves a commented-out entry alone', () => {
    // Symmetric with append: a commented line is not an entry, so removing
    // the name must not silently delete the user's comment.
    const content = '# @"go.aon"'
    strictEqual(removeIndexEntries(content, ['go']), content)
  })

  test('removing an absent name changes nothing', () => {
    const content = '# Targets\n@"ts.aon"'
    strictEqual(removeIndexEntries(content, ['go']), content)
  })
})


describe('parseAddNames', () => {

  test('comma-separated names in one positional', () => {
    deepStrictEqual(parseAddNames(['target', 'add', 'ts,py,go']), ['ts', 'py', 'go'])
  })

  test('space-separated names as extra positionals', () => {
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
