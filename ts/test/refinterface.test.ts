// The parts of the provider interface that no ported language uses yet are
// exercised here, so the first port to need one is not the first to run it:
// alternate constructors, test-constructor variants, a client heading, an
// entity noun, and every stream kind.

import { describe, test } from 'node:test'
import { ok, strictEqual, throws } from 'node:assert'
import * as Path from 'node:path'

const { refText } = require('../dist/cmp/ReadmeRef.js')

const STAGE = Path.resolve(__dirname, '..', 'dist-test-scaffold', '.sdk', 'dist', 'cmp')


function provider(edit: (r: any) => void): any {
  const { Syntax } = require(Path.join(STAGE, 'ts', 'Syntax_ts.js'))
  const facts = JSON.parse(JSON.stringify(Syntax.ref.facts))
  edit(facts)
  return { ...Syntax, ref: { ...Syntax.ref, facts } }
}

const sym = { accessor: 'Planet', var: 'planet', plural: 'planets' }

const desc: any = {
  target: 'ts', name: 'demo', Name: 'Demo', package: 'demo-sdk',
  layout: { module: 'demo-sdk', client: 'DemoSDK', ctor: 'DemoSDK' },
  template: {},
  env: { prefix: 'DEMO' }, auth: { active: false }, options: [], server: [], quick: null,
  entities: [{
    name: 'planet', Name: 'Planet', className: 'PlanetEntity', sym, text: '', ops: [], id: 'id',
    dataId: 'id', parents: [], fields: [], fieldOps: false, refOps: [], actions: [],
  }],
  ref: { title: 'TypeScript', test: true, optionRows: [], features: [] },
}


describe('reference interface', () => {

  test('alternate constructors and test variants each get their sentence', () => {
    const p = provider((r) => {
      r.ctorAlts = [{ call: '{ctor}.make0()', kind: 'defaults' }, { call: '{ctor}.of(options)', kind: 'explicit' }]
      r.test = [
        { sig: 'test(testopts, sdkopts)', call: 'const client = {client}.test(null, null)', args: true,
          alts: [{ call: '{client}.test_with(options)', kind: 'explicit' }] },
        { sig: 'test()', call: 'const client = {client}.test()', args: false },
      ]
    })
    const out = refText(p, desc).replace(/\s+/g, ' ')
    ok(out.includes('`DemoSDK.make0()` uses the defaults and `DemoSDK.of(options)` takes the options spelled out.'), out)
    ok(out.includes('`DemoSDK.test_with(options)` takes the options spelled out.'), out)
    ok(out.includes('Create a test client with mock features active. It takes no arguments.'), out)
  })

  test('a client with no type is headed as declared; nouns differ for the client and an entity', () => {
    const p = provider((r) => {
      r.heading = '{module}'
      r.noun = 'Functions'
      r.entityNoun = 'Members'
    })
    const out = refText(p, desc)
    ok(out.includes('\n## demo-sdk\n'), out)
    ok(out.includes('### Client Functions'), out)
    ok(out.includes('### Common Members'), out)
  })

  test('every stream kind has its sentence', () => {
    const kinds: Record<string, RegExp> = {
      stream: /stream its result items\./,
      streamIterator: /as an async iterator\./,
      streamGenerator: /as a generator\./,
      streamLazy: /return a sequence of its result items\./,
      streamList: /return its result items, every one already read\./,
      streamSync: /an iterator over its result items\./,
      streamFunction: /returns its next result item on each call, and `undefined` once the items end\./,
    }
    for (const [kind, re] of Object.entries(kinds)) {
      const p = provider((r) => {
        r.entity = r.entity.map((m: any) => m.kind.startsWith('stream') ? { ...m, kind } : m)
      })
      const out = refText(p, desc).replace(/\n/g, ' ')
      ok(re.test(out), kind + ': ' + out.slice(out.indexOf('stream(')))
    }
  })

  // When the operation runs is a declared fact, never read from the kind:
  // swift's async iterator runs before it returns, ts's when iteration starts.
  test('the ok literal of direct has no default', () => {
    throws(() => refText(provider((f) => { f.direct = { ...f.direct, okFalse: undefined } }), desc), /okFalse/)
  })

  test('a stream says when its operation runs, and has no default', () => {
    const runs: Record<string, RegExp> = {
      iterate: /The operation runs when iteration starts, not when the call returns\./,
      call: /The operation runs before the call returns\./,
      background: /The operation starts at the call and runs beside/,
    }
    for (const [r, re] of Object.entries(runs)) {
      const out = refText(provider((f) => {
        f.entity = f.entity.map((m: any) => m.kind.startsWith('stream') ? { ...m, runs: r } : m)
      }), desc).replace(/\n/g, ' ')
      ok(re.test(out), r + ': ' + out.slice(out.indexOf('stream(')))
    }
    throws(() => refText(provider((f) => {
      f.entity = f.entity.map((m: any) => m.kind.startsWith('stream') ? { ...m, runs: undefined } : m)
    }), desc), /needs runs/)
  })

  // The direct result's failure literal is the runtime's, declared; shared
  // code holds none.
  test('the direct result states the declared ok literal, and has no default', () => {
    const out = refText(provider((f) => { f.direct = { ...f.direct, okFalse: '0' } }), desc).replace(/\n/g, ' ')
    ok(out.includes('`ok` is `0` unless the status is 2xx'), out)
    ok(!/`ok` is (then )?`false`/.test(out), out)
  })

  // Without the test feature the client has a mock only where the runtime
  // ships the feature whatever the model says.
  test('the test client without the test feature follows testMock, which has no default', () => {
    const none = { ...desc, ref: { ...desc.ref, test: false } }
    const generated = refText(provider((r) => { r.testMock = 'generated' }), none).replace(/\n/g, ' ')
    ok(generated.includes('so the client has no mock transport and refuses every request.'), generated)
    const always = refText(provider((r) => { r.testMock = 'always' }), none).replace(/\n/g, ' ')
    ok(always.includes('Create a test client with mock features active.'), always)
    ok(!always.includes('no mock transport'), always)
    throws(() => refText(provider((r) => { r.testMock = undefined }), none), /testMock/)
  })

  // A key of the direct result is read by the language's own printer; the
  // branch reads it as a truth test.
  test('the direct result names its keys through the read printer', () => {
    const p = provider(() => { })
    const read = (v: string, k: string, truth?: boolean) => truth ? `test(${v}, ${k})` : `get(${v}, ${k})`
    const out = refText({ ...p, ref: { ...p.ref, read } }, desc).replace(/\n/g, ' ')
    ok(out.includes('A key is read as `get(result, err)`.'), out)
    ok(out.includes('so branch on `test(result, ok)`.'), out)
  })

  test('an entity that is no instance of a class is called an entity', () => {
    const out = refText(provider((r) => { r.entityBy = 'Name' }), desc).replace(/\n/g, ' ')
    ok(out.includes('Create a new `Planet` entity.'), out)
    const cls = refText(provider((r) => { r.entityBy = 'class' }), desc).replace(/\n/g, ' ')
    ok(cls.includes('Create a new `PlanetEntity` instance.'), cls)
  })

  test('the entity is named by its class, its Name or its module', () => {
    for (const [by, want] of [['class', '## PlanetEntity'], ['Name', '## Planet'], ['module', '## Demo.Planet']]) {
      const d = { ...desc, entities: [{ ...desc.entities[0], sym: { ...sym, module: 'Demo.Planet' } }] }
      const out = refText(provider((r) => { r.entityBy = by }), d)
      strictEqual(out.includes('\n' + want + '\n'), true, by + ': ' + out)
    }
  })
})
