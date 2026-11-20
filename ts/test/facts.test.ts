import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual, throws } from 'node:assert'
import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { Project } from 'jostraca'

import { SdkGen, applyFacts, fact } from '../dist/sdkgen.js'
import { makeModel } from './generateharness'


const KIT = 'kit'

const FEATURES = Fs.readdirSync(Path.join(__dirname, '..', 'project', '.sdk', 'model', 'feature'))
  .filter((f: string) => f.endsWith('.aontu') && 'feature-index.aontu' !== f)
  .map((f: string) => f.replace(/\.aontu$/, ''))
  .sort()


describe('facts', () => {

  test('every bundled feature: on equals its default active option', () => {
    const model = makeModel(['ts'], undefined, undefined, FEATURES)
    const features = model.main[KIT].feature
    deepStrictEqual(Object.keys(features).sort(), FEATURES)
    for (const name of FEATURES) {
      const f = features[name]
      strictEqual(fact(f, 'on'), true === f.config?.options?.active, name)
    }
  })

  test('place: folder by default, root, or external', () => {
    const model = makeModel(['ts', 'go', 'py'], undefined, [
      'main: kit: target: ts: output: root: true',
      "main: kit: target: py: output: path: '../py-sdk'",
    ].join('\n'))
    const target = model.main[KIT].target
    deepStrictEqual(
      Object.fromEntries(['ts', 'go', 'py'].map((t) => [t, fact(target[t], 'place')])),
      { ts: 'root', go: 'folder', py: 'external' })
  })

  test('a fact whose input is missing is absent, and reading it fails', () => {
    const model = applyFacts({
      main: { [KIT]: {
        feature: { bare: { name: 'bare' } },
        target: { bare: { name: 'bare' } },
      } },
    })
    throws(() => fact(model.main[KIT].feature.bare, 'on'), /has no fact 'on'/)
    throws(() => fact(model.main[KIT].target.bare, 'place'), /has no fact 'place'/)
    throws(() => fact({ name: 'raw' }, 'on'), /did not pass through applyFacts/)
  })

  test('applying the facts twice changes nothing', () => {
    const once = makeModel(['ts', 'go'])
    const twice = applyFacts(JSON.parse(JSON.stringify(once)))
    deepStrictEqual(twice, JSON.parse(JSON.stringify(once)))
  })

  test('generate applies the facts before Root runs', async () => {
    const model = makeModel(['ts'], undefined, undefined, ['test', 'log'])
    for (const f of Object.values(model.main[KIT].feature) as any[]) {
      delete f.fact
    }
    let seen: any
    const root = (props: any) => {
      seen = props.model.main[KIT].feature.test.fact
      Project({ folder: 'p' }, () => {})
    }
    const { fs } = memfs({})
    const res = await SdkGen({ fs, folder: '/top', root: '' }).generate({ model, root })
    strictEqual(res.ok, true)
    deepStrictEqual(seen, { on: false })
  })
})
