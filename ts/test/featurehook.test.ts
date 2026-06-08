
import { test, describe } from 'node:test'
import { strictEqual } from 'node:assert'

import { Jostraca, Project, Folder, File, Content } from 'jostraca'
import { memfs } from 'memfs'

import { FeatureHook } from '../dist/sdkgen.js'


describe('FeatureHook', () => {

  // Render a single PrePoint hook and count how many times its children
  // fire. build:false keeps this to the define phase (no file I/O) — the
  // hook children run during define, so the count is what we assert on.
  async function firings(model: any): Promise<number> {
    const { fs } = memfs({})
    const jostraca = Jostraca()
    let count = 0

    await jostraca.generate(
      { fs: () => fs, folder: '/x', model, build: false },
      () => {
        Project({ folder: 'p' }, () => {
          Folder({ name: 'd' }, () => {
            File({ name: 'out.txt' }, () => {
              FeatureHook({ name: 'PrePoint' }, () => {
                count++
                Content('x\n')
              })
            })
          })
        })
      },
    )

    return count
  }

  test('fires once for an active feature with the active hook', async () => {
    const model = { main: { kit: { feature: {
      good: { active: true, hook: { PrePoint: { active: true } } },
    } } } }
    strictEqual(await firings(model), 1)
  })

  test('skips features missing the hook entry or hook map without crashing', async () => {
    // Regression: `feature.hook[props.name].active` threw a TypeError when
    // an active feature did not declare this stage.
    const model = { main: { kit: { feature: {
      good: { active: true, hook: { PrePoint: { active: true } } },
      partial: { active: true, hook: {} },   // hook map without PrePoint
      nohooks: { active: true },              // no hook map at all
    } } } }
    strictEqual(await firings(model), 1)
  })

  test('does not fire when the hook is inactive', async () => {
    const model = { main: { kit: { feature: {
      off: { active: true, hook: { PrePoint: { active: false } } },
    } } } }
    strictEqual(await firings(model), 0)
  })

  test('does not fire for an inactive feature', async () => {
    const model = { main: { kit: { feature: {
      good: { active: false, hook: { PrePoint: { active: true } } },
    } } } }
    strictEqual(await firings(model), 0)
  })

  test('fires once per matching feature', async () => {
    const model = { main: { kit: { feature: {
      a: { active: true, hook: { PrePoint: { active: true } } },
      b: { active: true, hook: { PrePoint: { active: true } } },
    } } } }
    strictEqual(await firings(model), 2)
  })
})
