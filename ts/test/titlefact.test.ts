import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'
import Fs from 'node:fs'
import Path from 'node:path'

import { applyFacts, fact } from '../dist/sdkgen.js'
import { LANG_LABEL } from '../dist/helpers/title'
import { API_MODEL, graphqlOnly, makeModel } from './generateharness'


const KIT = 'kit'

const TARGET_DIR = Path.join(__dirname, '..', 'project', '.sdk', 'model', 'target')


function declaredTitle(target: string): string {
  const src = Fs.readFileSync(Path.join(TARGET_DIR, target + '.aontu'), 'utf8')
  const title = /^\s*title:\s*(['"]?)(.+?)\1\s*$/m.exec(src)
  return null == title ? '' : title[2]
}


function apiName(model: any): string {
  return fact(model.main[KIT], 'apiName').raw
}


describe('title facts', () => {

  test('a declared title is the title fact', () => {
    const target = makeModel(['ts', 'csharp', 'go-cli']).main[KIT].target
    deepStrictEqual(
      Object.fromEntries(['ts', 'csharp', 'go-cli'].map((t) => [t, fact(target[t], 'title')])),
      { ts: 'TypeScript', csharp: 'C#', 'go-cli': 'Go CLI' })
  })

  test('without a title: the origin\'s label, else the installed key', () => {
    const target = applyFacts({
      main: { [KIT]: {
        target: {
          ts2: { name: 'ts2', origname: 'ts' },
          bash: { name: 'bash' },
          go: { name: 'go', title: '' },
        },
      } },
    }).main[KIT].target
    deepStrictEqual(
      Object.fromEntries(['ts2', 'bash', 'go'].map((t) => [t, fact(target[t], 'title')])),
      { ts2: 'TypeScript', bash: 'bash', go: LANG_LABEL.go })
  })

  test('every label equals the title its bundled target declares', () => {
    for (const [name, label] of Object.entries(LANG_LABEL)) {
      strictEqual(label, declaredTitle(name), name)
    }
  })

})


describe('the API name and the definition kind', () => {

  test('the API name: the project\'s title, else the spec\'s, else the SDK name and API', () => {
    strictEqual(apiName(makeModel(['ts'])), 'Demo')
    strictEqual(apiName(makeModel(['ts'], undefined,
      "main: kit: text: title: 'Solar System API'")), 'Solar System API')
    strictEqual(apiName(makeModel(['ts'], 'solar-demo', undefined, undefined, 'target',
      API_MODEL.replace("title: 'Demo', ", ''))), 'SolarDemo API')
  })

  test('the API name is escaped beside it, and spec text is vendor text', () => {
    const name = fact(makeModel(['ts'], undefined,
      "main: kit: text: title: 'Pipes | API'").main[KIT], 'apiName')
    strictEqual(name.cell, 'Pipes \\| API')
    strictEqual(name.vendor, false)
    strictEqual(fact(makeModel(['ts']).main[KIT], 'apiName').vendor, true)
  })

  test('the definition kind: openapi, graphql, or none when the points disagree', () => {
    const kind = (extra?: string) => fact(makeModel(['ts'], undefined, extra).main[KIT], 'definitionKind')
    strictEqual(kind(), 'openapi')
    strictEqual(kind(graphqlOnly()), 'graphql')
    strictEqual(kind(graphqlOnly().replace(/^main: kit: entity: planet: active: false$/m, '')), '')
    strictEqual(fact(applyFacts({ main: { [KIT]: { target: {} } } }).main[KIT], 'definitionKind'), '')
  })

})
