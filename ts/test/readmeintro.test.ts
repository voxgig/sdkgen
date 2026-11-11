import { test, describe, before, after } from 'node:test'
import { strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { Jostraca, Project, Folder, File } from 'jostraca'
import { memfs } from 'memfs'

import { ReadmeIntro, introOps } from '../dist/sdkgen.js'


const model = {
  name: 'demo', Name: 'Demo',
  main: { kit: {
    info: { tagline: 'Tagged.' },
    target: { body: {}, whole: {}, 'go-cli': {} },
    entity: {},
  } },
}


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
    write('whole', 'module.exports = { ReadmeIntro: () => Content("# Whole, as written.\\n\\n") }')
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
        ReadmeIntro({ target: { name, title: name[0].toUpperCase() + name.slice(1) } })
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
    strictEqual(await render('whole'), '# Whole, as written.\n\n')
  })
})


describe('introOps', () => {
  const ops = (entity: any) => introOps({ main: { kit: { entity } } })

  test('names the active ops of the active entities, canonical first', () => {
    deepStrictEqual(ops({
      a: { op: { remove: {}, search: {}, list: {}, load: { active: false } } },
      b: { op: { create: {}, archive: {} } },
      c: { active: false, op: { update: {} } },
    }), ['list', 'create', 'remove', 'search', 'archive'])
  })

  test('names list and load when nothing is active', () => {
    deepStrictEqual(ops({}), ['list', 'load'])
    deepStrictEqual(ops({ a: { active: false, op: { create: {} } } }), ['list', 'load'])
  })
})
