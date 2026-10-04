import { test, describe } from 'node:test'
import { deepStrictEqual, ok } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'


const CMP = Path.resolve(__dirname, '..', 'project', '.sdk', 'src', 'cmp')


// A fragment no component of its language names is never generated, and is
// copied into every project as source nobody reads. Operation fragments are
// named by a built string, `'Entity' + camelify(op) + 'Op.fragment'`.
function unnamedFragments(): string[] {
  const found: string[] = []

  for (const lang of Fs.readdirSync(CMP).sort()) {
    const folder = Path.join(CMP, lang, 'fragment')
    if (!Fs.existsSync(folder)) {
      continue
    }

    const source = Fs.readdirSync(Path.join(CMP, lang))
      .filter((file: string) => file.endsWith('.ts'))
      .map((file: string) => Fs.readFileSync(Path.join(CMP, lang, file), 'utf8'))
      .join('\n')

    for (const file of Fs.readdirSync(folder).sort()) {
      const stem = file.replace(/\.fragment\..*$/, '')
      const named = /^Entity\w+Op$/.test(stem) ?
        source.includes('Op.fragment') : source.includes(stem + '.fragment')
      if (!named) {
        found.push(lang + '/fragment/' + file)
      }
    }
  }

  return found
}


describe('scaffold fragments', () => {

  test('every fragment is named by a component of its language', () => {
    ok(Fs.existsSync(CMP), 'no scaffold components at ' + CMP)
    deepStrictEqual(unnamedFragments(), [])
  })
})
