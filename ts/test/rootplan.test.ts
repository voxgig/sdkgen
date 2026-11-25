import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, throws, rejects } from 'node:assert'

import Path from 'node:path'

import { memfs } from 'memfs'

import { SdkGen, SdkGenError, cmp, fact } from '../dist/sdkgen.js'
import { refuseRootPlan } from '../dist/helpers/facts.js'

import {
  KIT, STAGE, SCAFFOLD, makeModel, makeRoot, layeredFs, makeLog,
} from './generateharness'


// The cases of create-sdkgen's RootPlan, restated as facts.

const TOP_OFF = 'main: kit: phase: top: active: false'
const ALL_ON = { entity: true, feature: true, readme: true, agentguide: true, test: true }


function plan(targets: string[], extra = ''): any {
  const kit = makeModel(targets, undefined, extra).main[KIT]
  return {
    top: fact(kit, 'top'),
    build: fact(kit, 'build'),
    target: Object.fromEntries(Object.keys(kit.target || {}).sort().map((name: string) =>
      [name, {
        active: kit.target[name].active,
        place: fact(kit.target[name], 'place'),
        phase: fact(kit.target[name], 'phase'),
      }])),
  }
}


async function generatedPaths(targets: string[], extra = '', root?: any): Promise<string[]> {
  const { fs, vol } = memfs({})
  const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
  const cwd = process.cwd()
  process.chdir(SCAFFOLD)
  try {
    const res = await sdkgen.generate({
      model: makeModel(targets, undefined, extra), root: root ?? makeRoot() })
    strictEqual(res.ok, true)
  }
  finally {
    process.chdir(cwd)
  }
  return Object.keys(vol.toJSON())
    .map((path: string) => Path.relative(STAGE, path).split(Path.sep).join('/'))
    .filter((rel: string) => !rel.includes('.jostraca/'))
}


describe('the root plan, as facts', () => {

  test('every target in its own folder, the root documents and every phase, by default', () => {
    deepStrictEqual(plan(['go', 'ts']), {
      top: true,
      build: true,
      target: {
        go: { active: true, place: 'folder', phase: ALL_ON },
        ts: { active: true, place: 'folder', phase: ALL_ON },
      },
    })
  })

  test('the top and build phases switch off independently', () => {
    const top = plan(['ts'], TOP_OFF)
    deepStrictEqual([top.top, top.build], [false, true])

    const build = plan(['ts'], 'main: kit: phase: build: active: false')
    deepStrictEqual([build.top, build.build], [true, false])
  })

  test('a consumer target runs none of the phases it switches off', () => {
    deepStrictEqual(plan(['go', 'go-cli']).target['go-cli'].phase, {
      entity: false, feature: false, readme: false, agentguide: false, test: false,
    })
  })

  test('a target can be generated at the project root', () => {
    const root = plan(['go'], TOP_OFF + '\nmain: kit: target: go: output: root: true')
    strictEqual(root.target.go.place, 'root')
    strictEqual(root.top, false)
  })

  test('a model without targets plans none', () => {
    deepStrictEqual(plan([]), { top: true, build: true, target: {} })
  })
})


describe('the root plan a run refuses', () => {

  test('only one target can take the project root', () => {
    const model = makeModel(['go', 'ts'], undefined, TOP_OFF +
      '\nmain: kit: target: go: output: root: true\nmain: kit: target: ts: output: root: true')
    throws(() => refuseRootPlan(model),
      /Only one target .* 2 declare `output: root: true`: go, ts\./)
  })

  test('a root target needs the repository files switched off', () => {
    const model = makeModel(['go'], undefined, 'main: kit: target: go: output: root: true')
    throws(() => refuseRootPlan(model), (err: any) =>
      err instanceof SdkGenError && /main: kit: phase: top: active: false/.test(err.message))
  })

  test('an inactive target does not claim the root', () => {
    refuseRootPlan(makeModel(['go', 'ts'], undefined, TOP_OFF +
      '\nmain: kit: target: go: output: root: true' +
      '\nmain: kit: target: ts: { active: false, output: root: true }'))
  })

  test('generate refuses before any Root runs', async () => {
    let ran = false
    const Root = cmp(function Root() { ran = true })
    await rejects(generatedPaths(['go'], 'main: kit: target: go: output: root: true', Root),
      /main: kit: phase: top: active: false/)
    strictEqual(ran, false, 'the Root ran on a plan generate refuses')
  })
})


describe('the suite\'s Root follows the plan', () => {

  test('no root documents with the top phase off', async () => {
    const on = await generatedPaths(['ts'])
    ok(on.includes('README.md'), 'no root README by default')

    const off = await generatedPaths(['ts'], TOP_OFF)
    deepStrictEqual(off.filter((rel: string) => !rel.includes('/')), [],
      'root documents with the top phase off')
  })

  test('an inactive target is not generated', async () => {
    const paths = await generatedPaths(['go', 'ts'], 'main: kit: target: ts: active: false')
    ok(paths.some((rel: string) => rel.startsWith('go/')), 'go was not generated')
    deepStrictEqual(paths.filter((rel: string) => rel.startsWith('ts/')), [])
  })

  test('a target at the root is generated there', async () => {
    const paths = await generatedPaths(['go'], TOP_OFF + '\nmain: kit: target: go: output: root: true')
    ok(paths.includes('go.mod'), 'go.mod is not at the root')
    deepStrictEqual(paths.filter((rel: string) => rel.startsWith('go/')), [])
  })
})
