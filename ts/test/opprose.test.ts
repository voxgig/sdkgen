import { test, describe, before, after } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { Jostraca, Project, Folder, File } from 'jostraca'

import { SdkGen, ReadmeModel, entityCollection } from '../dist/sdkgen.js'
import { STAGE, SCAFFOLD, makeModel, makeRoot, makeLog, layeredFs, idlessUpdate, ROUTING_MODEL, underscoreKeyed } from './generateharness'
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


// An entity with no field.
const BEACON = `
main: kit: entity: beacon: {
  alias: field: {}
  name: "beacon"
  fields: {}
  op: { list: { name: "list", points: [ {
    g: {}, m: "GET", o: "/beacon", s: [{ lit: "beacon" }]
    t: { req: "\`reqdata\`", res: "\`body\`" }
  } ] } }
}

main: kit: flow: BasicBeaconFlow: {
  entity: "beacon", kind: "basic", name: "BasicBeaconFlow"
  step: [ { o: "list", i: { ref: "beacon_ref01", srcdatavar: "beacon_ref01_data", suffix: "_dt0" } } ]
}
`


// Keyed by a slug, which its update's route names.
const GADGET = `
main: kit: entity: gadget: {
  alias: field: {}
  name: "gadget"
  id: { field: "slug", name: "slug" }
  fields: {
    "slug": { h: 'Slug', n: "slug", r: true, t: "\`$STRING\`" }
    "title": { h: 'Title', n: "title", r: false, t: "\`$STRING\`" }
  }
  op: {
    load: { name: "load", points: [ {
      g: { params: [ { k: "param", n: "slug", or: "slug", r: true, t: "\`$STRING\`" } ] }
      m: "GET", o: "/gadget/{slug}", s: [{ lit: "gadget" }, { var: "slug" }]
      t: { req: "\`reqdata\`", res: "\`body\`" }
    } ] }
    update: { name: "update", points: [ {
      g: { params: [ { k: "param", n: "slug", or: "slug", r: true, t: "\`$STRING\`" } ] }
      m: "PUT", o: "/gadget/{slug}", s: [{ lit: "gadget" }, { var: "slug" }]
      t: { req: "\`reqdata\`", res: "\`body\`" }
    } ] }
  }
}

main: kit: flow: BasicGadgetFlow: {
  entity: "gadget", kind: "basic", name: "BasicGadgetFlow"
  step: [ { o: "load", i: { ref: "gadget_ref01", srcdatavar: "gadget_ref01_data", suffix: "_dt0" } } ]
}
`


// Its ping is an operation no generated method reaches.
const PROBE = `
main: kit: entity: probe: {
  alias: field: {}
  name: "probe"
  id: { field: "id", name: "id" }
  fields: {
    "id": { h: 'Id', n: "id", r: true, t: "\`$STRING\`" }
  }
  op: {
    load: { name: "load", points: [ {
      g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`" } ] }
      m: "GET", o: "/probe/{id}", s: [{ lit: "probe" }, { var: "id" }]
      t: { req: "\`reqdata\`", res: "\`body\`" }
    } ] }
    ping: { name: "ping", points: [ {
      g: { params: [ { k: "param", n: "probe_id", or: "probe_id", r: true, t: "\`$STRING\`" } ] }
      m: "POST", o: "/probe/{probe_id}/ping", s: [{ lit: "probe" }, { var: "probe_id" }, { lit: "ping" }]
      t: { req: "\`reqdata\`", res: "\`body\`" }
    } ] }
  }
}

