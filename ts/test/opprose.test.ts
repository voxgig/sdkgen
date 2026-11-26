import { test, describe, before, after } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'

import { SdkGen } from '../dist/sdkgen.js'
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
})
