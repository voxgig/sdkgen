import { test, describe } from 'node:test'
import { deepStrictEqual, ok } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'


const CMP_PHP = Path.join(__dirname, '..', 'project', '.sdk', 'src', 'cmp', 'php')


function source(f: string): string {
  return Fs.readFileSync(Path.join(CMP_PHP, f), 'utf8')
}


describe('php live client options', () => {

  test('the live client construction cannot be handed a null options map', () => {
    const src = source('TestEntity_php.ts')

    // The construction line, whatever the project name interpolation is.
    const lines = src.split('\n').filter((l) => /new \$\{model\.const\.Name\}SDK\(/.test(l))
    ok(0 < lines.length, 'no SDK construction found in TestEntity_php.ts')

    const unguarded = lines.filter((l) =>
      /Helpers::to_map\(/.test(l) && !/\?\?\s*\[\]/.test(l))

    deepStrictEqual(unguarded, [],
      'to_map can return null; an SDK constructor takes a non-nullable array')
  })


  test('the extras entry stays a map, not an empty list', () => {
    // The sibling half of the same hazard: an empty PHP array is a LIST, and a
    // non-map entry REPLACES the accumulated map in merge rather than adding to
    // it, which silently discarded live_client_options().
    const src = source('TestEntity_php.ts')
    ok(/Vs::ismap\(\$extra\) \? \$extra : new \\\\stdClass\(\)/.test(src),
      'the extras entry must be coerced to a map before merging')
  })

})
