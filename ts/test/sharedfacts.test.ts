// Shared decisions that a provider only declares data for: which fields an
// example shows and where, the getter's copy, a note's layout names, the
// write step's sentence, an action's path parameters, and which features
// run by default.

import { describe, test } from 'node:test'
import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import * as Path from 'node:path'

const { refText } = require('../dist/cmp/ReadmeRef.js')
const { activeByDefault } = require('../dist/cmp/FeatureDocs.js')
const { actionBlock, listBlock, loadBlock, note, refOpBlock, writeBlock } = require('../dist/helpers/example.js')
const { writeSentence } = require('../dist/helpers/runtimeprose.js')

const STAGE = Path.resolve(__dirname, '..', 'dist-test-scaffold', '.sdk', 'dist', 'cmp')

function ts(): any {
  return require(Path.join(STAGE, 'ts', 'Syntax_ts.js')).Syntax
}

const sym = { accessor: 'Planet', var: 'planet', plural: 'planets' }

const entity = (name: string, show: string[]): any => ({
  name, Name: name[0].toUpperCase() + name.slice(1), className: name + 'Entity', sym: { ...sym, var: name },
  text: '', ops: ['list', 'load'], id: 'id', dataId: 'id', parents: [], fields: [], fieldOps: false,
  refOps: [], actions: [], show,
})

const desc: any = {
  target: 'ts', name: 'demo', Name: 'Demo', package: 'demo-sdk',
  layout: { module: 'demo-sdk', client: 'DemoSDK', ctor: 'DemoSDK', names: { helpers: 'Demo.Helpers' } },
  template: {},
  env: { prefix: 'DEMO' }, auth: { active: false }, options: [], server: [],
  quick: {
    entity: 'planet', list: [], create: null, update: null, patch: null, remove: null, chainsId: false,
    load: { entity: 'moon', args: [], nested: null },
  },
  entities: [entity('planet', ['id', 'title']), entity('moon', ['id', 'orbit'])],
  ref: { title: 'TypeScript', test: true, optionRows: [], features: [] },
}

const prints = (stmts: any[]): any[] => {
  const out: any[] = []
  const walk = (s: any): void => {
    if ('print' === s.k) out.push(s.what)
    ; (s.body || []).forEach(walk)
  }
  stmts.forEach(walk)
  return out
}


describe('shared facts', () => {

  test('listFields: chosen fields for a listed item in the tutorial only, the record elsewhere', () => {
    const facts = { ...ts().facts, prints: 'listFields' }
    deepStrictEqual(prints(listBlock(desc, facts, 'tutorial')).map((e) => e.k), ['fields'])
    deepStrictEqual(prints(listBlock(desc, facts, 'top')).map((e) => e.k), ['record'])
    deepStrictEqual(prints(loadBlock(desc, facts, 'tutorial')).map((e) => e.k), ['record'])
  })

  test('the fields shown are the shown entity\'s own', () => {
    const facts = { ...ts().facts, prints: 'fields' }
    deepStrictEqual(prints(listBlock(desc, facts)).map((e) => e.fields), [['id', 'title']])
    deepStrictEqual(prints(loadBlock(desc, facts)).map((e) => e.fields), [['id', 'orbit']])
  })

  test('a getter states its copy exactly where its member declares one', () => {
    const base = ts()
    const withCopy = (copy: boolean) => ({
      ...base, ref: { ...base.ref, facts: { ...base.ref.facts,
        entity: [...base.ref.facts.entity.filter((m: any) => m.kind.startsWith('stream')),
          { kind: 'dataGet', sig: 'data_get()', copy }] } },
    })
    const d = { ...desc, entities: [desc.entities[0]] }
    ok(refText(withCopy(true), d).includes('Get the entity data. Returns a copy of the current data.'))
    ok(!refText(withCopy(false), d).includes('Returns a copy'))
  })

  test('a note names the layout\'s modules, and stays as written otherwise', () => {
    const p = { notes: { ctor: 'Use `{names.helpers}.deep/1` from `{module}`; {nothing} stays.' } }
    strictEqual(note(p, 'ctor', desc), 'Use `Demo.Helpers.deep/1` from `demo-sdk`; {nothing} stays.\n\n')
  })

  test('the write step states each result style', () => {
    const f = ts().facts
    ok(/^Each write resolves to the entity it wrote \(a removed one is marked as deleted\), and throws/
      .test(writeSentence(f, ['create', 'remove'])))
    ok(/`\(value, error\)` too: .* a non-nil `err`/.test(writeSentence({ ...f, result: 'pair', errVar: 'err', pairForm: '(value, error)', noError: 'nil' }, ['create'])))
    // A pair's form and its no-error value are declared, never supplied here.
    throws(() => writeSentence({ ...f, result: 'pair', errVar: 'err' }, ['create']), /needs facts\.pairForm/)
    ok(/`NULL` with `\*err` set on failure, so check `err`/
      .test(writeSentence({ ...f, result: 'errslot', errVar: 'err', errSlot: '*err', nullValue: 'NULL' }, ['create', 'update'])))
  })

  // Where a failure does not interrupt, an example reads a single entity's
  // record back past the provider's check, and a write the call does not
  // check itself carries its check; where it does, the bare shape stays.
  test('an example never walks past a failure it has not checked', () => {
    const f = ts().facts
    const load = { name: 'load', args: [], needs: [], idInData: null, body: null, action: false }
    const ent = desc.entities[0]
    strictEqual(refOpBlock(desc, f, ent, load).length, 1)
    for (const result of ['errslot', 'pair', 'union']) {
      deepStrictEqual(refOpBlock(desc, { ...f, result }, ent, load).map((x: any) => x.k), ['call', 'print'], result)
    }
    const q = { ...desc.quick, create: [], update: [{ name: 'id', fromCreated: 'id' }], chainsId: true }
    const writes = (result: string) => writeBlock({ ...desc, quick: q }, { ...f, result, errSlot: '*err', nullValue: 'NULL' })
      .filter((x: any) => 'comment' !== x.k && 'gap' !== x.k).map((x: any) => x.k)
    deepStrictEqual(writes('errslot'), ['attempt', 'attempt'])
    deepStrictEqual(writes('throw'), ['call', 'call'])
    deepStrictEqual(writes('union'), ['call', 'call'])
  })

  test('an action is called with its route\'s path parameters', () => {
    const a = { action: 'terraform', op: 'create', path: '/planet/{id}/terraform',
      params: [{ name: 'id', type: 'STRING', placeholder: 'planet_id' }] }
    const [stmt] = actionBlock(desc, desc.entities[0], a)
    deepStrictEqual(stmt.arg.map((en: any) => en.key), ['$action', 'id'])
  })

  test('a feature runs by default exactly when its active option defaults to true', () => {
    strictEqual(activeByDefault({ options: [{ name: 'active', value: 'true' }] }), true)
    strictEqual(activeByDefault({ options: [{ name: 'active', value: 'false' }] }), false)
    strictEqual(activeByDefault({ options: [] }), false)
  })
})
