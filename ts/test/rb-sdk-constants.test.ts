import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'

import { isRbCoreConstant, isRbSdkConstant } from '../dist/sdkgen.js'



const SCAFFOLD = Path.join(__dirname, '..', 'project', '.sdk')
const TM_RB = Path.join(SCAFFOLD, 'tm', 'rb')
const CMP_RB = Path.join(SCAFFOLD, 'src', 'cmp', 'rb')


const DECL = /^(?:class|module) ([A-Z][A-Za-z0-9_]*)|^([A-Z][A-Za-z0-9_]*) *=/gm


const PLACEHOLDER = /^ProjectName/


function walk(dir: string, out: string[] = []): string[] {
  if (!Fs.existsSync(dir)) return out
  for (const e of Fs.readdirSync(dir, { withFileTypes: true })) {
    const p = Path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}


function declaredConstants(): Set<string> {
  const found = new Set<string>()

  const collect = (src: string) => {
    for (const m of src.matchAll(DECL)) {
      const name = m[1] ?? m[2]
      if (null != name && !PLACEHOLDER.test(name)) found.add(name)
    }
  }

  // Templates: real Ruby, so the match is exact.
  for (const f of walk(TM_RB).filter((f) => f.endsWith('.rb'))) {
    collect(Fs.readFileSync(f, 'utf8'))
  }

  // Components: Ruby embedded in TS template literals. A `class ${...}` is the
  // generated entity type itself — the thing being renamed — and does not
  // match, because the pattern requires a literal capitalised name.
  for (const f of Fs.readdirSync(CMP_RB).filter((f) => f.endsWith('.ts'))) {
    collect(Fs.readFileSync(Path.join(CMP_RB, f), 'utf8'))
  }

  return found
}


describe('rb SDK constant guard', () => {

  test('every constant the rb target declares is in the collision guard', () => {
    const declared = Array.from(declaredConstants()).sort()

    // Cannot pass vacuously: an empty derivation would assert nothing.
    deepStrictEqual(10 < declared.length, true,
      'only ' + declared.length + ' top-level constants found in the rb ' +
      'target — the derivation is broken, not the guard')

    const unguarded = declared.filter(
      (n) => !isRbSdkConstant(n) && !isRbCoreConstant(n))

    deepStrictEqual(unguarded, [],
      'These constants are declared at the top level by the rb target but ' +
      'are missing from RB_SDK_CONSTANTS in helpers/naming.ts. An API entity ' +
      'of the same name will silently REPLACE them at require time — Ruby ' +
      'warns and carries on. Add them.')
  })


  test('the guard covers the reported collision', () => {
    deepStrictEqual(
      ['Runner', 'Helpers', 'Vs'].filter((n) => !isRbSdkConstant(n)),
      [])
  })


  test('it does not claim names that are merely prefixed', () => {
    deepStrictEqual(
      ['Utility', 'Context', 'Response', 'Result', 'Operation', 'Spec']
        .filter((n) => isRbSdkConstant(n)),
      [])
  })
})
