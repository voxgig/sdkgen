// The paging feature, read per port.
//
// Every port normalises the same signals, so every port has to read the same
// spellings, prefer nextPage over page at PreRequest, and write the record
// back into the call's control object. clojure and ocaml were the two that
// did not, for a structural reason this suite exists to remove: their
// features live in ONE aggregate file rather than a paging file of their own,
// so a per-file sweep across `tm/*/feature/paging*` never reached them.
//
// The list below is therefore the ports, not the files, and a port declares
// where its paging lives. A new target fails here until it does the same.

import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { SCAFFOLD } from './actionharness'


// Where each SDK target implements paging, relative to its template tree.
// An AGGREGATE holds the whole feature set in one file; the rest carry a
// paging file. Consumer targets (go-cli, go-mcp, py-data) wrap a sibling and
// implement no feature of their own, so they are absent by design.
const PAGING_SOURCE: Record<string, string> = {
  c: 'feature/paging.c',
  clojure: 'src/sdk/features.clj',
  cpp: 'feature/paging.hpp',
  csharp: 'feature/PagingFeature.cs',
  elixir: 'lib/projectname/feature/paging.ex',
  go: 'feature/paging_feature.go',
  java: 'feature/PagingFeature.java',
  js: 'src/feature/paging/PagingFeature.js',
  kotlin: 'feature/PagingFeature.kt',
  lua: 'feature/paging_feature.lua',
  ocaml: 'sdk_features.ml',
  perl: 'feature/paging_feature.pm',
  php: 'feature/PagingFeature.php',
  py: 'pkg/feature/paging_feature.py',
  rb: 'feature/paging_feature.rb',
  rust: 'feature/paging.rs',
  scala: 'feature/PagingFeature.scala',
  swift: 'Sources/ProjectNameSDK/feature/PagingFeature.swift',
  ts: 'src/feature/paging/PagingFeature.ts',
  zig: 'feature/paging.zig',
}

// The consumer targets, which wrap a sibling SDK and ship no features.
const NO_FEATURES = ['go-cli', 'go-mcp', 'py-data']


function source(target: string): string {
  const rel = PAGING_SOURCE[target]
  const path = Path.join(SCAFFOLD, 'tm', target, ...rel.split('/'))
  ok(Fs.existsSync(path), target + ': no paging source at ' + rel)
  return Fs.readFileSync(path, 'utf8')
}


describe('paging parity', () => {

  // The list is the closed set. Add a target and this is where you learn
  // that its paging needs reading.
  test('every SDK target declares where its paging lives', () => {
    const shipped = Fs.readdirSync(Path.join(SCAFFOLD, 'tm'))
      .filter((n: string) => Fs.statSync(Path.join(SCAFFOLD, 'tm', n)).isDirectory())
      .filter((n: string) => !NO_FEATURES.includes(n))
      .sort()

    deepStrictEqual(shipped, Object.keys(PAGING_SOURCE).sort(),
      'the declared paging ports and the shipped targets disagree')
  })


  // A body may spell these either way. Reading only the camelCase form loses
  // the page on every API that uses the underscore one, silently: the list
  // still returns its items, and hasMore is simply false forever.
  for (const spelling of ['next_cursor', 'next_page', 'has_more']) {
    test('every port reads ' + spelling, () => {
      const missing = Object.keys(PAGING_SOURCE)
        .filter((t: string) => !source(t).includes(spelling))
      deepStrictEqual(missing, [], 'ports not reading ' + spelling)
    })
  }


  // PreRequest must ask for the page the record says comes NEXT. A port that
  // reads only `page` re-fetches the page it just read, forever.
  //
  // `nextPage` on its own proves nothing — it is also a KEY of the record
  // PreResult builds, so both unfixed ports contained it. The check is that
  // it appears beside the write of the page QUERY PARAMETER, which is the
  // request side and nowhere else.
  test('every port prefers nextPage over page when building the request', () => {
    const PAGE_PARAM = /page[-_]?param/i

    const missing = Object.keys(PAGING_SOURCE).filter((t: string) => {
      const src = source(t)
      const lines = src.split('\n')
      return !lines.some((line: string, i: number) => {
        if (!PAGE_PARAM.test(line)) return false
        // The selection can wrap over the following lines in the wordier
        // ports, so read a short window rather than the one line.
        return lines.slice(i, i + 8).join('\n').includes('nextPage')
      })
    })
    deepStrictEqual(missing, [],
      'ports not reading nextPage where the page parameter is set')
  })


  // The record reaches the caller through the control object and nowhere
  // else, so a port that only sets it on the result hands back pages the
  // caller cannot continue from.
  test('every port writes the record back into the control object', () => {
    const missing = Object.keys(PAGING_SOURCE).filter((t: string) => {
      const src = source(t)
      // Each port spells its control differently (ctrl / c_ctrl / Ctrl /
      // @ctrl / $ctrl), so the check is that the write-back mentions BOTH
      // the control and paging on the same line.
      return !src.split('\n').some((line: string) =>
        /ctrl/i.test(line) && /paging/i.test(line) &&
        /=|<-|put|set|oset|insert/i.test(line))
    })
    deepStrictEqual(missing, [], 'ports with no control write-back')
  })

})
