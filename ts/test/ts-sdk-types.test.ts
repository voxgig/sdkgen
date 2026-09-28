
import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'

import { isTsSdkType, isTsReservedType, tsSafeTypeName } from '../dist/sdkgen.js'



const ENTITY_FRAGMENT = Path.join(
  __dirname, '..', 'project', '.sdk', 'src', 'cmp', 'ts', 'fragment', 'Entity.fragment.ts')

// Substituted by Entity_ts, so the generated file never declares them.
const PLACEHOLDERS = new Set(['EntyClass'])

const IMPORT = /^import\s+(type\s+)?([^'"]*?)\s+from\s+'([^']+)'/gms
const DECL =
  /^(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type|enum|const|let|var|function)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm


// Every name the generated entity file binds at module scope, other than
// the ones carrying the project's own prefix, which an entity cannot take.
function boundNames(): string[] {
  const src = Fs.readFileSync(ENTITY_FRAGMENT, 'utf8')
  const found = new Set<string>()

  for (const m of src.matchAll(IMPORT)) {
    if (m[3].includes('ProjectName')) continue
    const clause = m[2].trim()
    const named = clause.match(/\{([^}]*)\}/)
    if (named) {
      for (const part of named[1].split(',')) {
        const local = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()
        if (local) found.add(local.trim())
      }
    }
    const bare = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim()
    const ns = bare.match(/\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)/)
    if (ns) found.add(ns[1])
    else if (bare) found.add(bare)
  }

  for (const m of src.matchAll(DECL)) {
    if (!PLACEHOLDERS.has(m[1])) found.add(m[1])
  }

  // An entity data type is PascalCase, so only a PascalCase name can meet it.
  return Array.from(found).filter((n) => /^[A-Z]/.test(n)).sort()
}


describe('ts SDK type guard', () => {

  test('every name the ts entity file binds is in the collision guard', () => {
    const bound = boundNames()
    deepStrictEqual(
      bound.filter((n) => !isTsSdkType(n) && !isTsReservedType(n)),
      [],
      'The ts entity file binds these names beside the entity data type, but ' +
      'TS_SDK_TYPES in helpers/naming.ts does not list them. An API entity of ' +
      'the same name fails the ts build with "Duplicate identifier". Add them.',
    )
  })

  test('the scan sees the imports that caused the collision', () => {
    // Neon's `operation` and Novu's `context` entities.
    deepStrictEqual(
      ['Context', 'Control', 'Operation'].filter((n) => !boundNames().includes(n)),
      [],
    )
  })

  test('a colliding entity data type is renamed, any other is not', () => {
    strictEqual(tsSafeTypeName('Operation'), 'OperationType')
    strictEqual(tsSafeTypeName('Context'), 'ContextType')
    strictEqual(tsSafeTypeName('Control'), 'ControlType')
    strictEqual(tsSafeTypeName('Record'), 'RecordType')
    strictEqual(tsSafeTypeName('Branch'), 'Branch')
  })
})
