import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'


// `undocumented` is the baseline the list started from: it may only shrink.
const LIST: { exports: string[], undocumented: string[] } = JSON.parse(
  readFileSync(Path.resolve(__dirname, '..', 'test', 'exports.json'), 'utf8'))

const API_MD = readFileSync(
  Path.resolve(__dirname, '..', '..', 'docs', 'reference', 'api.md'), 'utf8')

const runtime: string[] =
  Object.keys(require(Path.resolve(__dirname, '..', 'dist', 'sdkgen.js'))).sort()


function documented(name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('`' + escaped + '[`(]').test(API_MD)
}


function sortedUnique(names: string[]): string[] {
  return [...new Set(names)].sort()
}


describe('exports', () => {

  test('the published export surface equals the committed list', () => {
    const removed = LIST.exports.filter((n: string) => !runtime.includes(n))
    const added = runtime.filter((n: string) => !LIST.exports.includes(n))

    deepStrictEqual({ removed, added }, { removed: [], added: [] },
      'dist/sdkgen.js no longer exports what test/exports.json lists. ' +
      'A removed name breaks every consumer that imports it; an added ' +
      'name joins the list with its docs/reference/api.md entry.')
  })

  test('the lists are sorted and hold no duplicates', () => {
    deepStrictEqual(LIST.exports, sortedUnique(LIST.exports))
    deepStrictEqual(LIST.undocumented, sortedUnique(LIST.undocumented))
  })

  test('every export outside the baseline has its api.md entry', () => {
    const missing = LIST.exports.filter((n: string) =>
      !LIST.undocumented.includes(n) && !documented(n))

    deepStrictEqual(missing, [],
      'each export needs an entry in docs/reference/api.md, written as ' +
      'the name in backticks')
  })

  test('the undocumented baseline only shrinks', () => {
    const unknown = LIST.undocumented.filter((n: string) => !LIST.exports.includes(n))
    const stale = LIST.undocumented.filter(documented)

    deepStrictEqual({ unknown, stale }, { unknown: [], stale: [] },
      'test/exports.json lists as undocumented a name that is not exported, ' +
      'or one docs/reference/api.md now documents: remove it from the list')
  })
})
