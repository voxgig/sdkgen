import { test, describe } from 'node:test'
import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import Fs from 'node:fs'
import Path from 'node:path'

import { sourceString } from '../dist/sdkgen.js'
import { DOLLAR } from '../dist/helpers/sourcestring.js'


// The SDK targets: each prints its configuration from a Config component.
const CMP = Path.join(__dirname, '..', 'project', '.sdk', 'src', 'cmp')
const SDKS = Fs.readdirSync(CMP).filter((t: string) => Fs.existsSync(Path.join(CMP, t, `Config_${t}.ts`))).sort()


describe('sourceString', () => {

  test('every bundled SDK language has an escape, and JSON has one', () => {
    strictEqual(SDKS.length, 20)
    deepStrictEqual(SDKS.filter((t: string) => null == DOLLAR[t]), [])
    ok(null != DOLLAR.json)
  })

  test('no dollar sign survives, and JSON and JavaScript read the text back', () => {
    const text = 'cost $$name$$ and $1 and $'
    for (const lang of Object.keys(DOLLAR)) {
      ok(!sourceString(lang, text).includes('$'), lang)
    }
    strictEqual(JSON.parse('"' + sourceString('json', text) + '"'), text)
    strictEqual(new Function('return "' + sourceString('js', text) + '"')(), text)
  })

  test("C's escape stops before a following hex digit", () => {
    strictEqual(sourceString('c', '$a1'), '\\044a1')
  })

  test('a language it does not know is refused', () => {
    throws(() => sourceString('cobol', '$'), /no string escape for the language 'cobol'/)
  })
})
