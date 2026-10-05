import { test, describe } from 'node:test'
import { deepStrictEqual, ok } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { camelify } from '../dist/sdkgen.js'
import { CANON_OP_ORDER } from '../dist/helpers/opShape.js'


const CMP = Path.resolve(__dirname, '..', 'project', '.sdk', 'src', 'cmp')

const OP_STEMS = CANON_OP_ORDER.map((op: string) => 'Entity' + camelify(op) + 'Op')
const OP_BUILDER = /'\/?Entity'\s*\+\s*camelify\(\w+\)\s*\+\s*'Op\.fragment/


// A fragment no component of its language names is never generated, and is
// copied into every project as source nobody reads. Operation fragments are
// named by a built string, and only for the ops in `CANON_OP_ORDER`.
function unnamedFragments(cmp: string = CMP): string[] {
  const found: string[] = []

  for (const lang of Fs.readdirSync(cmp).sort()) {
    const folder = Path.join(cmp, lang, 'fragment')
    if (!Fs.existsSync(folder)) {
      continue
    }

    const source = Fs.readdirSync(Path.join(cmp, lang))
      .filter((file: string) => file.endsWith('.ts'))
      .map((file: string) => Fs.readFileSync(Path.join(cmp, lang, file), 'utf8'))
      .join('\n')
    const literal = new Set([...source.matchAll(/([A-Za-z][\w.]*)\.fragment\b/g)]
      .map((m) => m[1]))
    const built = OP_BUILDER.test(source)

    for (const file of Fs.readdirSync(folder).sort()) {
      const stem = file.replace(/\.fragment\..*$/, '')
      if (!literal.has(stem) && !(built && OP_STEMS.includes(stem))) {
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


  test('a planted fragment no component names is reported', () => {
    const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-fragments-'))
    const plant = (lang: string, file: string) => {
      Fs.cpSync(Path.join(CMP, lang), Path.join(tmp, lang), { recursive: true })
      Fs.writeFileSync(Path.join(tmp, lang, 'fragment', file), '')
    }

    try {
      plant('go', 'EntityPatchOp.fragment.go')
      plant('ocaml', 'EntityLoadOp.fragment.ml')
      plant('ts', 'Error.fragment.ts')

      deepStrictEqual(unnamedFragments(tmp), [
        'go/fragment/EntityPatchOp.fragment.go',
        'ocaml/fragment/EntityLoadOp.fragment.ml',
        'ts/fragment/Error.fragment.ts',
      ])
    }
    finally {
      Fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
})
