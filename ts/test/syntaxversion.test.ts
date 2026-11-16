import { test, describe } from 'node:test'
import { ok, throws, doesNotThrow } from 'node:assert'
import Fs from 'node:fs'
import Path from 'node:path'

import { SYNTAX_INTERFACE, checkSyntaxInterface } from '../dist/helpers/syntaxversion.js'


describe('the syntax provider interface version', () => {

  test('a provider on the current interface passes', () => {
    doesNotThrow(() => checkSyntaxInterface('ts', SYNTAX_INTERFACE))
  })

  test('a provider that declares none is refused with every change listed', () => {
    throws(() => checkSyntaxInterface('lua32', undefined), (err: any) =>
      /lua32: the syntax provider \.sdk\/src\/cmp\/lua32\/Syntax_lua32\.ts/.test(err.message) &&
      /declares none/.test(err.message) && /testMock/.test(err.message) &&
      /streamSignal/.test(err.message) && /Member\.copy/.test(err.message))
  })

  test('an older declared version is refused, naming both versions', () => {
    throws(() => checkSyntaxInterface('ocaml32', '3.2'), (err: any) =>
      err.message.includes('interface 3.2') && err.message.includes('interface ' + SYNTAX_INTERFACE))
  })

  test('every bundled provider declares the current interface', () => {
    const cmp = Path.join(__dirname, '..', 'project', '.sdk', 'src', 'cmp')
    const found = Fs.readdirSync(cmp).filter((t) => Fs.existsSync(Path.join(cmp, t, `Syntax_${t}.ts`)))
    ok(13 <= found.length, String(found.length))
    for (const t of found) {
      const src = Fs.readFileSync(Path.join(cmp, t, `Syntax_${t}.ts`), 'utf8')
      ok(src.includes(`interface: '${SYNTAX_INTERFACE}'`), t)
    }
  })
})
