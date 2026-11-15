// The shared sentences an optional runtime fact selects: each one is printed
// where a provider declares the fact and only there.

import { describe, test } from 'node:test'
import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import * as Path from 'node:path'

const { refText } = require('../dist/cmp/ReadmeRef.js')
const { opText } = require('../dist/helpers/runtimeprose.js')
const { printBlock, clientBlock, newScope } = require('../dist/helpers/example.js')
const { showFieldsOf } = require('../dist/helpers/sdkdesc.js')

const STAGE = Path.resolve(__dirname, '..', 'dist-test-scaffold', '.sdk', 'dist', 'cmp')

const syntax = (lang: string): any => require(Path.join(STAGE, lang, `Syntax_${lang}.js`)).Syntax

const entity = (name: string): any => ({
  name, Name: name[0].toUpperCase() + name.slice(1), className: name + 'Entity',
  sym: { accessor: 'Planet', var: name, plural: name + 's' },
  text: '', ops: ['list', 'load', 'remove'], id: 'id', dataId: 'id', parents: [], fields: [], fieldOps: false,
  refOps: [], actions: [], show: ['id'],
})

const desc: any = {
  target: 'x', name: 'demo', Name: 'Demo', package: 'demo-sdk',
  layout: { module: 'demo-sdk', client: 'DemoSDK', ctor: 'DemoSDK', dir: 'x', vars: { result: 'result' } },
  template: {},
  env: { prefix: 'DEMO' }, auth: { active: false }, options: [], server: [],
  quick: null,
  entities: [entity('planet')],
  ref: { title: 'Demo', test: true, optionRows: [], features: [] },
}

// A provider with one fact changed.
const withRef = (lang: string, ref: any): any => {
  const p = syntax(lang)
  return { ...p, ref: { ...p.ref, facts: { ...p.ref.facts, ...ref } } }
}


describe('optional runtime facts select shared sentences', () => {

  test('accessor.cached: the kept instance, said once', () => {
    const page = refText(withRef('lua', { accessor: { ...syntax('lua').ref.facts.accessor, cached: true } }), desc)
    ok(page.includes('return the `planetEntity` instance the client keeps'), page)
    const plain = refText(withRef('lua', { accessor: { ...syntax('lua').ref.facts.accessor, cached: false } }), desc)
    ok(!plain.includes('the client keeps'))
    ok(plain.includes('Create a new `planetEntity` instance.'))
  })

  test('streamSignal: on the stream member, never in the cancel paragraph', () => {
    const on = refText(withRef('py', { streamSignal: true }), desc)
    ok(on.includes('It ends early once `callopts.signal` reports an abort.'))
    const off = refText(withRef('py', { streamSignal: false }), desc)
    ok(!off.includes('callopts.signal'))
    const ts = refText(syntax('ts'), desc)
    const cancel = ts.slice(ts.indexOf('#### Cancelling a call'))
    ok(!cancel.slice(0, cancel.indexOf('\n#', 5)).includes('callopts'))
  })

  test('memberNamed bare: prose names direct without parentheses', () => {
    const bare = refText(withRef('rust', { memberNamed: 'bare' }), desc)
    ok(bare.includes('same parameters as `direct`.') || bare.includes('same parameters as `direct`'), bare)
    ok(!bare.includes('`direct()`'))
    ok(refText(syntax('rust'), desc).includes('`direct()`'))
  })

  test('a field member: "The entity name." rather than "Return ..."', () => {
    const page = refText(syntax('ocaml'), desc)
    ok(page.includes('The entity name.'))
    ok(!page.includes('Return the entity name.'))
  })

  test('copy on a match getter and on the utility getter follows Member.copy', () => {
    const ts = refText(syntax('ts'), desc)
    ok(ts.includes('Returns a copy of the current match criteria.'))
    ok(ts.includes('Return the SDK utility object.'))
    ok(!ts.includes('Return a copy of the SDK utility object.'))
    ok(refText(syntax('go'), desc).includes('Return a copy of the SDK utility object.'))
  })

  test('the deleted mark and the no-match call come from the facts', () => {
    const f = syntax('swift').facts
    strictEqual(opText(f, 'list', [], null, 'planets', { none: 'nil' }).includes('a call without one is `list(nil, nil)`.'), true)
    strictEqual(opText(syntax('ts').facts, 'list', [], null, 'planets', { none: 'undefined' }).includes('a call without one is `list()`.'), true)
    strictEqual(opText(syntax('lua').facts, 'list', [], null, 'planets', { none: 'nil' }).includes('a call without one'), false)
    ok(opText(syntax('ts').facts, 'remove', [], null, 'planet', { deleted: '{var}.deleted()' }).includes('`planet.deleted()` reads the mark.'))
    ok(!opText(syntax('ts').facts, 'remove', [], null, 'planet', {}).includes('mark.'))
  })

  test('wrapped: the record sentence names the unwrap', () => {
    const text = opText(syntax('swift').facts, 'load', [], null, 'planet', { none: 'nil' })
    ok(text.includes('`asNative as? Entity` takes the entity out, and `planet.data()` reads its record.'), text)
  })

  test('imports know their place: perl\'s library path', () => {
    const p = syntax('perl')
    const top = printBlock(p, clientBlock(desc), desc, newScope(false, 'top'))
    ok(top.includes("use lib 'x/lib';"), top)
    const tut = printBlock(p, clientBlock(desc), desc, newScope(false, 'tutorial'))
    ok(tut.includes("use lib 'lib';"), tut)
    throws(() => printBlock(p, clientBlock(desc), { ...desc, layout: { ...desc.layout, dir: undefined } }, newScope(false, 'top')))
  })

  test('the display field is a scalar', () => {
    deepStrictEqual(showFieldsOf([{ n: 'id', t: '$STRING' }, { n: 'fields', t: '$OBJECT' }], 'id'), ['id'])
    deepStrictEqual(showFieldsOf([{ n: 'id', t: '$STRING' }, { n: 'fields', t: '$OBJECT' }, { n: 'n', t: '$INTEGER' }], 'id'), ['id', 'n'])
  })
})
