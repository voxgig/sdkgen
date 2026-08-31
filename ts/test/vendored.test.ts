// The vendored-library guard (migration guide Phase 4.2).
//
// WHY THIS EXISTS, given `doctor` and the golden manifest already exist
//
// `doctor` compares a CONSUMER's copies against sdkgen's templates, so an
// edit made INSIDE the templates is invisible to it: after the next `add`,
// source and project agree again and the drift is gone. The golden
// add-output manifest does hash template content, but it records no
// VERSION — so a file could be resynced to a different upstream release
// with its stamp left behind, and the only thing that changed would be a
// hash nobody can read.
//
// The prototype report names the failure this prevents: the runner,
// StructUtility and the struct corpus test all carried matching `0.0.10`
// stamps and all had to move in step. A stamp that lags is worse than no
// stamp, because it is believed.
//
// So: vendored.json is the single record of what version, from which
// commit, each vendored file came from — and this test holds the file
// content, the manifest, and the file's own provenance header to each
// other. An intentional resync updates all three together; anything else
// fails here.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import Path from 'node:path'

import { TAGS, unknownTags } from '../dist/sdkgen'


const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')

// From the SOURCE tree: this file runs compiled out of dist-test/, and the
// manifest is data that tsc does not copy.
const MANIFEST = JSON.parse(
  readFileSync(Path.resolve(__dirname, '..', 'test', 'vendored.json'), 'utf8'))


// Every directory that holds nothing but vendored files. Listed so a file
// ADDED to one is caught: a hash check alone only sees files the manifest
// already names, which makes an unlisted addition invisible.
const VENDOR_DIRS = [
  'tm/ts/test/vendor/omni',
  'tm/ts/src/feature/secrets/sekreto',
  // sekreto's providers are a module each, so the vendored tree has a
  // second level. Listed explicitly rather than walked recursively: the
  // list is the thing that makes an ADDED file visible, and a recursive
  // walk that discovers its own directories would quietly accept a new
  // one.
  'tm/ts/src/feature/secrets/sekreto/provider',
  'tm/go/utility/struct',
]


// Line endings are NORMALISED before hashing, exactly as
// characterize.test.ts does for the golden manifest. The repo ships no
// .gitattributes, so a Windows checkout can convert these files to CRLF —
// and a hash over raw bytes would then fail on windows-latest alone, for a
// file nobody touched.
function sha256(path: string): string {
  const raw = readFileSync(path).toString('binary').replace(/\r\n/g, '\n')
  return createHash('sha256').update(Buffer.from(raw, 'binary')).digest('hex')
}


// The convention every vendored file carries, as three lines at the top:
//
//   // VENDORED: @voxgig/<lib> <version> (<upstream path>)
//   // Source: <repo> @ <commit>
//   // License: MIT ... Do not edit: resync from upstream.
function provenance(path: string): any {
  // Same reason as sha256 above: a CRLF checkout would leave a trailing
  // '\r' on every line, which the anchored patterns below would still
  // match but the licence/resync checks would read oddly.
  const head = readFileSync(path, 'utf8').split(/\r?\n/).slice(0, 3)

  const vendored = /^\/\/ VENDORED: @voxgig\/(\S+) (\S+) \((.+?)\)/.exec(head[0])
  const source = /^\/\/ Source: (\S+) @ ([0-9a-f]{40})/.exec(head[1] || '')
  const license = /^\/\/ License: (\S+)/.exec(head[2] || '')

  return {
    lib: vendored && vendored[1],
    version: vendored && vendored[2],
    upstream: vendored && vendored[3],
    repo: source && source[1],
    commit: source && source[2],
    license: license && license[1],
    resync: /Do not edit: resync from upstream\./.test(head[2] || ''),
  }
}


