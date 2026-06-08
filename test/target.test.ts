
import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual, throws } from 'node:assert'

import { resolveTarget } from '../dist/action/target.js'


// resolveTarget only touches the fs via existsSync, so a fake fs whose
// existsSync consults a known set lets us exercise every search branch
// without real directories.
function makeCtx(existing: string[], root = '/root') {
  const set = new Set(existing)
  return {
    folder: root,
    fs: () => ({ existsSync: (p: string) => set.has(p) }),
  }
}

const SDKGEN_SDK = '/root/node_modules/@voxgig/sdkgen/project/.sdk'


describe('resolveTarget', () => {

  test('plain target resolves to the bundled sdkgen project', () => {
    const out = resolveTarget('go', makeCtx([SDKGEN_SDK]))
    deepStrictEqual(out, {
      tname: 'go',
      tfolder: SDKGEN_SDK,
      torigname: 'go',
      base: 'node_modules/@voxgig/sdkgen/project/.sdk',
    })
  })

  test('alias (~) renames the target but keeps the original folder name', () => {
    const out = resolveTarget('go~mygo', makeCtx([SDKGEN_SDK]))
    strictEqual(out.tname, 'mygo')
    strictEqual(out.torigname, 'go')
    strictEqual(out.tfolder, SDKGEN_SDK)
  })

  test('scoped path ref resolves under node_modules first', () => {
    const folder = '/root/node_modules/acme/widgets/.sdk'
    const out = resolveTarget('acme/widgets/go', makeCtx([folder]))
    strictEqual(out.tname, 'go')
    strictEqual(out.torigname, 'go')
    strictEqual(out.tfolder, folder)
    strictEqual(out.base, 'node_modules/acme/widgets/.sdk')
  })

  test('scoped path ref falls back to a sibling project dir', () => {
    const folder = '/root/acme/widgets/.sdk'
    // node_modules variant intentionally absent → fallback path is used.
    const out = resolveTarget('acme/widgets/go', makeCtx([folder]))
    strictEqual(out.tfolder, folder)
    strictEqual(out.base, 'acme/widgets/.sdk')
  })

  test('absolute path ref is used verbatim', () => {
    const folder = '/abs/widgets/.sdk'
    const out = resolveTarget('/abs/widgets/go', makeCtx([folder]))
    strictEqual(out.tname, 'go')
    strictEqual(out.tfolder, folder)
    // No /root/ prefix to strip, so base stays absolute.
    strictEqual(out.base, '/abs/widgets/.sdk')
  })

  test('alias combined with a scoped path', () => {
    const folder = '/root/node_modules/acme/widgets/.sdk'
    const out = resolveTarget('acme/widgets/go~mygo', makeCtx([folder]))
    strictEqual(out.tname, 'mygo')
    strictEqual(out.torigname, 'go')
    strictEqual(out.tfolder, folder)
  })

  test('throws with the searched locations when nothing is found', () => {
    throws(() => resolveTarget('go', makeCtx([])), /Target folder not found/)
  })
})
