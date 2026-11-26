import { test, describe, before, after } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { Jostraca, Project, Folder, File } from 'jostraca'

import { SdkGen, ReadmeModel } from '../dist/sdkgen.js'
import { STAGE, SCAFFOLD, makeModel, makeRoot, makeLog, layeredFs } from './generateharness'


// The documents of every SDK target follow the operations its entities have.

const CMP = Path.join(SCAFFOLD, 'src', 'cmp')
const TARGETS: string[] = Fs.readdirSync(CMP)
  .filter((t: string) => Fs.existsSync(Path.join(CMP, t, 'ReadmeModel_' + t + '.ts'))).sort()

const ENTITIES: string[] = Object.keys(makeModel([]).main.kit.entity).sort()

// Unification cannot remove, so a variation switches entities and operations
// off, one statement per entity.
const only = (...keep: string[]): string => ENTITIES.filter((e: string) => !keep.includes(e))
  .map((e: string) => `main: kit: entity: ${e}: active: false`).join('\n')

const opsOff = (entity: string, ...ops: string[]): string =>
  `main: kit: entity: ${entity}: op: { ${ops.map((o: string) => o + ': { active: false }').join(', ')} }`


async function documents(extra = ''): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  await SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
    .generate({ model: makeModel(TARGETS, undefined, extra), root: makeRoot() })
  const out: Record<string, string> = {}
  for (const [path, text] of Object.entries(vol.toJSON() as Record<string, string>)) {
    const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
    if (rel.endsWith('.md') && !rel.startsWith('.jostraca/') && null != text) out[rel] = text
  }
  return out
}


// The neutral reference a target without a ReadmeModel of its own writes.
async function genericReference(model: any): Promise<string> {
  const { fs, vol } = memfs({})
  await Jostraca().generate({ fs: () => fs, folder: '/x', model, log: makeLog() }, () => {
    Project({ folder: 'p' }, () => Folder({ name: 'd' }, () => File({ name: 'out.md' }, () => {
      ReadmeModel({ target: { name: 'nocopy', title: 'None' } })
    })))
  })
  const json: any = vol.toJSON()
  return json[Object.keys(json).find((k: string) => k.endsWith('out.md'))!]
}


function naming(docs: Record<string, string>, re: RegExp): string[] {
  return Object.entries(docs).filter(([, text]) => re.test(text)).map(([path]) => path).sort()
}


describe('operation-dependent prose', () => {

  let cwd = ''
  before(() => {
    cwd = process.cwd()
    process.chdir(SCAFFOLD)
  })
  after(() => {
    if ('' !== cwd) process.chdir(cwd)
  })


  test('the list result is named only where an entity has list, the remove result only with remove', async () => {
    const LIST = /one\s+(entity\s+)?per\s+record/i
    const REMOVE = /marked\s+(as\s+)?deleted/i
    const all = await documents()
    const readmes = TARGETS.map((t: string) => t + '/README.md')
    deepStrictEqual(readmes.filter((p: string) => !LIST.test(all[p])), [],
      'a README with list names no list result')
    deepStrictEqual(readmes.filter((p: string) => !REMOVE.test(all[p] + all[p.replace('README', 'REFERENCE')])),
      [], 'a README or REFERENCE with remove names no remove result')

    deepStrictEqual(naming(await documents(only('ambient')), LIST), [])
    deepStrictEqual(naming(await documents(only('ambient', 'planet') + '\n' + opsOff('planet', 'list')), LIST), [])
    deepStrictEqual(naming(await documents(opsOff('planet', 'create', 'update', 'patch', 'remove')), REMOVE), [])
  })


  test('a reference says the entities share one interface only where their operations are the same', async () => {
    const SAME = /share(s)? the same interface/
    const OWN = /has only the operations its model declares/
    const mixed = await documents()
    const same = await documents(only('history', 'record', 'utility'))
    const readmes = (docs: Record<string, string>, re: RegExp) =>
      TARGETS.filter((t: string) => re.test(docs[t + '/README.md']))
    // c, go and ocaml word theirs as one vtable, interface or record type,
    // which every entity has whatever operations it declares.
    const typed = ['c', 'go', 'ocaml']
    deepStrictEqual(readmes(mixed, SAME), [])
    deepStrictEqual(readmes(mixed, OWN), TARGETS.filter((t: string) => !typed.includes(t)))
    deepStrictEqual(readmes(same, SAME), TARGETS.filter((t: string) => !typed.includes(t)))
    deepStrictEqual(readmes(same, OWN), [])
    strictEqual(mixed['lua/README.md'].includes('each with operations from one small set'), true)
    strictEqual(same['lua/README.md'].includes('each with the same small set of operations'), true)

    const genericMixed = await genericReference(makeModel([]))
    strictEqual(OWN.test(genericMixed), true)
    deepStrictEqual(['load', 'list', 'create', 'update', 'patch', 'remove']
      .filter((op: string) => genericMixed.includes('| `' + op + '(')), ['load', 'list', 'create', 'update', 'patch', 'remove'])
    const genericLists = await genericReference(makeModel([], undefined, only('history', 'record', 'utility')))
    strictEqual(SAME.test(genericLists), true)
    deepStrictEqual(['load', 'list', 'create', 'update', 'patch', 'remove']
      .filter((op: string) => genericLists.includes('| `' + op + '(')), ['list'])
  })
})
