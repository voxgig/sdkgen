import { test, describe } from 'node:test'
import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { Project } from 'jostraca'

import { SdkGen, applyFacts, fact } from '../dist/sdkgen.js'
import { makeModel } from './generateharness'
import { SURFACES, surfaceOf } from '../dist/helpers/surface'


const KIT = 'kit'

const TARGETS = Fs.readdirSync(Path.join(__dirname, '..', 'project', '.sdk', 'model', 'target'))
  .filter((f: string) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
  .map((f: string) => f.replace(/\.aontu$/, ''))
  .sort()

const FEATURES = Fs.readdirSync(Path.join(__dirname, '..', 'project', '.sdk', 'model', 'feature'))
  .filter((f: string) => f.endsWith('.aontu') && 'feature-index.aontu' !== f)
  .map((f: string) => f.replace(/\.aontu$/, ''))
  .sort()


describe('facts', () => {

  test('every bundled feature: on equals its default active option', () => {
    const model = makeModel(['ts'], undefined, undefined, FEATURES)
    const features = model.main[KIT].feature
    deepStrictEqual(Object.keys(features).sort(), FEATURES)
    for (const name of FEATURES) {
      const f = features[name]
      strictEqual(fact(f, 'on'), true === f.config?.options?.active, name)
    }
  })

  test('place: folder by default, root, or external', () => {
    const model = makeModel(['ts', 'go', 'py'], undefined, [
      'main: kit: target: ts: output: root: true',
      "main: kit: target: py: output: path: '../py-sdk'",
    ].join('\n'))
    const target = model.main[KIT].target
    deepStrictEqual(
      Object.fromEntries(['ts', 'go', 'py'].map((t) => [t, fact(target[t], 'place')])),
      { ts: 'root', go: 'folder', py: 'external' })
  })

  test('a fact whose input is missing is absent, and reading it fails', () => {
    const model = applyFacts({
      main: { [KIT]: {
        feature: { bare: { name: 'bare' } },
        target: { bare: { name: 'bare' } },
      } },
    })
    throws(() => fact(model.main[KIT].feature.bare, 'on'), /has no fact 'on'/)
    throws(() => fact(model.main[KIT].target.bare, 'place'), /has no fact 'place'/)
    throws(() => fact({ name: 'raw' }, 'on'), /did not pass through applyFacts/)
  })

  test('surface: the legacy rows are exactly the bundled targets that generate nothing', () => {
    const target = makeModel(TARGETS).main[KIT].target
    const phases = ['entity', 'feature', 'readme', 'agentguide', 'test']
    const consumers = TARGETS.filter((t) =>
      phases.every((p) => false === target[t].phase?.[p]?.active))
    deepStrictEqual(TARGETS.filter((t) => 'legacy' === fact(target[t], 'surfaceFrom')), consumers)
    deepStrictEqual(Object.fromEntries(consumers.map((t) => [t, fact(target[t], 'surface')])),
      { 'go-cli': 'cli', 'go-mcp': 'mcp', 'py-data': 'data' })
    ok(TARGETS.filter((t) => !consumers.includes(t))
      .every((t) => 'sdk' === fact(target[t], 'surface')), 'every other bundled target is an SDK')
  })

  test('surface: an alias and an older four-flag copy are classed by their origin', () => {
    const off = { active: false }
    const target = applyFacts({ main: { [KIT]: { target: {
      go: { name: 'go' },
      cli2: { name: 'cli2', origname: 'go-cli',
        phase: { entity: off, feature: off, readme: off, test: off } },
    } } } }).main[KIT].target
    deepStrictEqual([fact(target.cli2, 'surface'), fact(target.cli2, 'surfaceFrom'),
      fact(target.cli2, 'consumes')], ['cli', 'legacy', 'go'])
    deepStrictEqual(fact(target.go, 'consumers'), ['cli2'])
  })

  test('surface: a declared word wins, and a word outside the list reads as unknown', () => {
    const target = applyFacts({ main: { [KIT]: { target: {
      sp: { name: 'sp', surface: 'seneca-provider', phase: { entity: { active: false } } },
      odd: { name: 'odd', surface: 'banana' },
      bare: { name: 'bare', phase: { entity: { active: false } } },
    } } } }).main[KIT].target
    ok(SURFACES.includes('seneca-provider'))
    deepStrictEqual([surfaceOf(target.sp), fact(target.sp, 'surfaceFrom')], ['seneca-provider', 'slot'])
    deepStrictEqual([fact(target.odd, 'surface'), surfaceOf(target.odd)], ['banana', ''])
    deepStrictEqual([surfaceOf(target.bare), fact(target.bare, 'surfaceFrom')], ['', 'unknown'])
  })

  test('consumes: an alias of the wrapped target answers, and two of them name both', () => {
    const cli = { name: 'go-cli', phase: { entity: { active: false } } }
    const one = applyFacts({ main: { [KIT]: { target: {
      go2: { name: 'go2', origname: 'go' }, 'go-cli': { ...cli },
    } } } }).main[KIT].target
    deepStrictEqual([fact(one['go-cli'], 'consumes'), fact(one.go2, 'consumers')], ['go2', ['go-cli']])

    throws(() => applyFacts({ main: { [KIT]: { target: {
      go2: { name: 'go2', origname: 'go' }, go3: { name: 'go3', origname: 'go' }, 'go-cli': { ...cli },
    } } } }), /builds on go, and 2 installed targets come from it: go2, go3/)
  })

  test('applying the facts twice changes nothing', () => {
    const once = makeModel(['ts', 'go'])
    const twice = applyFacts(JSON.parse(JSON.stringify(once)))
    deepStrictEqual(twice, JSON.parse(JSON.stringify(once)))
  })

  test('generate applies the facts before Root runs', async () => {
    const model = makeModel(['ts'], undefined, undefined, ['test', 'log'])
    for (const f of Object.values(model.main[KIT].feature) as any[]) {
      delete f.fact
    }
    let seen: any
    const root = (props: any) => {
      seen = props.model.main[KIT].feature.test.fact
      Project({ folder: 'p' }, () => {})
    }
    const { fs } = memfs({})
    const res = await SdkGen({ fs, folder: '/top', root: '' }).generate({ model, root })
    strictEqual(res.ok, true)
    strictEqual(seen.on, false)
    strictEqual(seen.title.raw, model.main[KIT].feature.test.title)
  })
})


// The summary slot, from the spec's info or, over it, the project's text.
function summary(raw: string, own = false): any {
  const model = applyFacts({ main: { [KIT]: own ? { text: { summary: raw } } : { info: { summary: raw } } } })
  return fact(model.main[KIT], 'text').summary
}


describe('escaped text', () => {

  test('a table cell escapes pipes and line breaks', () => {
    strictEqual(summary('a | b\nc\r\nd').cell, 'a \\| b<br>c<br>d')
    strictEqual(summary('a | b').inline, 'a | b')
  })

  test('inline text joins its lines', () => {
    strictEqual(summary('one  \n  two\r\nthree').inline, 'one two three')
    strictEqual(summary('one\ntwo').text, 'one\ntwo')
  })

  test('$$ is hidden from the template pass, and $& and $1 stay as written', () => {
    const s = summary('cost $$x$$ and $& and $1 and $')
    strictEqual(s.text, 'cost $&#36;x$&#36; and $& and $1 and $')
    strictEqual(s.cell, s.text)
    strictEqual(s.inline, s.text)
    strictEqual(summary('a $& b').code, '`a $& b`')
  })

  test('a relative link in spec text becomes its label; any other link stays', () => {
    const raw = 'see [guide](guide.md), [root](/docs/x), ![pic](a.png), ' +
      '[site](https://x.io/a), [top](#top) and [cdn](//cdn.x/y)'
    strictEqual(summary(raw).inline,
      'see guide, root, pic, [site](https://x.io/a), [top](#top) and [cdn](//cdn.x/y)')
    strictEqual(summary(raw, true).inline, raw)
    strictEqual(summary(raw).vendor, true)
    strictEqual(summary(raw, true).vendor, false)
  })

  test('three backticks open no fence, except in the project\'s own text', () => {
    const s = summary('a ``` b\n```py\nx\n```')
    strictEqual(s.inline, 'a &#96;&#96;&#96; b &#96;&#96;&#96;py x &#96;&#96;&#96;')
    strictEqual(s.cell, 'a &#96;&#96;&#96; b<br>&#96;&#96;&#96;py<br>x<br>&#96;&#96;&#96;')
    strictEqual(s.text, 'a &#96;&#96;&#96; b\n&#96;&#96;&#96;py\nx\n&#96;&#96;&#96;')
    strictEqual(summary('a\n```py\nx\n```', true).text, 'a\n```py\nx\n```')
  })

  test('a code span fences past every backtick it holds', () => {
    strictEqual(summary('a|b').code, '`a|b`')
    strictEqual(summary('a|b').codecell, '`a\\|b`')
    strictEqual(summary('a`b').code, '`` a`b ``')
    strictEqual(summary('a``b').code, '``` a``b ```')
    strictEqual(summary('a```b').code, '```` a```b ````')
    strictEqual(summary('one\ntwo').code, '`one two`')
    strictEqual(summary('').code, '')
  })

  test('a link target encodes what would end it, and a label drops the scheme', () => {
    const s = summary('https://x.io/a (b)/')
    strictEqual(s.link, 'https://x.io/a%20%28b%29/')
    strictEqual(s.label, 'x.io/a (b)')
  })

  test('each text is escaped beside what it describes', () => {
    const model = makeModel(['ts'], undefined, [
      "main: kit: text: title: 'A | B'",
      "main: kit: text: entity_desc: planet: 'P | Q'",
      "main: kit: entity: moon: short: 'M | N'",
    ].join('\n'), ['test', 'netsim'])
    const kit = model.main[KIT]
    strictEqual(fact(kit, 'text').title.cell, 'A \\| B')
    strictEqual(fact(kit.entity.planet, 'desc').cell, 'P \\| Q')
    strictEqual(fact(kit.entity.planet, 'desc').vendor, false)
    strictEqual(fact(kit.entity.moon, 'desc').raw, 'M | N')
    strictEqual(fact(kit.entity.moon, 'desc').vendor, true)
    strictEqual(fact(kit.feature.netsim, 'title').raw, kit.feature.netsim.title)
    for (const name of Object.keys(kit.feature.netsim.config.options)) {
      ok(null != fact(kit.feature.netsim, 'option')[name].value, name)
    }
  })

  test('a feature option escapes its default and its type', () => {
    const f = applyFacts({ main: { [KIT]: { feature: { f: { name: 'f', title: 'F', config: {
      options: { sep: '|', tick: 'a`b' },
      optspec: { sep: '`$STRING`', cb: ['`$ONE`', '`$NUMBER`', '`$MAP`'] },
    } } } } } }).main[KIT].feature.f
    const option = fact(f, 'option')
    deepStrictEqual(Object.keys(option).sort(), ['cb', 'sep', 'tick'])
    strictEqual(option.sep.value.codecell, "`'\\|'`")
    strictEqual(option.tick.value.codecell, "`` 'a`b' ``")
    strictEqual(option.cb.type.cell, 'number \\| map')
    strictEqual(option.sep.type, undefined)
  })
})
