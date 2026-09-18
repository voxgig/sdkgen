import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'

import { isPhpReservedType, isPhpSdkClass } from '../dist/sdkgen.js'



const SCAFFOLD = Path.join(__dirname, '..', 'project', '.sdk')
const TM_PHP = Path.join(SCAFFOLD, 'tm', 'php')
const CMP_PHP = Path.join(SCAFFOLD, 'src', 'cmp', 'php')


const DECL =
  /^(?:abstract +|final +)?(?:class|interface|trait|enum) +([A-Za-z_][A-Za-z0-9_]*)/gm

const NAMESPACED = /^namespace\s+[A-Za-z_\\]/m

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
    deepStrictEqual(
      ['Utility', 'Context', 'Response', 'Result', 'Operation', 'Spec',
        'Struct', 'Runner', 'ListRef', 'Injection']
        .filter((n) => isPhpSdkClass(n)),
      [])
  })
})
