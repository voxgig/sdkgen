import { test, describe } from 'node:test'
import { ok, throws, doesNotThrow } from 'node:assert'
import Fs from 'node:fs'
import Path from 'node:path'

import {
  SYNTAX_INTERFACE, SYNTAX_PREVIOUS, checkSyntaxInterface, servedInterface, serveSyntax,
} from '../dist/helpers/syntaxversion.js'

const sdkgen = require('../dist/sdkgen.js')


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

  test('the previous interface, declared or not, is served with one warning naming each change', () => {
    const warned: any[] = []
    const log = { warn: (e: any) => warned.push(e) }
    ok(SYNTAX_PREVIOUS === servedInterface('lua32', undefined, log))
    ok(SYNTAX_PREVIOUS === servedInterface('lua32', SYNTAX_PREVIOUS, log))
    ok(SYNTAX_INTERFACE === servedInterface('ts', SYNTAX_INTERFACE, log))
    ok(2 === warned.length && /testMock/.test(warned[0].note) && /Member\.copy/.test(warned[0].note))
    throws(() => servedInterface('old', '3.1', log), /interface 3\.1/)
  })

  test('a served provider is marked once, on a copy, and warns once', () => {
    const warned: any[] = []
    const module = { Syntax: { facts: { result: 'pair' } } }
    const a = serveSyntax('lua32', module, { warn: (e: any) => warned.push(e) })
    const b = serveSyntax('lua32', module, { warn: (e: any) => warned.push(e) })
    ok(a === b && SYNTAX_PREVIOUS === a.Syntax.facts.served && undefined === (module.Syntax.facts as any).served)
    ok(1 === warned.length)
    const now = { Syntax: { interface: SYNTAX_INTERFACE, facts: {} } }
    ok(now === serveSyntax('ts', now))
  })

  test('the constant is not exported, so a provider can only declare a literal', () => {
    ok(undefined === sdkgen.SYNTAX_INTERFACE)
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
