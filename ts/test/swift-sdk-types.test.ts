
import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'

import { isSwiftSdkType } from '../dist/sdkgen.js'



const SCAFFOLD = Path.join(__dirname, '..', 'project', '.sdk')
const TM_SWIFT = Path.join(SCAFFOLD, 'tm', 'swift', 'Sources')
const CMP_SWIFT = Path.join(SCAFFOLD, 'src', 'cmp', 'swift')

const DECL =
  /^(?:public |open |internal |fileprivate |private |final |indirect )*(?:class|struct|enum|actor|protocol|typealias) ([A-Za-z_][A-Za-z0-9_]*)(?=[^\n/]*[{=])/gm

// Declared in the separate Tests module, which does not share the SDK
// module's namespace, so these cannot collide.
const TEST_MODULE_ONLY = new Set(['ReadmeExamplesTest'])

const SEPARATE_MODULE_DIRS = [Path.join('feature', 'secrets') + Path.sep]

function walk(dir: string, out: string[] = []): string[] {
  if (!Fs.existsSync(dir)) return out
  for (const e of Fs.readdirSync(dir, { withFileTypes: true })) {
    const p = Path.join(dir, e.name)
    if (e.isDirectory()) {
      const rel = Path.relative(TM_SWIFT, p) + Path.sep
      if (SEPARATE_MODULE_DIRS.some((d) => rel.endsWith(Path.sep + d) || rel === d)) {
        continue
      }
      walk(p, out)
    }
    else out.push(p)
  }
  return out
}

function declaredTypes(): Set<string> {
  const found = new Set<string>()

  // Templates: real Swift, so the regex is exact.
  for (const f of walk(TM_SWIFT).filter((f) => f.endsWith('.swift'))) {
    const src = Fs.readFileSync(f, 'utf8')
    for (const m of src.matchAll(DECL)) found.add(m[1])
  }

  // Components: Swift embedded in TS template literals. Only take
  // declarations with a literal name — `public struct ${typeName}` is the
  // generated entity type itself, which is what the guard renames.
  for (const f of Fs.readdirSync(CMP_SWIFT).filter((f) => f.endsWith('.ts'))) {
    const src = Fs.readFileSync(Path.join(CMP_SWIFT, f), 'utf8')
    for (const m of src.matchAll(DECL)) found.add(m[1])
  }

  for (const n of TEST_MODULE_ONLY) found.delete(n)
  return found
}


describe('swift SDK type guard', () => {

  test('every type the swift target declares is in the collision guard', () => {
    const declared = Array.from(declaredTypes()).sort()
    const unguarded = declared.filter((n) => !isSwiftSdkType(n))

    deepStrictEqual(
      unguarded,
      [],
      'These swift types are declared in the SDK module but missing from ' +
      'SWIFT_SDK_TYPES in helpers/naming.ts. An API entity of the same name ' +
      'will fail the swift build with "invalid redeclaration". Add them.',
    )
  })

  test('the guard covers the known collision names', () => {
    // Spot-check the three that the original public-only scan missed, plus
    // the one that surfaced the bug in the first place (Hook0's Response).
    deepStrictEqual(
      ['Response', 'Value', 'SdkConfig', 'BaseFeature'].filter((n) => !isSwiftSdkType(n)),
      [],
    )
  })
})
