import { test, describe, before, after } from 'node:test'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'

import { SdkGen, guardModel } from '../dist/sdkgen.js'
import { SCAFFOLD, STAGE, layeredFs, makeLog, makeModel, makeRoot } from './generateharness'


const KIT = 'kit'

const TARGETS = Fs.readdirSync(Path.join(__dirname, '..', 'project', '.sdk', 'model', 'target'))
  .filter((f: string) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
  .map((f: string) => f.replace(/\.aontu$/, ''))
  .sort()

// The SDK targets, each with a Config component; a consumer reaches an
// operation only through the SDK it wraps.
const CMP = Path.join(__dirname, '..', 'project', '.sdk', 'src', 'cmp')
const SDKS = TARGETS.filter((t: string) => Fs.existsSync(Path.join(CMP, t, `Config_${t}.ts`)))


// Each switches operations off; the same model with them deleted is the
// one they must generate exactly as. One statement per entity: aontu 0.76.3
// cannot unify the ancestors of an entity given a second statement of its own.
const STATES: [string, string, string[]][] = [
  ['a remove a flow step makes', 'planet', ['remove']],
  ['the create a flow starts with', 'planet', ['create']],
  ['a list', 'planet', ['list']],
  ['an entity\'s only operation', 'ambient', ['load']],
  ['two operations of one entity', 'planet', ['update', 'remove']],
]


async function generate(model: any, info?: any[]): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  const sink: any[] = []
  await SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog(sink) })
    .generate({ model, root: makeRoot() })
  info?.push(...sink)

  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(vol.toJSON() as Record<string, string>)) {
    const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
    if (!rel.startsWith('.jostraca/') && !rel.includes('/.jostraca/') && !rel.startsWith('.sdk/log/')) {
      out[rel] = content
    }
  }
  return out
}


describe('an inactive operation is an absent one', () => {

  let cwd = ''
  before(() => {
    cwd = process.cwd()
    process.chdir(SCAFFOLD)
  })
  after(() => {
    if ('' !== cwd) process.chdir(cwd)
  })

  for (const [label, entity, ops] of STATES) {
    test('every target generates ' + label + ', switched off, as never declared', async () => {
      const extra = `main: kit: entity: ${entity}: op: { ` +
        ops.map((o: string) => `${o}: { active: false }`).join(', ') + ' }'
      const log: any[] = []
      const off = await generate(makeModel(TARGETS, undefined, extra), log)

      const absent = makeModel(TARGETS)
      for (const o of ops) {
        ok(null != absent.main[KIT].entity[entity].op[o], `the fixture declares ${entity}.${o}`)
        delete absent.main[KIT].entity[entity].op[o]
      }
      const never = await generate(absent)

      deepStrictEqual(Object.keys(off).sort(), Object.keys(never).sort())
      for (const file of Object.keys(off)) {
        strictEqual(off[file], never[file], file)
      }

      const warned = log.filter((entry: any) => 'flow-step-unreachable' === entry?.point &&
        ops.some((o: string) => entry.steps.some((s: string) => s.endsWith(':' + o))))
      deepStrictEqual(warned, [], 'a step on a switched-off operation is not a warning')
    })
  }

  test('switching remove off reaches every SDK target', async () => {
    const full = await generate(makeModel(TARGETS))
    const off = await generate(makeModel(TARGETS, undefined, 'main: kit: entity: planet: op: remove: active: false'))
    const changed = new Set(Object.keys(full).filter((f: string) => full[f] !== off[f])
      .map((f: string) => f.split('/')[0]))
    strictEqual(SDKS.length, 20)
    deepStrictEqual(SDKS.filter((t: string) => !changed.has(t)), [])
  })

  test('the slot is declared, and only an inactive operation leaves', () => {
    const model = makeModel(['ts'], undefined, 'main: kit: entity: planet: op: remove: active: false')
    const planet = model.main[KIT].entity.planet
    strictEqual(planet.op.remove.active, false)
    strictEqual(planet.op.load.active, true)
    guardModel(model)
    deepStrictEqual([null == planet.op.remove, 'active' in planet.op.load], [true, false])
  })
})
