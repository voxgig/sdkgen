
import { test, describe } from 'node:test'
import { strictEqual, throws } from 'node:assert'

import Path from 'node:path'

import { resolveTarget } from '../dist/action/target.js'


const ROOT = '.'
const posix = (p: string) => p.replace(/\\/g, '/')

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


describe('resolveTarget with a tilde in the path', () => {

  test('a tilde in a directory name is part of the path', () => {
    const folder = 'pkgs/RUNNER~1/widgets/.sdk'
    const out = resolveTarget('pkgs/RUNNER~1/widgets/go', makeCtx([folder]))

    strictEqual(out.tname, 'go')
    strictEqual(out.torigname, 'go')
    strictEqual(posix(out.tfolder), folder)
  })


  test('an alias still works when the path also has a tilde', () => {
    const folder = 'pkgs/RUNNER~1/widgets/.sdk'
    const out = resolveTarget('pkgs/RUNNER~1/widgets/go~go2', makeCtx([folder]))

    strictEqual(out.tname, 'go2', 'the alias was lost')
    strictEqual(out.torigname, 'go', 'the origin name was lost')
    strictEqual(posix(out.tfolder), folder)
  })


  test('an absolute path with a tilde resolves', () => {
    const folder = '/tmp/RUNNER~1/pkg/.sdk'
    const out = resolveTarget('/tmp/RUNNER~1/pkg/go', makeCtx([folder]))

    strictEqual(out.tname, 'go')
    strictEqual(posix(out.tfolder), folder)
  })
})