describe('vendored', () => {

  for (const [lib, entry] of Object.entries<any>(MANIFEST.library)) {

    test(`${lib}: every file matches the manifest hash`, () => {
      for (const [rel, spec] of Object.entries<any>(entry.file)) {
        const path = Path.join(SDK, rel)
        ok(existsSync(path), `vendored file is missing: ${rel}`)

        strictEqual(sha256(path), spec.sha256,
          rel + ' changed. If this was an intentional resync, update ' +
          'test/vendored.json (hash, version and commit) in the same commit; ' +
          'if it was a local edit to vendored code, it needs a marked PATCH ' +
          'block and an upstream issue instead')
      }
    })


    test(`${lib}: every file's own header agrees with the manifest`, () => {
      for (const [rel, spec] of Object.entries<any>(entry.file)) {
        const p = provenance(Path.join(SDK, rel))

        ok(null != p.lib, rel + ': no VENDORED provenance header')

        strictEqual(p.version, entry.version,
          rel + ': header says version ' + p.version +
          ', manifest says ' + entry.version + ' — stamps must move together')

        strictEqual(p.commit, entry.commit,
          rel + ': header commit disagrees with the manifest')

        strictEqual(p.repo, entry.repo, rel + ': header repo disagrees')

        // The upstream path is what a resync reads FROM. A wrong one sends
        // the next resync to the wrong file, silently.
        ok(p.upstream.startsWith(spec.upstream),
          rel + ': header upstream path ' + p.upstream +
          ' does not match the manifest ' + spec.upstream)

        strictEqual(p.license, 'MIT', rel + ': licence notice missing')
        ok(p.resync, rel + ': header lacks the do-not-edit resync notice')
      }
    })
  }


  // A hash check only covers files the manifest names, so without this a
  // new file dropped into a vendored directory is unstamped, unhashed and
  // completely unguarded.
  test('no unlisted file sits in a vendored directory', () => {
    const listed = new Set<string>()
    for (const entry of Object.values<any>(MANIFEST.library)) {
      for (const rel of Object.keys(entry.file)) {
        listed.add(rel.split(Path.sep).join('/'))
      }
    }

    const found: string[] = []
    for (const dir of VENDOR_DIRS) {
      const abs = Path.join(SDK, dir)
      ok(existsSync(abs) && statSync(abs).isDirectory(),
        'vendored directory is missing: ' + dir)

      for (const name of readdirSync(abs)) {
        const rel = dir + '/' + name
        // A DIRECTORY is not an unlisted file. It must still be covered,
        // which is what its own VENDOR_DIRS entry does — a vendored
        // subtree nobody listed would otherwise pass unseen.
        if (statSync(Path.join(abs, name)).isDirectory()) {
          ok(VENDOR_DIRS.includes(rel),
            'vendored directory ' + rel + ' is not in VENDOR_DIRS, so the ' +
            'files beneath it are unchecked — add it')
          continue
        }
        if (!listed.has(rel)) {
          found.push(rel)
        }
      }
    }

    deepStrictEqual(found, [],
      'these files are inside a vendored directory but are not in ' +
      'test/vendored.json — add them with their upstream path and hash, ' +
      'or move them out of the vendored tree')
  })


  // IMPORT ADAPTATIONS, declared as data rather than as prose.
  //
  // A vendored file is sometimes not usable verbatim: omni's
  // `compat/struct.ts` imports `../src`, which resolves inside omni's own
  // repo and nowhere in a vendored tree. The adaptation was recorded only
  // in that file's provenance header — human-readable, and enforced by
  // nothing.
  //
  // So a resync silently reverted it, the manifest hash updated cleanly
  // because the resync wrote both, and the break surfaced two steps later
  // as a generated SDK that would not compile. Prose in a header is not a
  // guard. `adapt` in the manifest is.
  test('declared import adaptations survive a resync', () => {
    for (const [lib, entry] of Object.entries<any>(MANIFEST.library)) {
      for (const [rel, spec] of Object.entries<any>(entry.file)) {
        for (const adapt of spec.adapt || []) {
          const src = readFileSync(Path.join(SDK, rel), 'utf8')

          // Skip the provenance header, which NAMES the `from` string.
          const body = src.split('\n').slice(3).join('\n')

          ok(body.includes(adapt.to),
            lib + ' ' + rel + ': adaptation lost — expected ' + adapt.to +
            '. A resync overwrote it with upstream; re-apply it and rehash')
          ok(!body.includes(adapt.from),
            lib + ' ' + rel + ': unadapted ' + adapt.from + ' is still ' +
            'present, so this file will not resolve in a vendored tree')
        }
      }
    }
  })


  // The FULL-SET BARREL is deliberately not vendored.
  //
  // sekreto's `Providers.ts` exists to re-export every provider kind at
  // once — which is precisely what an SDK must not contain. Vendoring it
  // would import all thirteen modules, so the plugin trim would remove a
  // provider's file and leave the barrel importing it: the SDK does not
  // get leaner, it stops compiling. That is not hypothetical; it is what
  // happened on the first generated build.
  test('the full-set barrel is not vendored into SDKs', () => {
    const rel = 'tm/ts/src/feature/secrets/sekreto/Providers.ts'

    ok(!existsSync(Path.join(SDK, rel)),
      'sekreto Providers.ts is in the template tree: it re-exports every ' +
      'provider kind, so a trimmed SDK will not compile')

    const sekreto = MANIFEST.library['sekreto/typescript']
    ok(null == sekreto.file[rel],
      'sekreto Providers.ts is in vendored.json, so a resync would put it back')
  })


  // Local deviations from upstream must stay LOUD: an unmarked one is
  // indistinguishable from a resync that silently lost a fix.
  //
  // The table is EMPTY, and that is the finished state of the migration
  // guide's Phase 0. It carried three entries — two in Runner.ts, one in
  // Util.ts — for the patches the solardemo prototype made while waiting on
  // upstream: `match()` cloning its base, `jsonstr()` without a cycle guard,
  // and `errify`/`errmessage` collapsing error-shaped maps to
  // '[object Object]'. omni has since absorbed all three (`seen` in
  // Util.jsonstr, "Read the base DIRECTLY" in Runner.match, and an errify
  // that spreads a plain object), so the resync to 5956cc4 removed the
  // patches and this expectation together — which is exactly the sequence
  // the assertion below demands.
  //
  // Keep the test, not just the table: an empty map still fails loudly the
  // moment someone hand-edits a vendored file without marking it.
  test('local deviations from vendored code stay marked', () => {
    const patched: Record<string, number> = {}

    for (const [rel, count] of Object.entries(patched)) {
      const src = readFileSync(Path.join(SDK, rel), 'utf8')
      const marks = src.match(/PATCH \(solardemo prototype, pending upstream fix\)/g) || []

      strictEqual(marks.length, count,
        rel + ': expected ' + count + ' marked PATCH block(s), found ' +
        marks.length + '. A resync that carried the upstream fixes should ' +
        'REMOVE both the patch and this expectation; a new local deviation ' +
        'needs its own marker and an upstream issue')
    }

    // The other direction, which the table alone cannot cover: a marked
    // patch in a file the table does not list. Without this an empty table
    // would assert nothing at all, and a hand-edit to vendored code would
    // pass in silence — the precise failure this suite exists to stop.
    const unlisted: string[] = []
    for (const entry of Object.values<any>(MANIFEST.library)) {
      for (const rel of Object.keys(entry.file)) {
        if (null != patched[rel]) continue
        const src = readFileSync(Path.join(SDK, rel), 'utf8')
        if (/PATCH \(solardemo prototype, pending upstream fix\)/.test(src)) {
          unlisted.push(rel)
        }
      }
    }

    deepStrictEqual(unlisted, [],
      'these vendored files carry a marked PATCH that the table above does ' +
      'not declare — add the count, or resync the file if upstream has the fix')
  })
})


