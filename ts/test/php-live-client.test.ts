import { test, describe } from 'node:test'
import { deepStrictEqual, ok } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'


// The php entity test builds its LIVE client by merging three option maps and
// handing the result to the SDK constructor, which takes a non-nullable
// `array $options = []`.
//
// `Vs::merge` answers with a stdClass whenever every contributing entry is an
// EMPTY map, and `Helpers::to_map` returns null for anything that is not a PHP
// array — so the constructor received null and every such SDK died with
// "must be of type array, null given". An SDK with no apikey and no server
// variables generates an empty middle entry, which makes that the COMMON case:
// it broke the live php suite for the whole freepublicapis fleet.
//
// Offline mode never enters this branch, so the offline suite stayed green and
// only a live run could surface it. That is exactly why this guard is a source
// assertion rather than a test that runs php.
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
