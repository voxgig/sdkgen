
import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import Path from 'node:path'
import Fs from 'node:fs'

import { isSwiftSdkType } from '../dist/sdkgen.js'


// SWIFT_SDK_TYPES (helpers/naming.ts) must list every type the swift target
// declares in the SDK module, because Swift has no intra-module namespacing:
// a generated entity type sharing a name with one of ours is an
// `invalid redeclaration` build failure, not a shadowing.
//
// A hand-maintained list silently rots. It already did once: the first cut of
// the guard was collected with a `^public ...` grep, which missed
// `open class BaseFeature`, `public indirect enum Value`, and `SdkConfig`
// (declared by a component rather than a template) — so three names stayed
// exposed to exactly the bug the guard exists to prevent.
//
// This test re-derives the list from the sources of truth and fails on drift,
// so adding a type to a swift template cannot silently reopen it.

const SCAFFOLD = Path.join(__dirname, '..', 'project', '.sdk')
const TM_SWIFT = Path.join(SCAFFOLD, 'tm', 'swift', 'Sources')
const CMP_SWIFT = Path.join(SCAFFOLD, 'src', 'cmp', 'swift')

// Any top-level type declaration, at ANY access level. `internal` is Swift's
// default and is still module-wide, and `open` is not `public` — filtering on
// `public` is what caused the original miss.
//
// The trailing `(?=...)` is load-bearing: component files embed Swift inside
// TS template literals alongside README prose, and lines like
// "struct library is inlined under `Struct/`" would otherwise read as
// declarations. A real declaration continues into a body (`{`) or, for a
// typealias, an assignment (`=`), so require one of those on the same line.
const DECL =
  /^(?:public |open |internal |fileprivate |private |final |indirect )*(?:class|struct|enum|actor|protocol|typealias) ([A-Za-z_][A-Za-z0-9_]*)(?=[^\n/]*[{=])/gm

// Declared in the separate Tests module, which does not share the SDK
// module's namespace, so these cannot collide.
const TEST_MODULE_ONLY = new Set(['ReadmeExamplesTest'])

function walk(dir: string, out: string[] = []): string[] {
  if (!Fs.existsSync(dir)) return out
  for (const e of Fs.readdirSync(dir, { withFileTypes: true })) {
    const p = Path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
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
