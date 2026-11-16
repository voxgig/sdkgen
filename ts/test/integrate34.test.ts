// The shared changes the second wave of ports asked for, each pinned here:
// the root quick start's list item where a local's scope is its whole block
// (C#), the stream signal named in words with the one form a runtime reads,
// a remove that keeps the entity's data (cpp), and a deleted read that names
// a type through the layout (java).

import { describe, test } from 'node:test'
import { ok, strictEqual } from 'node:assert'
import * as Path from 'node:path'

const { refText } = require('../dist/cmp/ReadmeRef.js')
const { fillLayout, listBlock } = require('../dist/helpers/example.js')
const { opText } = require('../dist/helpers/runtimeprose.js')

const STAGE = Path.resolve(__dirname, '..', 'dist-test-scaffold', '.sdk', 'dist', 'cmp')

function provider(lang: string, edit: (r: any) => void): any {
  const { Syntax } = require(Path.join(STAGE, lang, 'Syntax_' + lang + '.js'))
  const facts = JSON.parse(JSON.stringify(Syntax.ref.facts))
  edit(facts)
  return { ...Syntax, ref: { ...Syntax.ref, facts } }
}

const sym = { accessor: 'Planet', var: 'planet', plural: 'planets' }

const desc: any = {
  target: 'ts', name: 'demo', Name: 'Demo', package: 'demo-sdk',
  layout: { module: 'demo-sdk', client: 'DemoSDK', ctor: 'DemoSDK', vars: {} },
  template: {},
  env: { prefix: 'DEMO' }, auth: { active: false }, options: [], server: [],
  quick: { entity: 'planet', list: [], load: { entity: 'planet', args: [] } },
  entities: [{
    name: 'planet', Name: 'Planet', className: 'PlanetEntity', sym, text: '', ops: [], id: 'id',
    dataId: 'id', parents: [], fields: [], fieldOps: false, refOps: [], actions: [], show: [],
  }],
  ref: { title: 'TypeScript', test: true, optionRows: [], features: [] },
}


describe('integration 3.4: shared changes', () => {

  test('a block-scoped language names the root quick start\'s list item apart from the entity it loads (CS0136)', () => {
    const each = (facts: any, where: string) => (listBlock(desc, facts, where)[0].body as any[]).find((s) => 'each' === s.k)
    const base = { prints: 'record', result: 'throw' }
    strictEqual(each(base, 'top').item.name, 'planet')
    strictEqual(each({ ...base, blockScope: true }, 'top').item.name, 'item')
    strictEqual(each({ ...base, blockScope: true }, 'top').item.list, 'planets')
    // The tutorial prints list and load in blocks of their own: unchanged.
    strictEqual(each({ ...base, blockScope: true }, 'tutorial').item.name, 'planet')
  })

  test('the stream signal is named in words, with the one form a runtime reads where it declares one', () => {
    const plain = refText(provider('ts', () => undefined), desc).replace(/\s+/g, ' ')
    ok(plain.includes('It ends early once the `signal` in `callopts` reports an abort.'), plain)
    ok(!plain.includes('`callopts.signal`'), 'no language-specific key notation')
    const form = refText(provider('ts', (r) => { r.streamSignalForm = 'a `CancellationToken`' }), desc).replace(/\s+/g, ' ')
    ok(form.includes('reports an abort; the signal is read only as a `CancellationToken`, and any other value is ignored.'), form)
  })

  test('a remove that keeps the entity\'s data says so instead of the record sentence', () => {
    const f: any = { result: 'throw', named: 'call', async: false, record: '{var}.data()', method: {}, prints: 'record' }
    const kept = opText(f, 'remove', [], null, 'planet', { deleted: '{var}.deleted()', removeKeeps: true })
    ok(kept.includes('It reads no record from the response: `planet.data()` still reads the data the entity held.'), kept)
    ok(!kept.includes('reads its record'), kept)
    ok(opText(f, 'remove', [], null, 'planet', { deleted: '{var}.deleted()' }).includes('`planet.data()` reads its record.'))
  })

  test('the deleted read fills layout names as a note does', () => {
    strictEqual(fillLayout('(({module}.{names.entity}.EntityBase) {var}).deleted()', { module: 'voxgig.demosdk', names: { entity: 'entity' } }),
      '((voxgig.demosdk.entity.EntityBase) {var}).deleted()')
    strictEqual(fillLayout('{names.none} {x}', { names: {} }), '{names.none} {x}')
  })
})
