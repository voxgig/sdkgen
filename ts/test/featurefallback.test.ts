import { test, describe } from 'node:test'
import { ok, strictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


// The ts and js clients make every active feature through Config.makeFeature.
// A name the SDK was generated without (test(), in an SDK with no test
// feature) gets the base feature, as in every other runtime, rather than
// `new undefined()`.

const FRAG = Path.resolve(__dirname, '..', 'project', '.sdk', 'src', 'cmp')

class BaseFeature { name = 'base' }

// The method as the fragment writes it, run against a FEATURE_CLASS that
// holds no generated feature (the fragment's placeholders are left out).
function makeFeatureOf(rel: string): (fn: string) => any {
  const file = Path.join(FRAG, rel)
  const src = readFileSync(file, 'utf8')
  const m = /\n  makeFeature\(([^)]*)\)\s*\{([\s\S]*?)\n  \}/.exec(src)
  ok(null != m, rel + ': no makeFeature method')
  const fn = `function makeFeature(${m![1]}) {${m![2]}\n}`
  const js = transform(fn, { transforms: ['typescript'], filePath: file }).code
  return new Function('FEATURE_CLASS', 'BaseFeature', js + '\nreturn makeFeature')({}, BaseFeature)
}


describe('featurefallback', () => {
  for (const rel of [
    'ts/fragment/Config.fragment.ts', 'ts/fragment/Config.data.fragment.ts',
    'js/fragment/Config.fragment.js', 'js/fragment/Config.data.fragment.js',
  ]) {
    test(rel + ': a feature the SDK was generated without is the base feature', () => {
      const makeFeature = makeFeatureOf(rel)
      const f = makeFeature('test')
      ok(f instanceof BaseFeature, rel + ': makeFeature("test") made ' + String(f))
      strictEqual(f.name, 'base')
    })
  }
})
