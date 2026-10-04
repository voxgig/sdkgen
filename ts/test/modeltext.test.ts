import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { modelText } from '../dist/helpers/text.js'


const ROOT = Path.resolve(__dirname, '..')

const SLOTS = ['title', 'summary', 'website', 'tagline', 'about_md', 'homepage',
  'docs_url', 'meta_source', 'entity_desc']


function model(info: any, text?: any): any {
  return { main: { kit: { info, ...(undefined === text ? {} : { text }) } } }
}


function sources(dir: string): string[] {
  return Fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? sources(Path.join(dir, d.name)) :
      d.name.endsWith('.ts') ? [Path.join(dir, d.name)] : [])
}


describe('modelText', () => {

  test('a text slot words over info, and an empty one falls through', () => {
    const got = modelText(model(
      { title: 'Spec', tagline: 'Spec tagline.', servers: [{ url: 'https://x' }] },
      { title: 'Worded', tagline: '' }))
    strictEqual(got.title, 'Worded')
    strictEqual(got.tagline, 'Spec tagline.')
    deepStrictEqual(got.servers, [{ url: 'https://x' }])
  })

  test('entity descriptions merge entity by entity', () => {
    const got = modelText(model(
      { entity_desc: { planet: 'Spec planet.', moon: 'Spec moon.' } },
      { entity_desc: { planet: 'Worded planet.', moon: '' } }))
    deepStrictEqual(got.entity_desc, { planet: 'Worded planet.', moon: 'Spec moon.' })
  })

  test('without a text branch, info reads as before', () => {
    deepStrictEqual(modelText(model({ title: 'Spec' })), { title: 'Spec', entity_desc: {} })
    deepStrictEqual(modelText({}), { entity_desc: {} })
  })

  test('every component that reads a prose slot reads it through modelText', () => {
    const slot = new RegExp(`\\binfo\\??\\.(${SLOTS.join('|')})\\b`)
    const offenders = [
      ...sources(Path.join(ROOT, 'src', 'cmp')),
      ...sources(Path.join(ROOT, 'src', 'helpers')),
      ...sources(Path.join(ROOT, 'project', '.sdk', 'src', 'cmp')),
    ].filter((file) => {
      const src = Fs.readFileSync(file, 'utf8')
      return slot.test(src) && !src.includes('modelText(')
    }).map((file) => Path.relative(ROOT, file))
    deepStrictEqual(offenders, [])
  })
})
