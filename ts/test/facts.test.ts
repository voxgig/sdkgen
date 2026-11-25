import { test, describe } from 'node:test'
import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import Fs from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { Jostraca, Project, names } from 'jostraca'

import {
  SdkGen, applyFacts, fact, envName, envToken, isAuthActive, isAuthSuppressed, isHttpBasicAuth,
  resolveAuthIn, resolveAuthName, resolveAuthPrefix, serverVarEnv, serverVariables,
} from '../dist/sdkgen.js'
import { API_MODEL, BASIC_QUERY, BASIC_TEMPLATED, STAGE, makeModel } from './generateharness'
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

  test('link: a target links the root documents from its own folder, when they are written', () => {
    const model = makeModel(['ts', 'go', 'py'], undefined, [
      'main: kit: target: go: phase: agentguide: active: false',
      "main: kit: target: py: output: path: '../py-sdk'",
    ].join('\n'))
    const target = model.main[KIT].target
    const facts = (t: string) => [fact(target[t], 'link'), fact(target[t], 'docs')]
    deepStrictEqual(facts('ts'), [{ readme: '../README.md', agents: '../AGENTS.md' }, { readme: true, agents: true }])
    deepStrictEqual(facts('go'), [{ readme: '../README.md', agents: '../AGENTS.md' }, { readme: true, agents: false }])
    deepStrictEqual(facts('py'), [{ readme: '', agents: '' }, { readme: false, agents: false }])

    const off = makeModel(['ts'], undefined, 'main: kit: phase: top: active: false').main[KIT].target.ts
    deepStrictEqual([fact(off, 'link'), fact(off, 'docs')], [{ readme: '', agents: '' }, { readme: true, agents: true }])

    const root = makeModel(['ts'], undefined,
      'main: kit: phase: top: active: false\nmain: kit: target: ts: output: root: true').main[KIT].target.ts
    deepStrictEqual([fact(root, 'link'), fact(root, 'docs')], [{ readme: '', agents: '' }, { readme: false, agents: false }])
  })

  test('active: the active targets, in key order', () => {
    const model = makeModel(['ts', 'go', 'py'], undefined, 'main: kit: target: go: active: false')
    deepStrictEqual(fact(model.main[KIT], 'active'), ['py', 'ts'])
    deepStrictEqual(fact(applyFacts({ main: { [KIT]: { target: {} } } }).main[KIT], 'active'), [])
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

  // An older copy or an alias of a bundled consumer, made before the slots,
  // falls back to the legacy table, which must say what the files say.
  test('surface: the bundled targets that generate nothing declare the legacy table\'s rows', () => {
    const target = makeModel(TARGETS).main[KIT].target
    const phases = ['entity', 'feature', 'readme', 'agentguide', 'test']
    const consumers = TARGETS.filter((t) =>
      phases.every((p) => false === target[t].phase?.[p]?.active))
    deepStrictEqual(TARGETS.filter((t) => 'slot' === fact(target[t], 'surfaceFrom')), consumers)
    deepStrictEqual(Object.fromEntries(consumers.map((t) =>
      [t, [fact(target[t], 'surface'), fact(target[t], 'consumes')]])),
    { 'go-cli': ['cli', 'go'], 'go-mcp': ['mcp', 'go'], 'py-data': ['data', 'py'] })

    for (const t of consumers) {
      const wraps = target[t].consumes
      const legacy = applyFacts({ main: { [KIT]: { target: {
        [t]: { name: t }, [wraps]: { name: wraps },
      } } } }).main[KIT].target[t]
      deepStrictEqual([fact(legacy, 'surfaceFrom'), fact(legacy, 'surface'), fact(legacy, 'consumes')],
        ['legacy', target[t].surface, wraps], t + ': the legacy table disagrees with its model file')
    }

    ok(TARGETS.filter((t) => !consumers.includes(t))
      .every((t) => 'sdk' === fact(target[t], 'surface')), 'every other bundled target is an SDK')
  })

  test('surface: a project overlay cannot reclassify a bundled consumer', () => {
    throws(() => makeModel(['go', 'go-cli'], undefined, "main: kit: target: 'go-cli': surface: 'mcp'"),
      /main\.kit\.target\.go-cli\.surface/)
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


// The spec's auth alone, the project's config over it, Basic in and out of the
// header, and a project that suppresses auth outright.
const API_AUTH = API_MODEL.replace('auth: false', 'auth: true')

const AUTH_STATES: [string, string, string?][] = [
  ['public', ''],
  ['bearer, renamed, no prefix',
    "main: kit: config: auth: { active: true, prefix: '', in: 'HEADER', name: 'X-Api-Key' }"],
  ['basic in the header', BASIC_TEMPLATED],
  ['basic in the query', BASIC_QUERY],
  ['basic, suppressed', "main: kit: config: auth: { active: false, basic: true, prefix: 'Basic' }"],
  ['spec http basic', "main: kit: info: security: { type: 'http', prefix: 'Basic' }", API_AUTH],
  ['spec cookie key', "main: kit: info: security: { type: 'apiKey', in: 'cookie', name: 'session' }", API_AUTH],
  ['basic while the spec declares no auth', "main: kit: config: auth: { basic: true, in: 'header' }"],
]


describe('auth, server and environment facts', () => {

  test('auth: each part equals the code it is computed for, in every auth state', () => {
    for (const [label, extra, api] of AUTH_STATES) {
      const model = makeModel(['ts'], undefined, extra, undefined, undefined, api)
      const auth = fact(model.main[KIT], 'auth')
      const basic = isHttpBasicAuth(model)
      const where = resolveAuthIn(model)
      deepStrictEqual(auth, {
        apikey: isAuthActive(model),
        suppressed: isAuthSuppressed(model),
        basic,
        in: where,
        name: resolveAuthName(model),
        prefix: resolveAuthPrefix(model),
        secret: basic && 'header' === where && !isAuthSuppressed(model),
      }, label)
    }
  })

  test('auth: every PrepareAuth composes a Basic secret exactly when the fact says so', async () => {
    const langs = Fs.readdirSync(Path.join(STAGE, '.sdk', 'dist', 'cmp')).filter((lang: string) =>
      Fs.existsSync(Path.join(STAGE, '.sdk', 'dist', 'cmp', lang, `PrepareAuth_${lang}.js`))).sort()
    strictEqual(langs.length, 20, 'every SDK target has a PrepareAuth')

    const out: Record<string, Set<string>>[] = []
    const secrets: boolean[] = []
    for (const [, extra, api] of AUTH_STATES) {
      const model = makeModel(langs, undefined, extra, undefined, undefined, api)
      model.const = { name: model.name, year: 2026 }
      names(model.const, model.name)
      names(model, model.name)
      secrets.push(fact(model.main[KIT], 'auth').secret)

      const texts: Record<string, Set<string>> = {}
      for (const lang of langs) {
        const { PrepareAuth } = require(Path.join(STAGE, '.sdk', 'dist', 'cmp', lang, `PrepareAuth_${lang}.js`))
        const { fs, vol } = memfs({})
        await Jostraca().generate({ fs: () => fs, folder: '/x', model }, () => {
          Project({ folder: 'p' }, () => PrepareAuth({ target: model.main[KIT].target[lang] }))
        })
        texts[lang] = new Set(Object.values(vol.toJSON()).join('\n').match(/[A-Za-z_][A-Za-z0-9_]*/g))
      }
      out.push(texts)
    }
    deepStrictEqual(secrets.slice(0, 3), [false, false, true], 'public, bearer and Basic are the references')

    // The Basic branch's own words: what the Basic render writes and neither the
    // public nor the bearer one does. A comment's mention of base64 is not one.
    for (const lang of langs) {
      const marks = [...out[2][lang]].filter((w: string) => /64|secret/i.test(w) &&
        !out[0][lang].has(w) && !out[1][lang].has(w))
      ok(0 < marks.length, lang + ' has a Basic branch of its own')
      AUTH_STATES.forEach(([label], i) => strictEqual(marks.every((w: string) => out[i][lang].has(w)),
        secrets[i], `${lang}, ${label}`))
    }
  })

  test('server: equals serverVariables, in its order, over templated URLs', () => {
    const urls = [
      BASIC_TEMPLATED,
      "main: kit: info: servers: [{ url: 'https://api.test/{v}/{w}/{v}', variables: { w: { default: 'x', description: 'W' } } }]",
      "main: kit: info: servers: [{ url: '{base}', variables: { base: { description: 'The base URL.' } } }]",
      "main: kit: info: servers: [{ url: 'https://api.test', variables: { spare: { default: '' }, 'a.b': { default: '' } } }]",
      "main: kit: info: servers: [{ url: 'https://{edge-zone}.{a+b}.test/{c}', variables: { 'edge-zone': { default: '' }, 'a+b': {}, c: {} } }]",
      "main: kit: info: servers: [{ url: 'https://{a.b}.test/{c}' }]",
      '',
    ]
    for (const extra of urls) {
      const model = makeModel(['ts'], undefined, extra)
      deepStrictEqual(fact(model.main[KIT], 'server'), serverVariables(model), extra)
    }
  })

  test('env: the names equal envToken\'s and serverVarEnv\'s', () => {
    for (const name of ['demo', 'voxgig-solardemo', 'api.v2-x', 'user2fa', '9lives']) {
      const model = makeModel(['ts'], name, BASIC_TEMPLATED +
        'main: kit: entity: { pre_2fa: { name: "pre_2fa" }, "x-y": { name: "x-y" } }')
      const env = fact(model.main[KIT], 'env')
      const prefix = envName(model)
      deepStrictEqual(env, {
        prefix,
        apikey: prefix + '_APIKEY',
        secret: prefix + '_SECRET',
        base: prefix + '_BASE',
        live: prefix + '_TEST_LIVE',
        server: Object.fromEntries(serverVariables(model).map((v: any) => [v.name, serverVarEnv(prefix, v.name)])),
        entid: Object.fromEntries(Object.keys(model.main[KIT].entity).map((e: string) =>
          [e, `${prefix}_TEST_${envToken(e)}_ENTID`])),
      }, name)
    }
  })
})


describe('target, entity and project facts', () => {

  test('dir and sdkrel follow the place', () => {
    const target = makeModel(['ts', 'go', 'py'], undefined, [
      'main: kit: phase: top: active: false',
      'main: kit: target: ts: output: root: true',
      "main: kit: target: py: output: { path: '../py-sdk', sdkrel: '../sdk' }",
    ].join('\n')).main[KIT].target
    deepStrictEqual(Object.fromEntries(['ts', 'go', 'py'].map((t) =>
      [t, [fact(target[t], 'dir'), fact(target[t], 'sdkrel')]])),
    { ts: ['.', '.'], go: ['go', '..'], py: ['../py-sdk', '../sdk'] })
  })

  test('external: each active target placed in another repository, with that repository', () => {
    const kit = makeModel(['ts', 'go', 'go-cli', 'py', 'rb'], undefined, [
      "main: kit: target: 'go-cli': output: { path: '../acme-cli', repo: 'acme/demo-cli' }",
      "main: kit: target: py: output: path: '../acme-py'",
      "main: kit: target: rb: output: { path: '../acme-rb', repo: 'acme/demo-rb' }",
      'main: kit: target: rb: active: false',
      'main: kit: target: go: output: root: true',
    ].join('\n')).main[KIT]
    deepStrictEqual(fact(kit, 'external'), [
      { name: 'go-cli', title: 'Go CLI', surface: 'cli', url: 'https://github.com/acme/demo-cli' },
      { name: 'py', title: 'Python', surface: 'sdk', url: '' },
    ])

    const hosted = makeModel(['ts'], undefined, [
      "main: kit: repo: host: 'gitlab.com'",
      "main: kit: target: ts: output: { path: '../acme-ts', repo: 'acme/demo-ts' }",
    ].join('\n')).main[KIT]
    deepStrictEqual(fact(hosted, 'external').map((t: any) => t.url), ['https://gitlab.com/acme/demo-ts'])

    deepStrictEqual(fact(makeModel(['ts', 'go']).main[KIT], 'external'), [])
  })

  test('tag: the one npm package, or the ts one, is tagged v; every other target by name', () => {
    const tags = (targets: string[], extra: string) => {
      const target = makeModel(targets, undefined, extra).main[KIT].target
      return Object.fromEntries(targets.map((t) => [t, fact(target[t], 'tag')]))
    }
    deepStrictEqual(tags(['ts', 'js', 'go'], ''), { ts: 'v', js: 'js/v', go: 'go/v' })
    deepStrictEqual(tags(['js', 'go'], ''), { js: 'v', go: 'go/v' })
    deepStrictEqual(tags(['ts', 'js'], "main: kit: target: ts: publish: registry: state: 'inactive'"),
      { ts: 'ts/v', js: 'v' })
  })

  test('ops: an entity\'s canonical operations, in canonical order, none to fall back on', () => {
    const ops = fact(makeModel(['ts'], undefined, [
      'main: kit: entity: planet: op: update: active: false',
      'main: kit: entity: bare: { name: "bare" }',
    ].join('\n')).main[KIT], 'ops')
    deepStrictEqual(ops.planet, ['list', 'load', 'create', 'remove'])
    deepStrictEqual(ops.bare, [])
  })

  test('package: the JVM and Python package names of the project', () => {
    for (const [name, origin, jvm, py] of [
      ['demo', '', 'voxgig.demosdk', 'demo_sdk'],
      ['voxgig-solardemo', 'acme-sdk', 'acme.voxgigsolardemosdk', 'voxgigsolardemo_sdk'],
    ]) {
      const model = makeModel(['java', 'py'], name, '' === origin ? '' : `origin: '${origin}'`)
      deepStrictEqual(fact(model.main[KIT], 'package'), { jvm, py }, name)
    }
  })

  test('option: one row per client option the optspec declares', () => {
    const model = makeModel(['ts'])
    const rows = fact(model.main[KIT], 'option')
    deepStrictEqual(rows.map((r: any) => r.name), Object.keys(model.main[KIT].optspec))
    deepStrictEqual(rows.filter((r: any) => ['apikey', 'auth', 'extend'].includes(r.name)),
      [{ name: 'apikey', type: 'string' }, { name: 'auth', type: 'object' }, { name: 'extend', type: 'any' }])
  })

  test('the pass over 500 entities stays within seconds', () => {
    const model = makeModel(['ts', 'go', 'py', 'java', 'rb'])
    const planet = model.main[KIT].entity.planet
    for (let i = 0; i < 500; i++) {
      model.main[KIT].entity['planet' + i] = { ...JSON.parse(JSON.stringify(planet)), name: 'planet' + i }
    }
    const start = Date.now()
    applyFacts(model)
    const took = Date.now() - start
    ok(took < 20000, `took ${took} ms`)
    strictEqual(Object.keys(fact(model.main[KIT], 'env').entid).length, 507)
  })
})
