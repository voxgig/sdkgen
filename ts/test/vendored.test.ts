
import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import Path from 'node:path'

import { TAGS, unknownTags } from '../dist/sdkgen'


const SDK = Path.resolve(__dirname, '..', 'project', '.sdk')

const MANIFEST = JSON.parse(
  readFileSync(Path.resolve(__dirname, '..', 'test', 'vendored.json'), 'utf8'))


const VENDOR_DIRS = [
  'tm/ts/test/vendor/omni',
  'tm/ts/src/feature/secrets/sekreto',
  'tm/ts/src/feature/secrets/sekreto/provider',
  'tm/ts/src/feature/secrets/sekreto/plugins',
  'tm/ts/src/feature/secrets/plugin',
  'tm/go/utility/struct',
  'tm/js/test/vendor/omni',
  'tm/go/test/omni',
  'tm/py/test/voxgig_omni',
  'tm/go/feature/secrets/sekreto',
  'tm/go/feature/secrets/plugin',
  'tm/go/feature/secrets/plugins',
  'tm/go/feature/secrets/plugins/aws',
  'tm/go/feature/secrets/plugins/azuresecrets',
  'tm/go/feature/secrets/plugins/boru',
  'tm/go/feature/secrets/plugins/doppler',
  'tm/go/feature/secrets/plugins/gcpsecrets',
  'tm/go/feature/secrets/plugins/hashicorp',
  'tm/go/feature/secrets/plugins/minivault',
  'tm/go/feature/secrets/plugins/httpjson',
  'tm/go/feature/secrets/plugins/infisical',
  'tm/go/feature/secrets/plugins/onepassword',
  'tm/go/feature/secrets/plugins/secretspec',
  'tm/py/pkg/feature/secrets/voxgig_sekreto',
  'tm/py/pkg/feature/secrets/voxgig_sekreto/plugins',
  'tm/py/pkg/feature/secrets/voxgig_plugin',
  'tm/rb/test/vendor/omni',
  'tm/php/test/vendor/omni',
  'tm/lua/test/vendor/omni',
  'tm/lua/utility/struct',
  'tm/java/test/vendor/omni',
  'tm/java/utility/struct',
  'tm/perl/t/vendor/omni',
  'tm/perl/t/vendor/omni/Voxgig',
  'tm/perl/t/vendor/omni/Voxgig/Omni',
  'tm/kotlin/test/vendor/omni',
  'tm/kotlin/utility/struct',
  'tm/csharp/test/vendor/omni',
  'tm/csharp/utility/struct',
  // Tranche 3. The destination is whatever the language's own module
  // system can actually load from: clojure's namespaces are path-derived,
  // so its files sit under voxgig/omni/ and each level is listed; rust
  // and c keep their suites in tests/ (plural), scala in sdktest/, swift
  // in Tests/.
  'tm/c/tests/vendor/omni',
  'tm/cpp/test/vendor/omni',
  'tm/swift/Tests/vendor/omni',
  'tm/rust/tests/vendor/omni',
  'tm/scala/sdktest/vendor/omni',
  'tm/clojure/test/vendor/omni',
  'tm/clojure/test/vendor/omni/voxgig',
  'tm/clojure/test/vendor/omni/voxgig/omni',
  'tm/elixir/test/vendor/omni',
  'tm/ocaml/test/vendor/omni',
  // zig arrives last and vendors BOTH libraries: its struct copy was a
  // hand-maintained 0.13-era fork until the target moved to Zig 0.16, at
  // which point upstream's own port - already written for 0.16 - could
  // simply replace it.
  'tm/zig/utility/voxgigstruct',
  'tm/zig/test/vendor/omni',
  'tm/clojure/feature/secrets/voxgig/plugin',
  'tm/clojure/feature/secrets/voxgig/sekreto',
  'tm/clojure/feature/secrets/voxgig/sekreto/plugins',
  'tm/csharp/feature/secrets/plugin',
  'tm/csharp/feature/secrets/plugins',
  'tm/csharp/feature/secrets/sekreto',
  'tm/elixir/lib/projectname/feature/secrets/plugin',
  'tm/elixir/lib/projectname/feature/secrets/sekreto',
  'tm/elixir/lib/projectname/feature/secrets/sekreto/plugins',
  'tm/java/feature/secrets/plugin',
  'tm/java/feature/secrets/sekreto',
  'tm/java/feature/secrets/sekreto/plugins',
  'tm/kotlin/feature/secrets/plugin',
  'tm/kotlin/feature/secrets/sekreto',
  'tm/kotlin/feature/secrets/sekreto/plugins',
  'tm/perl/feature/secrets/plugin',
  'tm/perl/feature/secrets/plugin/Voxgig',
  'tm/perl/feature/secrets/plugin/Voxgig/Plugin',
  'tm/perl/feature/secrets/plugins',
  'tm/perl/feature/secrets/plugins/Voxgig',
  'tm/perl/feature/secrets/plugins/Voxgig/Sekreto',
  'tm/perl/feature/secrets/plugins/Voxgig/Sekreto/Plugins',
  'tm/perl/feature/secrets/sekreto',
  'tm/perl/feature/secrets/sekreto/Voxgig',
  'tm/perl/feature/secrets/sekreto/Voxgig/Sekreto',
  'tm/rust/feature/secrets/plugin',
  'tm/rust/feature/secrets/plugins',
  'tm/rust/feature/secrets/plugins/aws',
  'tm/rust/feature/secrets/plugins/httpjson',
  'tm/rust/feature/secrets/plugins/minivault',
  'tm/rust/feature/secrets/sekreto',
  'tm/scala/feature/secrets/plugin',
  'tm/scala/feature/secrets/sekreto',
  'tm/scala/feature/secrets/sekreto/plugins',
  'tm/swift/Sources/ProjectNameSDK/feature/secrets/plugin',
  'tm/swift/Sources/ProjectNameSDK/feature/secrets/plugins',
  'tm/swift/Sources/ProjectNameSDK/feature/secrets/sekreto',
  'tm/c/feature/secrets/plugin',
  'tm/c/feature/secrets/plugins',
  'tm/c/feature/secrets/sekreto',
  'tm/lua/feature/secrets',
  'tm/lua/feature/secrets/native',
  'tm/lua/feature/secrets/plugin',
  'tm/lua/feature/secrets/sekreto',
  'tm/lua/feature/secrets/sekreto/plugins',
  'tm/zig/feature/secrets/plugin',
  'tm/zig/feature/secrets/plugins',
  'tm/zig/feature/secrets/sekreto',
  'tm/ocaml/feature/secrets/plugin',
  'tm/ocaml/feature/secrets/plugins',
  'tm/ocaml/feature/secrets/sekreto',
  'tm/cpp/feature/secrets/plugin',
  'tm/cpp/feature/secrets/plugins',
  'tm/cpp/feature/secrets/sekreto',
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



// Comment prefix per template language, keyed by the tm/<lang>/ segment of
// the destination path. A vendored file in a language not listed here is a
// loud failure, not a silent pass — add the language when its first
// vendored file lands.
const LANG_COMMENT: Record<string, string> = {
  ts: '//', js: '//', go: '//', py: '#',
  rb: '#', php: '//', lua: '--', perl: '#',
  java: '//', kotlin: '//', csharp: '//',
  c: '//', cpp: '//', swift: '//', rust: '//', scala: '//',
  clojure: ';;', elixir: '#', zig: '//',
  ocaml: '(*',
}


// The comment token goes into a RegExp, and ocaml's is not literal there:
// `(*` reads as an unterminated group followed by a quantifier with
// nothing to repeat, which THROWS rather than failing an assertion. The
// escape was always here, inline and unexplained; it is named now because
// ocaml is the first language that actually needs it.
function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const LANG_HEADER_OFFSET: Record<string, number> = {
  php: 1,
}

function commentFor(rel: string): string {
  const lang = /^tm\/([^/]+)\//.exec(rel.split(Path.sep).join('/'))?.[1]
  const c = lang && LANG_COMMENT[lang]
  ok(null != c, rel + ': no LANG_COMMENT entry for its language — add one')
  return c as string
}

function provenance(path: string, rel: string): any {
  const lang = /^tm\/([^/]+)\//.exec(rel.split(Path.sep).join('/'))?.[1]
  const offset = (lang && LANG_HEADER_OFFSET[lang]) || 0

  const head = readFileSync(path, 'utf8').split(/\r?\n/).slice(offset, offset + 3)

  const c = escape(commentFor(rel))

  const vendored = new RegExp(
    '^' + c + ' VENDORED: @voxgig/(\\S+) (\\S+) \\((.+?)\\)').exec(head[0])
  const source = new RegExp(
    '^' + c + ' Source: (\\S+) @ ([0-9a-f]{40})(?:\\s+\\[tag: (\\S+)\\])?')
    .exec(head[1] || '')
  const license = new RegExp('^' + c + ' License: (\\S+)').exec(head[2] || '')

  return {
    lib: vendored && vendored[1],
    version: vendored && vendored[2],
    upstream: vendored && vendored[3],
    repo: source && source[1],
    commit: source && source[2],
    tag: source && source[3],
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
        const p = provenance(Path.join(SDK, rel), rel)

        ok(null != p.lib, rel + ': no VENDORED provenance header')

        strictEqual(p.version, entry.version,
          rel + ': header says version ' + p.version +
          ', manifest says ' + entry.version + ' — stamps must move together')

        strictEqual(p.commit, entry.commit,
          rel + ': header commit disagrees with the manifest')

        strictEqual(p.repo, entry.repo, rel + ': header repo disagrees')

        ok(p.upstream.startsWith(spec.upstream),
          rel + ': header upstream path ' + p.upstream +
          ' does not match the manifest ' + spec.upstream)

        strictEqual(p.license, 'MIT', rel + ': licence notice missing')
        ok(p.resync, rel + ': header lacks the do-not-edit resync notice')
      }
    })
  }


  test('every tagged entry agrees with the manifest tag', () => {
    for (const [lib, entry] of Object.entries<any>(MANIFEST.library)) {
      if (null == entry.tag) continue
      strictEqual(entry.tag, MANIFEST.tag,
        lib + ': entry tag ' + entry.tag + ' != manifest tag ' + MANIFEST.tag)

      for (const rel of Object.keys(entry.file)) {
        const p = provenance(Path.join(SDK, rel), rel)
        if (null != p.tag) {
          strictEqual(p.tag, MANIFEST.tag,
            rel + ': header tag disagrees with the manifest tag')
        }
      }
    }
  })


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


  test('declared import adaptations survive a resync', () => {
    for (const [lib, entry] of Object.entries<any>(MANIFEST.library)) {
      for (const [rel, spec] of Object.entries<any>(entry.file)) {
        for (const adapt of spec.adapt || []) {
          // LF-NORMALIZED, like the hash check above and for the same
          // reason: an `adapt` string may span a line ending (the php
          // require rewrite ends in "\n"), and a CRLF checkout would then
          // never match it. That failed on windows only, while linux and
          // macos passed — the file was correct on all three.
          const src = readFileSync(Path.join(SDK, rel), 'utf8')
            .replace(/\r\n/g, '\n')

          const lang = /^tm\/([^/]+)\//.exec(rel)?.[1]
          const skip = 3 + ((lang && LANG_HEADER_OFFSET[lang]) || 0)
          const body = src.split('\n').slice(skip).join('\n')

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


  test('the full-set barrel is not vendored into SDKs', () => {
    const BARRELS = [
      'tm/ts/src/feature/secrets/sekreto/Providers.ts',
      'tm/ts/src/feature/secrets/sekreto/plugins/index.ts',
      // go: eager imports of all ten kinds — a compile break if trimmed.
      'tm/go/feature/secrets/plugins/plugins.go',
      // py: a PEP-562 LAZY barrel — it imports nothing eagerly, so its
      // breakage is at attribute access, which a compile-only check
      // cannot see. The one shape that can SHIP broken; pinned absent.
      'tm/py/pkg/feature/secrets/voxgig_sekreto/plugins/__init__.py',
      'tm/swift/Sources/ProjectNameSDK/feature/secrets/plugins/All.swift',
      'tm/c/feature/secrets/plugins/all.c',
      'tm/lua/feature/secrets/sekreto/plugins.lua',
      'tm/zig/feature/secrets/plugins/all.zig',
      'tm/ocaml/feature/secrets/plugins/allplugins.ml',
      'tm/cpp/feature/secrets/plugins/All.hpp',
      'tm/cpp/feature/secrets/plugins/All.cpp',
    ]

    for (const rel of BARRELS) {
      ok(!existsSync(Path.join(SDK, rel)),
        rel + ' is in the template tree: it reaches every plugin kind, so ' +
        'a trimmed SDK will not compile (or, for a lazy barrel, breaks at ' +
        'first attribute access)')

      for (const entry of Object.values<any>(MANIFEST.library)) {
        ok(null == entry.file[rel],
          rel + ' is in vendored.json, so a resync would put it back')
      }
    }
  })


  test('local deviations from vendored code stay marked', () => {
    const patched: Record<string, number> = {
      'tm/php/utility/struct/Struct.php': 4,

      //   go: hand-rolled SetProp against a held grandparent, where SetProp
      'tm/go/utility/struct/voxgigstruct.go': 2,
      'tm/rb/utility/struct/voxgig_struct.rb': 1,

      'tm/csharp/utility/struct/Struct.cs': 1,
    }

    for (const [rel, count] of Object.entries(patched)) {
      const src = readFileSync(Path.join(SDK, rel), 'utf8')
      const marks = src.match(/PATCH \([^)]*pending upstream fix\)/g) || []

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
        if (/PATCH \([^)]*pending upstream fix\)/.test(src)) {
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

  test('no ReadmeRef reads the feature map past the applicability gate', () => {
    const raw = 'getModelPath(model, `main.${KIT}.feature`)'
    const bad: string[] = []

    const cmpdir = Path.join(SDK, 'src', 'cmp')
    for (const lang of readdirSync(cmpdir)) {
      const dir = Path.join(cmpdir, lang)
      if (!statSync(dir).isDirectory()) continue
      for (const f of readdirSync(dir).filter((n) => n.startsWith('ReadmeRef_'))) {
        const src = readFileSync(Path.join(dir, f), 'utf8')
        if (src.includes(raw)) bad.push(lang + '/' + f)
      }
    }

    deepStrictEqual(bad, [],
      'these list features without gating them by the target: ' + bad.join(', '))
  })


  test('every tag the shipped scaffold declares is in the vocabulary', () => {
    const bad: string[] = []

    for (const kind of ['feature', 'target']) {
      const dir = Path.join(SDK, 'model', kind)
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.aon'))) {
        const src = readFileSync(Path.join(dir, f), 'utf8')
        const key = 'feature' === kind ? 'needs' : 'provides'

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


  test('unknownTags rejects a tag outside the vocabulary', () => {
    deepStrictEqual(unknownTags({ sekreto: true }), [])
    deepStrictEqual(unknownTags({ sekrreto: true }), ['sekrreto'])
    deepStrictEqual(unknownTags({}), [])
    deepStrictEqual(unknownTags(undefined), [])

    deepStrictEqual(unknownTags({ sekrreto: false }), [])
  })
})


describe('vendored signature drift', () => {

  const PINNED: Record<string, string[]> = {
    'tm/csharp/utility/struct/Struct.cs': [
      '        public static object? SetPath(object? store, object? path, object? val)',
      '        public static object? GetPath(object? store, object? path,',
    ],
    'tm/go/utility/struct/voxgigstruct.go': [
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
        const name = /(\w+)\s*\(/.exec(want)?.[1]

        const actual = new RegExp('^.*\\b' + name + '\\s*\\(.*$', 'm').exec(src)

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
