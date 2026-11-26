import { test, describe, before, after } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { Jostraca, Project, Folder, File } from 'jostraca'

import { SdkGen, ReadmeModel, entityCollection } from '../dist/sdkgen.js'
import { STAGE, SCAFFOLD, makeModel, makeRoot, makeLog, layeredFs } from './generateharness'
import { emptyTables } from './textguard'


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


// Its create sorts first and has only an action route, which is not the
// entity's own path.
const MISSION = `
main: kit: entity: mission: {
  alias: field: {}
  name: "mission"
  id: { field: "id", name: "id" }
  fields: {
    "id": { h: 'Id', n: "id", r: true, t: "\`$STRING\`" }
    "title": { h: 'Title', n: "title", r: false, t: "\`$STRING\`" }
  }
  op: {
    create: { name: "create", points: [ {
      g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`" } ] }
      m: "POST", o: "/mission/{id}/launch", s: [{ lit: "mission" }, { var: "id" }, { lit: "launch" }]
      q: { "$action": "launch", exist: ["id"] }
      t: { req: "\`reqdata\`", res: "\`body\`" }
    } ] }
    load: { name: "load", points: [ {
      g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`" } ] }
      m: "GET", o: "/mission/{id}", s: [{ lit: "mission" }, { var: "id" }]
      t: { req: "\`reqdata\`", res: "\`body\`" }
    } ] }
  }
}

main: kit: flow: BasicMissionFlow: {
  entity: "mission", kind: "basic", name: "BasicMissionFlow"
  step: [ { o: "load", i: { ref: "mission_ref01", srcdatavar: "mission_ref01_data", suffix: "_dt0" } } ]
}
`


async function generated(extra = ''): Promise<Record<string, string>> {
  const { fs, vol } = memfs({})
  await SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
    .generate({ model: makeModel(TARGETS, undefined, extra), root: makeRoot() })
  const out: Record<string, string> = {}
  for (const [path, text] of Object.entries(vol.toJSON() as Record<string, string>)) {
    const rel = Path.relative(STAGE, path).split(Path.sep).join('/')
    if (!rel.startsWith('.jostraca/') && null != text) out[rel] = text
  }
  return out
}


async function documents(extra = ''): Promise<Record<string, string>> {
  return Object.fromEntries(Object.entries(await generated(extra)).filter(([path]) => path.endsWith('.md')))
}


// The generated source of one entity in one target: its own file, not a test.
function entitySource(files: Record<string, string>, target: string, entity: string): string {
  const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return Object.entries(files).filter(([path]) => path.startsWith(target + '/') &&
    !/(^|\/)(test|tests|t)\//.test(path) && !/test|\.md$/i.test(Path.basename(path)) &&
    flat(Path.basename(path, Path.extname(path))).replace(/^sdkentity|entity$/g, '') === flat(entity))
    .map(([, text]) => text).join('\n')
}


// A method, function or field the source defines or assigns under this name;
// c's entity defines `<entity>_<op>`, which its vtable holds as `<op>`.
function defines(source: string, name: string, cPrefix?: string): boolean {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('(?<![\\w$])' + n + '(?![\\w$])\\s*[(=\\[]').test(source) ||
    new RegExp('\\b(defn|sub|def|fun|fn|func|function)\\s+' + n + '(?!\\w)').test(source) ||
    new RegExp('[:.]' + n + '\\s*\\(').test(source) ||
    (null != cPrefix && new RegExp('\\b' + cPrefix + '_' + n + '\\(').test(source))
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


  test('with no active entity, no table stands without rows and no lead-in without what it leads to', async () => {
    const docs = await documents(only())
    const lines = Object.fromEntries(Object.entries(docs).map(([path, text]) =>
      [path, text.split('\n').map((line: string) => ({ text: line, chain: '' }))]))
    deepStrictEqual(emptyTables({ id: 'entities-empty', files: docs, present: new Set(), on: {}, applies: {}, lines })
      .map((f: any) => f.doc + ': ' + f.line), [])
    deepStrictEqual(TARGETS.filter((t: string) => /reads its record:\n\n(?!-)/.test(docs[t + '/README.md'])), [])
    deepStrictEqual(TARGETS.filter((t: string) => /^### Entities\n\n(?!#### )/m.test(docs[t + '/README.md'])), [])
  })


  test('an entity\'s API path is its own route, never an action\'s', async () => {
    const docs = await documents(MISSION)
    const paths = (target: string): string[] =>
      [...docs[target + '/README.md'].matchAll(/^API path: `([^`]*)`/gm)].map((m) => m[1])
    for (const target of TARGETS) {
      strictEqual(paths(target).includes('/mission/{id}'), true, target + ': ' + paths(target).join(', '))
      strictEqual(paths(target).includes('/mission/{id}/launch'), false, target)
    }
  })


  test('every name on an Operations line is a method the entity\'s source defines', async () => {
    const files = await generated()
    const byName = Object.fromEntries(Object.values(entityCollection(makeModel([])))
      .map((e: any) => [e.Name, e.name]))
    let named = 0
    for (const target of TARGETS) {
      let heading = ''
      for (const line of files[target + '/README.md'].split('\n')) {
        if (line.startsWith('#### ')) heading = line.slice(5).trim()
        if (!line.startsWith('Operations: ') || null == byName[heading]) continue
        const source = entitySource(files, target, byName[heading])
        strictEqual('' !== source, true, target + ': no source for ' + heading)
        for (const name of line.slice('Operations: '.length).replace(/\.$/, '').split(', ')) {
          strictEqual(defines(source, name, 'c' === target ? byName[heading] : undefined), true,
            target + ': ' + heading + ' has no method ' + name)
          named++
        }
      }
    }
    strictEqual(0 < named, true, 'no Operations line was read')
    strictEqual(defines(entitySource(files, 'py', 'planet'), 'Load'), false)
  })
})
