import { test, describe } from 'node:test'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'
import { spawnSync } from 'node:child_process'


const CMP_PHP = Path.join(__dirname, '..', 'project', '.sdk', 'src', 'cmp', 'php')
const TM_PHP = Path.join(__dirname, '..', 'project', '.sdk', 'tm', 'php')


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


  // getpath answers a missing path with the struct port's UNDEF sentinel, one
  // stdClass per process that setprop writes into, as the struct corpus does.
  test('system.fetch is read past a struct sentinel that has been written into', (t) => {
    const probe = spawnSync('php', ['-r', `
require ${JSON.stringify(Path.join(TM_PHP, 'utility', 'struct', 'Struct.php'))};
require ${JSON.stringify(Path.join(TM_PHP, 'utility', 'Fetcher.php'))};
use Voxgig\\Struct\\Struct;
Struct::undef()->x = 1;
$f = function () {};
echo json_encode([
  'missing' => ProjectNameFetcher::systemFetch([]),
  'nosystem' => ProjectNameFetcher::systemFetch(['system' => []]),
  'given' => ProjectNameFetcher::systemFetch(['system' => ['fetch' => $f]]) === $f,
]);
`], { encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL' })

    if (null != probe.error) {
      t.skip('php is not installed')
      return
    }

    strictEqual(probe.status, 0, probe.stderr)
    deepStrictEqual(JSON.parse(probe.stdout),
      { missing: null, nosystem: null, given: true })

    const makeoptions = Fs.readFileSync(Path.join(TM_PHP, 'utility', 'MakeOptions.php'), 'utf8')
    ok(/ProjectNameFetcher::systemFetch\(\$options\)/.test(makeoptions),
      'make_options must preserve system.fetch through Fetcher::systemFetch')
    ok(!/getpath\(\$options, 'system\.fetch'\)/.test(makeoptions),
      'a raw getpath of system.fetch keeps the shared sentinel in every client')
  })

})
