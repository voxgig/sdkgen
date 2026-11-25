import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen.js'
import { featureApplies, shippedProvides } from '../dist/helpers/applicability.js'
import { STAGE, SCAFFOLD, makeModel, makeRoot, layeredFs, makeLog } from './generateharness'


const SECRETS_ON = 'main: kit: feature: secrets: active: true'


async function warningsFor(alter: (model: any) => void): Promise<any[]> {
  const warnings: any[] = []
  const { fs } = memfs({})
  const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog([], warnings) })
  const model = makeModel(['ts'], undefined, SECRETS_ON, ['test', 'log', 'secrets'])
  alter(model)
  const cwd = process.cwd()
  process.chdir(SCAFFOLD)
  try {
    strictEqual((await sdkgen.generate({ model, root: makeRoot() })).ok, true)
  }
  finally {
    process.chdir(cwd)
  }
  return warnings.filter((w: any) => 'feature-not-applicable' === w.point)
}


describe('feature tags', () => {

  test('the shipped ts target provides sekreto', () => {
    ok(shippedProvides('ts').includes('sekreto'), JSON.stringify(shippedProvides('ts')))
    deepStrictEqual(shippedProvides('no-such-target'), [])
  })


  // A project's ts copy from before `provides` existed drops an active feature
  // that needs a tag; the shipped ts provides it, so the remedy is a refresh.
  test('an active feature an old copy cannot take warns, with the refresh', async () => {
    const found = await warningsFor((model: any) => { delete model.main.kit.target.ts.provides })
    strictEqual(found.length, 1, JSON.stringify(found))
    deepStrictEqual(found[0].unmet, ['sekreto'])
    ok(/secrets is active but not generated for ts, which does not provide sekreto/.test(found[0].note),
      found[0].note)
    ok(/`voxgig-sdkgen target add ts`/.test(found[0].note), found[0].note)
  })


  test('a target from another package is not told to refresh from this one', async () => {
    const found = await warningsFor((model: any) => {
      delete model.main.kit.target.ts.provides
      model.main.kit.target.ts.base = '/elsewhere/pack/.sdk'
    })
    strictEqual(found.length, 1, JSON.stringify(found))
    ok(!/refreshes the copy/.test(found[0].note), found[0].note)
  })


  test('a target that provides the tag warns about nothing', async () => {
    deepStrictEqual(await warningsFor(() => { }), [])
  })


  // An add keeps an alias's own model file, so one from before `provides`
  // takes its origin's.
  test('an alias that declares no provides takes its origin\'s', () => {
    const secrets = { needs: { sekreto: true } }
    ok(featureApplies(secrets, { name: 'ts2', origname: 'ts', provides: {} }))
    ok(!featureApplies(secrets, { name: 'ts', provides: {} }), 'an unaliased copy took the shipped tags')
    ok(!featureApplies(secrets, { name: 'ts2', origname: 'ts', base: '/elsewhere/pack/.sdk', provides: {} }),
      'an alias from another package took this package\'s tags')
    ok(!featureApplies(secrets, { name: 'ts2', origname: 'ts', provides: { schema: true } }),
      'an alias that declares its tags took its origin\'s')
  })
})