// The applicability-tag vocabulary is CLOSED (helpers/applicability), and
// `provides: &: boolean` accepts any key — so nothing in the model itself
// stops a typo. A mistyped tag is the worst failure shape available here:
// it compiles cleanly and makes the feature apply to NO target, so the
// feature just vanishes from every generated SDK with no diagnostic.
describe('applicability tags', () => {

  test('every tag the shipped scaffold declares is in the vocabulary', () => {
    const bad: string[] = []

    for (const kind of ['feature', 'target']) {
      const dir = Path.join(SDK, 'model', kind)
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.aon'))) {
        const src = readFileSync(Path.join(dir, f), 'utf8')
        const key = 'feature' === kind ? 'needs' : 'provides'

        // `needs: { sekreto: true }` — the map form the schema takes.
        const m = new RegExp(key + '\\s*:\\s*\\{([^}]*)\\}').exec(src)
        if (null == m) continue

        for (const pair of m[1].split(',')) {
          const name = pair.split(':')[0].trim().replace(/^['"]|['"]$/g, '')
          if ('' !== name && !TAGS.includes(name)) {
            bad.push(kind + '/' + f + ': ' + name)
          }
        }
      }
    }

    deepStrictEqual(bad, [],
      'these files declare a tag outside the closed vocabulary (' +
      TAGS.join(', ') + ') — add it to TAGS in helpers/applicability and ' +
      'document it in model/sdkgen.aon, or fix the typo')
  })


  // The vocabulary is only worth having if something rejects a stranger.
  test('unknownTags rejects a tag outside the vocabulary', () => {
    deepStrictEqual(unknownTags({ sekreto: true }), [])
    deepStrictEqual(unknownTags({ sekrreto: true }), ['sekrreto'])
    deepStrictEqual(unknownTags({}), [])
    deepStrictEqual(unknownTags(undefined), [])

    // A tag set to false is not declared, so it is not an unknown tag.
    deepStrictEqual(unknownTags({ sekrreto: false }), [])
  })
})


// A resync can change a vendored function's ARGUMENT ORDER, and go will not
// say a word: `GetPath(path, store)` became `GetPath(store, path)` in struct
// go 0.1.3 — both parameters are `any`, so all 35 call sites in the go
// templates kept compiling and started returning nil at runtime.
//
// Nothing cheap caught that. `go vet` compiles, so it saw nothing; the
// golden manifest hashes content, so it reported 14 changed files and no
// reason; only the feature-corpus lane went red, three layers away from the
// cause, saying "no declared operation completed against a plain 200"
// because `allow.op` had silently resolved to "".
//
// So the signatures the templates actually DEPEND ON are pinned here, at the
// point where a resync happens. This is deliberately not a full API check:
// it lists the few functions whose misuse is SILENT — the ones whose
// parameters share a type, so the compiler cannot tell them apart.
describe('vendored signature drift', () => {

  // Each entry: the exact `func` line the templates' call sites assume.
  // Written out in full rather than matched loosely, so a change to the
  // return type is caught alongside a change to the order.
  const PINNED: Record<string, string[]> = {
    'tm/go/utility/struct/voxgigstruct.go': [
      // Call sites pass (store, path) — the same order as SetPath. Reversing
      // these two `any` parameters compiles and yields nil.
      'func GetPath(store any, path any, injdefs ...*Injection) any {',
      'func SetPath(store any, path any, val any, injdefs ...map[string]any) any {',
    ],
  }

  for (const [rel, lines] of Object.entries(PINNED)) {
    test(rel + ': the signatures its call sites assume are unchanged', () => {
      const path = Path.join(SDK, rel)
      ok(existsSync(path), 'no vendored file at ' + rel)

      const src = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')

      for (const want of lines) {
        const name = /^func (\w+)/.exec(want)?.[1]

        // Report what it IS, not just that it is missing — the whole point
        // is that the reader needs to see the new order to fix call sites.
        const actual = new RegExp('^func ' + name + '\\(.*$', 'm').exec(src)

        ok(src.includes('\n' + want) || src.startsWith(want),
          'vendored ' + rel + ' no longer declares:\n' +
          '  ' + want + '\n' +
          'it now declares:\n' +
          '  ' + (actual?.[0] ?? '(no ' + name + ' at all)') + '\n' +
          'This is a SILENT break: the parameters share a type, so every ' +
          'call site still compiles. Update the call sites in tm/go and ' +
          'src/cmp/go to match, then update this pin in the same commit.')
      }
    })
  }
})
