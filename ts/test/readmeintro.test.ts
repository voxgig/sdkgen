import { test, describe, before, after } from 'node:test'
import { strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { Jostraca, Project, Folder, File } from 'jostraca'
import { memfs } from 'memfs'

import { ReadmeIntro, SdkGen, applyFacts, entityCollection, introOps } from '../dist/sdkgen.js'
import { STAGE, SCAFFOLD, makeModel, makeRoot, makeLog, layeredFs } from './generateharness'


const model = applyFacts({
  name: 'demo', Name: 'Demo',
  main: { kit: {
    info: { tagline: 'Tagged.' },
    phase: { top: { active: true } },
    target: {
      body: { name: 'body', title: 'Body', output: { path: '', root: false } },
      whole: { name: 'whole', title: 'Whole', output: { path: '', root: false } },
      'go-cli': { output: { path: '', root: false } },
    },
    entity: {},
  } },
})


describe('ReadmeIntro', () => {
  let folder: string

  before(() => {
    folder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-readmeintro-'))
    const jostraca = JSON.stringify(require.resolve('jostraca'))
    const write = (t: string, src: string) => {
      const dir = Path.join(folder, '.sdk', 'dist', 'cmp', t)
      Fs.mkdirSync(dir, { recursive: true })
      Fs.writeFileSync(Path.join(dir, 'ReadmeIntro_' + t + '.js'),
        'const { Content } = require(' + jostraca + ')\n' + src)
    }
    write('body', 'module.exports = { ReadmeIntroBody: () => Content("Body.\\n\\n") }')
    // As 4.42.0 scaffolded every intro: a whole ReadmeIntro that writes its own note.
    write('whole', 'const sdkgen = require(' + JSON.stringify(require.resolve('../dist/sdkgen.js')) + ')\n' +
      'module.exports = { ReadmeIntro: sdkgen.cmp(function ReadmeIntro(props) {\n' +
      '  Content("# Whole, as written.\\n\\n" + sdkgen.alongsideNote(props.ctx$.model, props.target.name))\n' +
      '}) }')
  })

  after(() => {
    Fs.rmSync(folder, { recursive: true, force: true })
  })

  async function render(name: string): Promise<string> {
    const { fs, vol } = memfs({})
    const noop = () => {}
    const log: any = { info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
      child() { return log } }
    await Jostraca().generate({ fs: () => fs, folder, model, log }, () => {
      Project({ folder: 'p' }, () => Folder({ name: 'd' }, () => File({ name: 'out.md' }, () => {
        ReadmeIntro({ target: model.main.kit.target[name] })
      })))
    })
    const json: any = vol.toJSON()
    return json[Object.keys(json).find((k) => k.endsWith('out.md'))!]
  }


  test('frames a language body with the title, tagline and alongside note', async () => {
    strictEqual(await render('body'), '# Demo Body SDK\n\nTagged.\n\nBody.\n\n' +
      '> Other languages and the CLI live alongside this one — see\n' +
      '> the [top-level README](../README.md).\n\n')
  })


  test('leaves a component that writes the whole introduction to write it', async () => {
    strictEqual(await render('whole'), '# Whole, as written.\n\n' +
      '> Other languages and the CLI live alongside this one — see\n' +
      '> the [top-level README](../README.md).\n\n')
  })
})


describe('introOps', () => {
  const ops = (entity: any) => introOps({ main: { kit: { entity } } })

  test('names the active ops of the active entities that the targets generate, in canonical order', () => {
    deepStrictEqual(ops({
      a: { op: { remove: {}, search: {}, list: {}, load: { active: false } } },
      b: { op: { create: {}, archive: {} } },
      c: { active: false, op: { update: {} } },
    }), ['list', 'create', 'remove'])
  })

  test('names nothing when nothing is active', () => {
    deepStrictEqual(ops({}), [])
    deepStrictEqual(ops({ a: { active: false, op: { create: {} } } }), [])
    deepStrictEqual(ops({ a: { op: {} } }), [])
  })
})


describe('the generated introductions', () => {

  let cwd = ''
  before(() => {
    cwd = process.cwd()
    process.chdir(SCAFFOLD)
  })
  after(() => {
    if ('' !== cwd) process.chdir(cwd)
  })

  const cmpdir = Path.join(SCAFFOLD, 'src', 'cmp')
  const intros = (): string[] => Fs.readdirSync(cmpdir)
    .filter((t: string) => Fs.existsSync(Path.join(cmpdir, t, 'ReadmeIntro_' + t + '.ts'))).sort()

  async function readmes(model: any): Promise<Record<string, string>> {
    const { fs, vol } = memfs({})
    await SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
      .generate({ model, root: makeRoot() })
    const out: any = vol.toJSON()
    return Object.fromEntries(intros().map((t: string) => [t, out[Path.join(STAGE, t, 'README.md')]]))
  }

  test('call the Entities capitalised only beside an accessor that is', async () => {
    const targets = intros()
    const model = makeModel(targets)
    const pascal = Object.values(entityCollection(model)).map((e: any) => e.Name)

    const out = await readmes(model)

    const named: string[] = []
    for (const target of targets) {
      const readme: string = out[target]
      const para = readme.split(/\n\n/).find((p: string) => p.includes('semantic **Entities**'))
      strictEqual(null != para, true, target + ': no Entities paragraph')
      const span = (/`([^`]+)`/.exec(para!) || [])[1] || ''
      if (/capitalised/i.test(para!)) {
        strictEqual(pascal.some((name: string) => new RegExp('\\b' + name + '\\b').test(span)), true,
          target + ': capitalised Entities beside ' + span)
        named.push(target)
      }
    }
    strictEqual(0 < named.length, true, 'no introduction calls its Entities capitalised')
  })

  test('name no accessor and no operations without an active entity', async () => {
    const entities = Object.keys(makeModel([]).main.kit.entity)
    const out = await readmes(makeModel(intros(), undefined,
      entities.map((e: string) => `main: kit: entity: ${e}: active: false`).join('\n')))
    for (const [target, readme] of Object.entries(out)) {
      strictEqual(readme.includes('**Entities**'), false, target + ': an accessor with no entity')
    }
  })

  test('list no operations for an entity that has none', async () => {
    const entities = Object.keys(makeModel([]).main.kit.entity)
    const out = await readmes(makeModel(intros(), undefined,
      entities.filter((e: string) => 'ambient' !== e)
        .map((e: string) => `main: kit: entity: ${e}: active: false`).join('\n') +
      '\nmain: kit: entity: ambient: op: load: active: false'))
    for (const [target, readme] of Object.entries(out)) {
      const para = readme.split(/\n\n/).find((p: string) => p.includes('**Entities**'))
      strictEqual(null != para && /mbient/.test(para), true, target + ': no accessor for the entity')
      strictEqual(/operations\s*\(`*\)/.test(para!), false, target + ': an empty operation list: ' + para)
    }
  })
})
