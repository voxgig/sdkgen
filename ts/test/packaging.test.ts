// WHAT THE REGISTRY ACTUALLY RECEIVES.
//
// The repo and the published package are not the same set of files, and the
// gap is invisible from inside a checkout: every test in this suite, every
// local `add-target`, and every manual smoke run reads the working tree, so a
// file that npm silently drops is present for all of them and absent for
// every real consumer.
//
// That is not hypothetical. `project/.sdk/tm/seneca-provider/.gitignore` was
// shipped as a template for as long as the target existed and reached nobody
// who installed from npm: `.gitignore` is on npm's OWN always-excluded list,
// which naming the parent directory in `files` does not override. Generated
// provider repos came out with no ignore file, so the first regeneration
// buried them in the `.jostraca/` output duplicate that file exists to hide.
// The 23 language targets were unaffected only because they emit theirs from
// a component.
//
// NPM IS ASKED, NOT RESTATED
//
// The obvious cheap version of this test is a list of names npm is known to
// strip. That would be npm's rules written down a second time, in a repo
// whose recurring defect is exactly that (AGENTS.md, "Sharp edges"), and it
// would go stale the day npm adds an exclusion. So this runs `npm pack
// --dry-run --json` and believes the answer.
//
// COST: the pack takes a few seconds — it walks ~2,900 files. It runs once.

import { test, describe } from 'node:test'
import { ok, equal, deepStrictEqual } from 'node:assert'

import { spawnSync } from 'node:child_process'
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

  return new Set<string>(
    JSON.parse(res.stdout)[0].files.map((f: any) => f.path))
}


// Everything COMMITTED under the directories package.json ships.
//
// Tracked rather than "what is on disk": the working tree also holds
// dist-test/, node_modules/ and whatever a developer left lying around, and
// npm is right to drop those.
//
// The `files` entries are read from package.json rather than listed here, so
// a newly shipped directory is covered without anyone remembering to.
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
    // The rule above states the SYMPTOM. This states the CAUSE, and fails one
    // step earlier — at the moment a dotfile is added to the scaffold, rather
    // than when someone notices consumers are missing it.
    //
    // Deliberately narrow: only `.gitignore` and `.npmignore` are checked,
    // because those are the two npm always strips AND the two anybody would
    // reasonably try to ship as a template. A dotfile that packs fine (the
    // scaffold has several) is not this test's business — which is why the
    // check above, the one that asks npm, is the authority.
    const risky = trackedShipped().filter((p: string) =>
      /(^|\/)\.(gitignore|npmignore)$/.test(p))

    deepStrictEqual(risky, [],
      'npm will not publish these names, whatever `files` says — emit the ' +
      'content from a component instead: ' + risky.join(', '))
  })


  // THE `exports` MAP MUST NOT NARROW WHAT CONSUMERS ALREADY IMPORT.
  //
  // A package with no `exports` field lets anything under its root be
  // imported by path. Adding one REPLACES that with an allow-list — and this
  // package's consumers depend on the old freedom in a place no test of ours
  // would notice: every generated model file includes
  // `@voxgig/sdkgen/model/sdkgen.aontu`, and the scaffold is reached as
  // `@voxgig/sdkgen/project/<lang>`. Break those and nothing here fails; every
  // installed SDK fails to compile its model.
  //
  // So the `./*` catch-all in package.json is load-bearing, and this is the
  // test that says so out loud. It resolves through the map exactly as a
  // consumer would rather than reading the field, because the question is
  // what Node does with it, not what it says.
  test('the exports map still admits the deep paths consumers use', () => {
    const admits = (subpath: string): boolean => {
      const target = resolveExports(subpath)
      return null != target
    }

    for (const subpath of [
      '.',
      './testkit',
      './package.json',
      './model/sdkgen.aontu',
      './project/.sdk/model/target/ts.aontu',
      './dist/helpers/manifest.js',
      './bin/voxgig-sdkgen',
    ]) {
      ok(admits(subpath),
        subpath + ' is no longer importable — the `exports` map narrowed. ' +
        'Restore the "./*" entry in package.json.')
    }
  })

})


// The subset of Node's exports resolution this repo needs: an exact key, or
// the `./*` pattern. Deliberately not a general implementation — it answers
// one question (is this subpath admitted at all?) and would be misleading if
// it looked like it answered more.
function resolveExports(subpath: string): string | undefined {
  const exports: any = (Pkg as any).exports
  if (null == exports) return subpath

  const entry = exports[subpath]
  if (null != entry) {
    return 'string' === typeof entry ? entry : (entry.default ?? entry.types)
  }

  const star = exports['./*']
  if (null != star && subpath.startsWith('./')) {
    return String(star).replace('*', subpath.slice(2))
  }

  return undefined
}
