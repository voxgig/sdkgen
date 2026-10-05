import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, deepStrictEqual, throws } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { Jostraca, Project, Folder, File } from 'jostraca'
import { memfs } from 'memfs'

import { ReadmeRef } from '../dist/sdkgen.js'
import { OPTIONAL_COMPONENTS, optionalComponent } from '../dist/helpers/optional.js'


const REPO = Path.resolve(__dirname, '..', '..')
const CMP_SRC = Path.join(REPO, 'ts', 'src', 'cmp')
const GUIDE = Path.join(REPO, 'docs', 'how-to', 'author-a-new-language.md')

const NAMES = Object.keys(OPTIONAL_COMPONENTS) as (keyof typeof OPTIONAL_COMPONENTS)[]
const DEFAULTED = NAMES.filter((n) => null == OPTIONAL_COMPONENTS[n])
const SECTIONS = NAMES.filter((n) => null != OPTIONAL_COMPONENTS[n])


function capture(folder: string) {
  const warns: any[] = []
  const debugs: any[] = []
  const log: any = {
    info: () => {}, trace: () => {}, error: () => {}, fatal: () => {},
    warn: (e: any) => warns.push(e),
    debug: (e: any) => debugs.push(e),
  }
  log.child = () => log
  return { ctx$: { folder, log }, log, warns, debugs }
}


describe('optional components', () => {
  let folder: string
  let cmpdir: string

  before(() => {
    folder = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-optional-'))
    cmpdir = Path.join(folder, '.sdk', 'dist', 'cmp', 'zz')
    Fs.mkdirSync(cmpdir, { recursive: true })
    Fs.writeFileSync(Path.join(cmpdir, 'ReadmeQuick_zz.js'),
      'module.exports = { ReadmeQuick: "here" }')
    Fs.writeFileSync(Path.join(cmpdir, 'ReadmeIntro_zz.js'),
      'throw new Error("intro load failure")')
  })

  after(() => {
    Fs.rmSync(folder, { recursive: true, force: true })
  })


  test('a missing section names what is missing and how to add it', () => {
    for (const name of SECTIONS.filter((n) => 'ReadmeQuick' !== n && 'ReadmeIntro' !== n)) {
      const { ctx$, warns, debugs } = capture(folder)
      strictEqual(optionalComponent(ctx$, { name: 'zz' }, name), undefined, name)
      strictEqual(warns.length, 1, name)
      strictEqual(debugs.length, 0, name)

      const w = warns[0]
      strictEqual(w.point, 'optional-component-missing', name)
      strictEqual(w.target, 'zz', name)
      strictEqual(w.component, name, name)
      strictEqual(w.file, '.sdk/src/cmp/zz/' + name + '_zz.ts', name)

      const lacks = (OPTIONAL_COMPONENTS as any)[name]('zz')
      ok(w.note.startsWith('zz: no ' + name + '_zz component, so ' + lacks + '.'), w.note)
      ok(w.note.includes('The SDK code is complete'), w.note)
      ok(w.note.includes('write ' + w.file), w.note)
      ok(w.note.includes('author-a-new-language.md#optional-readme-components'), w.note)
    }
  })


  test('a component with a shared default is not a warning', () => {
    ok(0 < DEFAULTED.length)
    for (const name of DEFAULTED) {
      const { ctx$, warns, debugs } = capture(folder)
      strictEqual(optionalComponent(ctx$, { name: 'zz' }, name), undefined, name)
      deepStrictEqual(warns, [], name)
      strictEqual(debugs.length, 1, name)
      strictEqual(debugs[0].point, 'optional-component-default', name)
    }
  })


  test('a supplied component loads, and one that fails to load throws', () => {
    const { ctx$, warns, debugs } = capture(folder)
    deepStrictEqual(optionalComponent(ctx$, { name: 'zz' }, 'ReadmeQuick'),
      { ReadmeQuick: 'here' })
    throws(() => optionalComponent(ctx$, { name: 'zz' }, 'ReadmeIntro'),
      /intro load failure/)
    deepStrictEqual([...warns, ...debugs], [])
  })


  test('a target with no ReadmeRef is told REFERENCE.md is not written', async () => {
    const { log, warns } = capture(folder)
    const { fs } = memfs({})
    await Jostraca().generate({ fs: () => fs, folder, model: {}, log }, () => {
      Project({ folder: 'p' }, () => Folder({ name: 'zz' }, () =>
        File({ name: 'README.md' }, () => ReadmeRef({ target: { name: 'zz' } }))))
    })

    deepStrictEqual(warns.map((w: any) => w.point), ['optional-component-missing'])
    ok(warns[0].note.includes('zz/REFERENCE.md is not written'), warns[0].note)
  })


  // The table is the one place an optional component's cost is stated, so a
  // neutral component must not load one some other way.
  test('every optional component is loaded through the table', () => {
    const source = Fs.readdirSync(CMP_SRC)
      .filter((f: string) => f.endsWith('.ts'))
      .map((f: string) => [f, Fs.readFileSync(Path.join(CMP_SRC, f), 'utf8')])

    const ignored = source
      .filter(([, text]) => /requirePath\([^)]*ignore:\s*true/.test(text))
      .map(([f]) => f)
    deepStrictEqual(ignored, [])

    const loaded = new Set<string>()
    for (const [, text] of source) {
      for (const m of text.matchAll(/optionalComponent\(ctx\$, \w+, '(\w+)'\)/g)) {
        loaded.add(m[1])
      }
    }
    deepStrictEqual([...loaded].sort(), [...NAMES].sort())
  })


  test('the guide the warning links to lists every optional component', () => {
    const guide = Fs.readFileSync(GUIDE, 'utf8')
    ok(/^### Optional README components$/m.test(guide), 'the linked heading is gone')

    const section = guide.split(/^### Optional README components$/m)[1].split(/^### /m)[0]
    const missing = NAMES.filter((n) => !section.includes('`' + n + '_<lang>`'))
    deepStrictEqual(missing, [])
  })
})
