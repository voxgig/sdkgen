
import { test, describe } from 'node:test'
import { ok, equal, deepStrictEqual } from 'node:assert'

import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import Path from 'node:path'

import Pkg from '../package.json'


const ROOT = Path.resolve(__dirname, '..')


// `npm` is a shell script on POSIX and `npm.cmd` on Windows, so it needs a
// shell to resolve — unlike `git`, and unlike the `process.execPath` calls in
// cli.test.ts, which name a real binary. CI runs windows-latest.
function npmPacked(): Set<string> {
  const res = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: ROOT, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024,
  })

  equal(res.status, 0, 'npm pack failed: ' + res.stderr)

  const packed = JSON.parse(res.stdout)
  const entry = Array.isArray(packed) ? packed[0] : Object.values(packed)[0]

  ok(entry && Array.isArray((entry as any).files),
    'unrecognised `npm pack --dry-run --json` shape from npm ' +
    process.env.npm_config_user_agent + ' — expected an array of package ' +
    'results (npm <= 11) or an object keyed by package name (npm >= 12), ' +
    'each entry carrying `files`. Got: ' + res.stdout.slice(0, 200))

  return new Set<string>((entry as any).files.map((f: any) => f.path))
}


function trackedShipped(): string[] {
  const res = spawnSync('git', ['ls-files', '--', ...Pkg.files], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })

  equal(res.status, 0, 'git ls-files failed: ' + res.stderr)

  return res.stdout.split('\n').filter((p: string) => '' !== p).sort()
}


describe('npm packaging', () => {

  test('every committed file under `files` reaches the tarball', () => {
    const tracked = trackedShipped()

    // Cannot pass vacuously: an empty list would mean the git call silently
    // returned nothing, and the comparison below would then be an assertion
    // about no files at all.
    ok(2000 < tracked.length,
      'only ' + tracked.length + ' tracked files found under ' +
      Pkg.files.join(', ') + ' — the enumeration is broken, not the package')

    const packed = npmPacked()

    const missing = tracked.filter((p: string) => !packed.has(p))

    deepStrictEqual(missing, [],
      'these files are committed and inside package.json `files`, but npm ' +
      'does not publish them — so they exist for this checkout and for ' +
      'nobody who installs @voxgig/sdkgen. npm keeps its own exclusion list ' +
      '(`.gitignore` is on it) that `files` cannot override. Generate the ' +
      'content from a component instead, the way every Gitignore_<lang>.ts ' +
      'does: ' + missing.join(', '))
  })


  test('the scaffold ships no file npm is entitled to drop', () => {
    const risky = trackedShipped().filter((p: string) =>
      /(^|\/)\.(gitignore|npmignore)$/.test(p))

    deepStrictEqual(risky, [],
      'npm will not publish these names, whatever `files` says — emit the ' +
      'content from a component instead: ' + risky.join(', '))
  })


  test('every deep import consumers use still resolves', () => {
    const dir = mkdtempSync(Path.join(tmpdir(), 'sdkgen-resolve-'))

    try {
      const scope = Path.join(dir, 'node_modules', '@voxgig')
      mkdirSync(scope, { recursive: true })
      symlinkSync(ROOT, Path.join(scope, 'sdkgen'), 'junction')

      const subpaths = [
        '@voxgig/sdkgen',
        '@voxgig/sdkgen/testkit',
        '@voxgig/sdkgen/package.json',
        '@voxgig/sdkgen/model/sdkgen.aon',
        '@voxgig/sdkgen/project/.sdk/model/target/ts.aon',
        '@voxgig/sdkgen/bin/voxgig-sdkgen',
        '@voxgig/sdkgen/dist/sdkgen.js',
        '@voxgig/sdkgen/dist/sdkgen',
        '@voxgig/sdkgen/dist/helpers/manifest',
      ]

      const script =
        'const out = [];' +
        'for (const p of ' + JSON.stringify(subpaths) + ') {' +
        '  try { require.resolve(p) } catch (e) { out.push(p) }' +
        '}' +
        'process.stdout.write(JSON.stringify(out))'

      const res = spawnSync(process.execPath, ['-e', script], {
        cwd: dir, encoding: 'utf8',
      })

      equal(res.status, 0, 'resolution probe failed: ' + res.stderr)

      deepStrictEqual(JSON.parse(res.stdout), [],
        'these deep imports no longer resolve. If an `exports` map was ' +
        'added, that is why — see the _no_exports_comment in package.json.')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

})