main: kit: flow: BasicProbeFlow: {
  entity: "probe", kind: "basic", name: "BasicProbeFlow"
  step: [ { o: "load", i: { ref: "probe_ref01", srcdatavar: "probe_ref01_data", suffix: "_dt0" } } ]
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
          // rust defines an operation that may take sources in its `_with`
          // form, and its trait supplies the plain one.
          strictEqual(defines(source, name, 'c' === target ? byName[heading] : undefined) ||
            ('rust' === target && defines(source, name + '_with')), true,
            target + ': ' + heading + ' has no method ' + name)
          named++
        }
      }
    }
    strictEqual(0 < named, true, 'no Operations line was read')
    strictEqual(defines(entitySource(files, 'py', 'planet'), 'Load'), false)
  })


  test('an entity with no field gets no field table', async () => {
    const docs = await documents(BEACON)
    const lines = Object.fromEntries(Object.entries(docs).map(([path, text]) =>
      [path, text.split('\n').map((line: string) => ({ text: line, chain: '' }))]))
    deepStrictEqual(emptyTables({ id: 'fieldless', files: docs, present: new Set(), on: {}, applies: {}, lines })
      .map((f: any) => f.doc + ': ' + f.line), [])
    strictEqual(TARGETS.every((t: string) => docs[t + '/README.md'].includes('#### Beacon')), true)
  })


  test('a quick start promises the steps it takes and heads its writes with them', async () => {
    const lead = (docs: Record<string, string>, t: string) =>
      (/This tutorial walks through ([^.]*)\./.exec(docs[t + '/README.md']) || [])[1]
    const writes = (docs: Record<string, string>, t: string) =>
      [...docs[t + '/README.md'].matchAll(/^### \d+\. ((Create|Update|Patch|Remove)\b.*)$/gm)].map((m) => m[1])
        .filter((h: string) => 'Create a client' !== h)
    const numbered = TARGETS.filter((t: string) => !['go', 'js'].includes(t))

    const ambient = await documents()
    for (const t of TARGETS) {
      strictEqual(lead(ambient, t), 'creating a client and loading a specific record', t)
    }
    const planet = await documents(only('planet'))
    const update = await documents(only('planet') + '\n' + opsOff('planet', 'list', 'load', 'create', 'patch', 'remove'))
    for (const t of numbered) {
      strictEqual(lead(planet, t), 'creating a client, listing entities, and loading a specific record', t)
      deepStrictEqual(writes(planet, t), ['Create, update, patch, and remove'], t)
      strictEqual(lead(update, t), 'creating a client', t)
      deepStrictEqual(writes(update, t), ['Update'], t)
    }
  })


  test('a reference asks for the entity id only where the call needs it, by its name', async () => {
    const ID = /must include the entity `?id`?/
    const refs = (docs: Record<string, string>) => TARGETS.filter((t: string) => ID.test(docs[t + '/REFERENCE.md']))
    deepStrictEqual(refs(await documents()), TARGETS)
    deepStrictEqual(refs(await documents(idlessUpdate())), [])
    const slug = await documents(only() + '\n' + GADGET)
    deepStrictEqual(TARGETS.filter((t: string) => !slug[t + '/REFERENCE.md'].includes('must include the entity `slug`')), [])
    deepStrictEqual(refs(slug), [])
  })


  test('a reference says a list needs no argument only where it needs none, and names what it does need', async () => {
    const ALL = /list all/
    const flat = await documents()
    const listing = TARGETS.filter((t: string) => ALL.test(flat[t + '/REFERENCE.md'] + flat[t + '/README.md']))
    strictEqual(15 < listing.length, true, 'the fixture names listing all in ' + listing.join(', '))
    const nested = await documents(only() + '\n' + ROUTING_MODEL)
    deepStrictEqual(TARGETS.filter((t: string) => ALL.test(nested[t + '/REFERENCE.md'] + nested[t + '/README.md'])), [])
    deepStrictEqual(listing.filter((t: string) =>
      !nested[t + '/REFERENCE.md'].includes('The match must include `planet_id`.')), [])
  })


  test('a direct or prepare example calls a route the model has', async () => {
    const PLACEHOLDER = '/api/resource/{id}'
    const docs = (all: Record<string, string>, t: string) =>
      [t + '/README.md', t + '/REFERENCE.md', 'README.md'].map((p: string) => all[p] ?? '').join('\n')

    const base = await documents()
    deepStrictEqual(TARGETS.filter((t: string) => docs(base, t).includes(PLACEHOLDER)), [])
    deepStrictEqual(TARGETS.filter((t: string) => !base[t + '/README.md'].includes('/planet/{id}')), [])

    const probe = await documents(only() + '\n' + PROBE)
    for (const t of TARGETS) {
      const text = docs(probe, t)
      strictEqual(text.includes(PLACEHOLDER), false, t)
      strictEqual(text.includes('/probe/{probe_id}/ping'), true, t)
      strictEqual(2 <= (probe[t + '/README.md'].match(/probe_id\b/g) || []).length, true, t + ': no probe_id key')
      strictEqual(/\bPOST\b/.test(probe[t + '/README.md']), true, t + ': no POST')
    }

    // A renamed parameter is filled by the name the path gives it.
    const renamed = await documents(underscoreKeyed())
    for (const t of TARGETS) {
      const lines = renamed[t + '/README.md'].split('\n')
      const calls = lines.map((line: string, i: number) => line.includes('/boxes/{boxId}') ?
        lines.slice(i, i + 4).join('\n') : null).filter((call: string | null) => null != call) as string[]
      strictEqual(0 < calls.length, true, t + ': no direct call to /boxes/{boxId}')
      deepStrictEqual(calls.filter((call: string) => !/params[\s\S]*boxId/.test(call)), [],
        t + ': a direct call fills the path by another name')
    }

    // With no route of one parameter there is nothing real to call.
    const lone = await documents(only('ambient'))
    deepStrictEqual(TARGETS.filter((t: string) => !docs(lone, t).includes(PLACEHOLDER)), [])
  })
})
