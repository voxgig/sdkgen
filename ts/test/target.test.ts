
import { test, describe } from 'node:test'
import { strictEqual, throws } from 'node:assert'

import Path from 'node:path'

import { resolveTarget } from '../dist/action/target.js'


// resolveTarget builds paths with node:path, so separators differ by OS
// (forward slash on POSIX, backslash on Windows). Keep the test portable
// by normalising paths on both sides: the fake fs normalises what it
// stores and what it is queried with, and assertions compare in a
// separator-insensitive form. Root is '.' to mirror production, where
// resolveActionContext sets folder: '.'.
const ROOT = '.'
const posix = (p: string) => p.replace(/\\/g, '/')

// resolveTarget only touches the fs via existsSync, so a fake fs whose
// existsSync consults a known set lets us exercise every search branch
// without real directories.
function makeCtx(existing: string[]) {
  const set = new Set(existing.map((p) => Path.normalize(p)))
  return {
    folder: ROOT,
    fs: () => ({ existsSync: (p: string) => set.has(Path.normalize(p)) }),
  }
}

const SDKGEN_SDK = 'node_modules/@voxgig/sdkgen/project/.sdk'


describe('resolveTarget', () => {

  test('plain target resolves to the bundled sdkgen project', () => {
    const out = resolveTarget('go', makeCtx([SDKGEN_SDK]))
    strictEqual(out.tname, 'go')
    strictEqual(out.torigname, 'go')
    strictEqual(posix(out.tfolder), SDKGEN_SDK)
    strictEqual(posix(out.base), SDKGEN_SDK)
  })

  test('alias (~) renames the target but keeps the original folder name', () => {
    const out = resolveTarget('go~mygo', makeCtx([SDKGEN_SDK]))
    strictEqual(out.tname, 'mygo')
    strictEqual(out.torigname, 'go')
    strictEqual(posix(out.tfolder), SDKGEN_SDK)
  })

  test('scoped path ref resolves under node_modules first', () => {
    const folder = 'node_modules/acme/widgets/.sdk'
    const out = resolveTarget('acme/widgets/go', makeCtx([folder]))
    strictEqual(out.tname, 'go')
    strictEqual(out.torigname, 'go')
    strictEqual(posix(out.tfolder), folder)
    strictEqual(posix(out.base), folder)
  })

  test('scoped path ref falls back to a sibling project dir', () => {
    const folder = 'acme/widgets/.sdk'
    // node_modules variant intentionally absent → fallback path is used.
    const out = resolveTarget('acme/widgets/go', makeCtx([folder]))
    strictEqual(posix(out.tfolder), folder)
    strictEqual(posix(out.base), folder)
  })

  test('absolute path ref is used verbatim', () => {
    const folder = '/abs/widgets/.sdk'
    const out = resolveTarget('/abs/widgets/go', makeCtx([folder]))
    strictEqual(out.tname, 'go')
    strictEqual(posix(out.tfolder), folder)
    // Absolute ref is outside the root, so base keeps the absolute path.
    strictEqual(posix(out.base), folder)
  })

  test('alias combined with a scoped path', () => {
    const folder = 'node_modules/acme/widgets/.sdk'
    const out = resolveTarget('acme/widgets/go~mygo', makeCtx([folder]))
    strictEqual(out.tname, 'mygo')
    strictEqual(out.torigname, 'go')
    strictEqual(posix(out.tfolder), folder)
  })

  test('throws with the searched locations when nothing is found', () => {
    throws(() => resolveTarget('go', makeCtx([])), /Target folder not found/)
  })
})
