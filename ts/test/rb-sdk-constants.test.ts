import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'

import { isRbCoreConstant, isRbSdkConstant } from '../dist/sdkgen.js'


// RB_SDK_CONSTANTS (helpers/naming.ts) must list every UNPREFIXED top-level
// constant the rb target declares, because Ruby has one constant namespace and
// reassigning a constant is not an error — it silently replaces it, with a
// warning nobody reads.
//
// The reported case: an entity named `Runner` emits `class Runner` in
// `<Sdk>_types.rb`, and `tm/rb/test/runner.rb` then does
// `Runner = ProjectNameTestRunner`. Inside the test process the entity type IS
// the test runner from that point on. `rb` stayed green because nothing in the
// suite touches the type (issue #64).
//
// This is the SECOND half of "already taken". `RB_CORE_CONSTANTS` covers what
// the LANGUAGE owns; this covers what OUR OWN generated scaffolding claims,
// which is the half a language-keyword list can never catch.
//
// A hand-maintained list silently rots — the swift equivalent already proved
// that, missing three names on its first cut, one of them declared by a
// component rather than a template. So this re-derives from both sources and
// fails on drift.

const SCAFFOLD = Path.join(__dirname, '..', 'project', '.sdk')
const TM_RB = Path.join(SCAFFOLD, 'tm', 'rb')
const CMP_RB = Path.join(SCAFFOLD, 'src', 'cmp', 'rb')


// A top-level Ruby declaration: `class Foo`, `module Foo`, or a constant
// assignment `FOO = ...`, all at column 0.
//
// Column 0 is the whole test. An indented `class` is nested inside a module
// and namespaced by it; only a declaration at the left margin lands in the
// global namespace where an entity type could meet it.
const DECL = /^(?:class|module) ([A-Z][A-Za-z0-9_]*)|^([A-Z][A-Za-z0-9_]*) *=/gm


// `ProjectName` substitutes to the SDK's own name, so `ProjectNameUtility`
// becomes `<Sdk>Utility` — which a bare entity type name cannot equal. Only
// the unprefixed declarations are reachable, and listing the prefixed ones
// would bloat the guard with names that can never collide.
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
    // `Runner` is the one that surfaced this (gitlab-sdk), and its two
    // neighbours in the same harness alias block are equally exposed.
    deepStrictEqual(
      ['Runner', 'Helpers', 'Vs'].filter((n) => !isRbSdkConstant(n)),
      [])
  })


  test('it does not claim names that are merely prefixed', () => {
    // `ProjectNameUtility` -> `<Sdk>Utility`, which no bare entity type can
    // equal. Guarding it would rename entities that never collided.
    deepStrictEqual(
      ['Utility', 'Context', 'Response', 'Result', 'Operation', 'Spec']
        .filter((n) => isRbSdkConstant(n)),
      [])
  })
})
