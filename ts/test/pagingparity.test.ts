// Paging read per PORT, not per file — see COMMENT-NOTES.md.

import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { SCAFFOLD } from './actionharness'


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

const NO_FEATURES = ['go-cli', 'go-mcp', 'py-data']


function source(target: string): string {
  const rel = PAGING_SOURCE[target]
  const path = Path.join(SCAFFOLD, 'tm', target, ...rel.split('/'))
  ok(Fs.existsSync(path), target + ': no paging source at ' + rel)
  return Fs.readFileSync(path, 'utf8')
}


describe('paging parity', () => {

  test('every SDK target declares where its paging lives', () => {
    const shipped = Fs.readdirSync(Path.join(SCAFFOLD, 'tm'))
      .filter((n: string) => Fs.statSync(Path.join(SCAFFOLD, 'tm', n)).isDirectory())
      .filter((n: string) => !NO_FEATURES.includes(n))
      .sort()

    deepStrictEqual(shipped, Object.keys(PAGING_SOURCE).sort(),
      'the declared paging ports and the shipped targets disagree')
  })


  // Reading only camelCase loses the underscore APIs silently: hasMore
  // stays false forever.
  for (const spelling of ['next_cursor', 'next_page', 'has_more']) {
    test('every port reads ' + spelling, () => {
      const missing = Object.keys(PAGING_SOURCE)
        .filter((t: string) => !source(t).includes(spelling))
      deepStrictEqual(missing, [], 'ports not reading ' + spelling)
    })
  }


  // `nextPage` alone proves nothing: it is also a key of the record
  // PreResult builds. Match it beside the page PARAMETER write.
  test('every port prefers nextPage over page when building the request', () => {
    const PAGE_PARAM = /page[-_]?param/i

    const missing = Object.keys(PAGING_SOURCE).filter((t: string) => {
      const src = source(t)
      const lines = src.split('\n')
      return !lines.some((line: string, i: number) => {
        if (!PAGE_PARAM.test(line)) return false
        // The selection wraps in the wordier ports.
        return lines.slice(i, i + 8).join('\n').includes('nextPage')
      })
    })
    deepStrictEqual(missing, [],
      'ports not reading nextPage where the page parameter is set')
  })


  test('every port writes the record back into the control object', () => {
    const missing = Object.keys(PAGING_SOURCE).filter((t: string) => {
      const src = source(t)
      // Each port spells its control differently.
      return !src.split('\n').some((line: string) =>
        /ctrl/i.test(line) && /paging/i.test(line) &&
        /=|<-|put|set|oset|insert/i.test(line))
    })
    deepStrictEqual(missing, [], 'ports with no control write-back')
  })

})
