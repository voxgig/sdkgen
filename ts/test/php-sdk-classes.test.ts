import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'

import { isPhpReservedType, isPhpSdkClass } from '../dist/sdkgen.js'


// PHP_SDK_CLASSES (helpers/naming.ts) must list every UNNAMESPACED class the
// php target declares, because the generated PHP SDK uses no namespaces and
// composer classmaps both the runtime (`types/`) and the tests (`test/`, via
// autoload-dev). One class name mapped to two files fatals on redeclaration.
//
// This is the SECOND half of "already taken". `PHP_RESERVED_TYPES` covers what
// the LANGUAGE owns; this covers what OUR OWN generated scaffolding claims,
// which is the half a keyword list can never catch.
//
// The rb equivalent (rb-sdk-constants.test.ts) exists for the reported
// gitlab-sdk collision, where an entity named `Runner` silently replaced the
// test harness. Ruby warns and carries on; PHP is fatal, so the same hazard is
// strictly worse here.
//
// A hand-maintained list silently rots — the swift equivalent proved that,
// missing three names on its first cut, one declared by a component rather
// than a template. So this re-derives from both sources and fails on drift.

const SCAFFOLD = Path.join(__dirname, '..', 'project', '.sdk')
const TM_PHP = Path.join(SCAFFOLD, 'tm', 'php')
const CMP_PHP = Path.join(SCAFFOLD, 'src', 'cmp', 'php')


// A PHP type declaration: `class Foo`, and the three that share the same
// namespace as classes do (`interface`, `trait`, `enum`).
const DECL =
  /^(?:abstract +|final +)?(?:class|interface|trait|enum) +([A-Za-z_][A-Za-z0-9_]*)/gm

// A file that declares a namespace puts everything in it out of reach of the
// global name an entity type takes. This is php's equivalent of the rb guard's
// column-0 rule.
const NAMESPACED = /^namespace\s+[A-Za-z_\\]/m

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


function declaredClasses(): Set<string> {
  const found = new Set<string>()

  const collect = (src: string) => {
    if (NAMESPACED.test(src)) return
    for (const m of src.matchAll(DECL)) {
      if (!PLACEHOLDER.test(m[1])) found.add(m[1])
    }
  }

  // Templates: real PHP, so the match is exact.
  for (const f of walk(TM_PHP).filter((f) => f.endsWith('.php'))) {
    collect(Fs.readFileSync(f, 'utf8'))
  }

  // Components: PHP embedded in TS template literals. A `class ${...}` is the
  // generated entity type itself — the thing being renamed — and does not
  // match, because the pattern requires a literal name.
  for (const f of Fs.readdirSync(CMP_PHP).filter((f) => f.endsWith('.ts'))) {
    collect(Fs.readFileSync(Path.join(CMP_PHP, f), 'utf8'))
  }

  return found
}


describe('php SDK class guard', () => {

  test('every class the php target declares is in the collision guard', () => {
    const declared = Array.from(declaredClasses()).sort()

    // Cannot pass vacuously: an empty derivation would assert nothing.
    deepStrictEqual(10 < declared.length, true,
      'only ' + declared.length + ' unnamespaced classes found in the php ' +
      'target — the derivation is broken, not the guard')

    const unguarded = declared.filter(
      (n) => !isPhpSdkClass(n) && !isPhpReservedType(n))

    deepStrictEqual(unguarded, [],
      'These classes are declared with no namespace by the php target but ' +
      'are missing from PHP_SDK_CLASSES in helpers/naming.ts. An API entity ' +
      'of the same name emits a second class with that name, and composer ' +
      'classmaps both — a fatal redeclaration. Add them.')
  })


  test('the guard folds case, as PHP resolves class names', () => {
    // `FeatureTest` and `featuretest` are ONE identifier to PHP, and the
    // generated name is PascalCase. A case-sensitive lookup would match
    // nothing and reopen the bug silently — the same trap
    // PHP_RESERVED_TYPES documents.
    deepStrictEqual(
      ['FeatureTest', 'featuretest', 'FEATURETEST'].filter(
        (n) => !isPhpSdkClass(n)),
      [])
  })


  test('it does not claim names that are merely prefixed or namespaced', () => {
    // `ProjectNameUtility` -> `<Sdk>Utility`, which no bare entity type can
    // equal; `Struct` and `Runner` are declared inside a namespace. Guarding
    // any of them would rename entities that never collided.
    deepStrictEqual(
      ['Utility', 'Context', 'Response', 'Result', 'Operation', 'Spec',
        'Struct', 'Runner', 'ListRef', 'Injection']
        .filter((n) => isPhpSdkClass(n)),
      [])
  })
})
