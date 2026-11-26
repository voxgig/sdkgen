import { test, describe, before } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert'

import { readFileSync, writeFileSync } from 'node:fs'
import Path from 'node:path'

import {
  FEATURES, variations, generateDocs, link, off, marker, codeFences, reaction, parity, startsOff,
  emptyTables, negativeControl, key,
} from './textguard'
import type { Finding, Pin, Run, Variation } from './textguard'
import { makeRoot } from './generateharness'


const PINS_FILE = Path.resolve(__dirname, '..', 'test', 'textguard-pins.json')

const PINNED: { suspended: { family: string, reason: string }[], pins: Pin[] } =
  JSON.parse(readFileSync(PINS_FILE, 'utf8'))

// The full matrix is one CI lane; `npm test` runs `link` and `fence` on these alone.
const FULL = '1' === process.env.SDKGEN_TEXTGUARD_FULL
const UPDATE = '1' === process.env.SDKGEN_TEXTGUARD_UPDATE
const SUBSET = ['baseline', 'phase-top-off', 'phase-readme-off-ts', 'phase-agentguide-off-ts',
  'root-ts', 'external-go-cli', 'external-ts', 'targets-lone']


function findings(base: Run, run: Run, v: Variation, full: boolean): Finding[] {
  const out = [...link(run), ...codeFences(run)]
  if (!full) return out
  out.push(...marker(run))
  out.push(...startsOff(run))
  out.push(...emptyTables(run))
  if (null != v.subject) out.push(...off(run, v.subject))
  if ('baseline' === v.id) out.push(...parity(run))
  else out.push(...reaction(base, run, v.family))
  return out
}


function report(found: Finding[], limit = 40): string {
  return found.slice(0, limit).map((f: Finding) =>
    `  [${f.relation}] ${f.chain} (${f.cause}) in ${f.doc} under ${f.variation}:\n    ${f.line}`).join('\n')
}


describe('textguard', () => {

  let matrix: Variation[] = []
  let found: Finding[] = []
  let ran = new Set<string>()

  before(async () => {
    matrix = variations()
    const chosen = FULL || UPDATE ? matrix : matrix.filter((v: Variation) => SUBSET.includes(v.id))
    const base = await generateDocs(chosen[0], { reads: FULL || UPDATE })
    for (const v of chosen) {
      const run = 'baseline' === v.id ? base : await generateDocs(v)
      ran.add(v.id)
      found.push(...findings(base, run, v, FULL || UPDATE))
    }
  })

  test('every finding is pinned, and every pin still matches', () => {
    const suspended = new Set(PINNED.suspended.map((s) => s.family))
    const family = new Map(matrix.map((v: Variation) => [v.id, v.family]))
    const live = found.filter((f: Finding) => !suspended.has(family.get(f.variation) || ''))

    const byKey = new Map<string, Finding[]>()
    for (const f of live) byKey.set(key(f), [...(byKey.get(key(f)) || []), f])

    if (UPDATE) {
      const kept = new Map(PINNED.pins.map((p: Pin) => [key(p), p]))
      const pins = [...byKey.entries()].sort(([a], [b]) => a < b ? -1 : 1)
        .map(([k, fs]: [string, Finding[]]) => ({
          relation: fs[0].relation, chain: fs[0].chain, cause: fs[0].cause,
          reason: kept.get(k)?.reason ?? 'TODO',
          line: fs[0].line,
          variations: [...new Set(fs.map((f: Finding) => f.variation))].sort(),
        }))
      writeFileSync(PINS_FILE, JSON.stringify({ suspended: PINNED.suspended, pins }, null, 2) + '\n')
      return
    }

    const pinned = new Set(PINNED.pins.map(key))
    const unpinned = live.filter((f: Finding) => !pinned.has(key(f)))
    deepStrictEqual(unpinned.length, 0, 'unpinned findings, each a stale sentence, a dangling ' +
      'link or a split between siblings; fix the writer, or pin it with a reason:\n' +
      report(unpinned))

    const stale = PINNED.pins.filter((p: Pin) =>
      (FULL || (['link', 'fence'].includes(p.relation) && p.variations.some((id: string) => ran.has(id)))) &&
      !byKey.has(key(p)))
    deepStrictEqual(stale.map(key), [], 'pins that match nothing; remove them')

    if (FULL) {
      for (const s of PINNED.suspended) {
        strictEqual(found.some((f: Finding) => s.family === family.get(f.variation)), true,
          'the suspended family ' + s.family + ' raised nothing; lift the suspension')
      }
    }
  })

  test('each pin carries a reason', () => {
    deepStrictEqual(PINNED.pins.filter((p: Pin) => !p.reason || 'TODO' === p.reason).map(key), [])
  })

  // The guard reads what a docs-only Root writes, which must be what the full
  // Root writes, including with the top phase off, a target at the root and one
  // in another repository.
  test('the docs-only Root writes the documents the full Root writes', async () => {
    for (const id of ['baseline', 'phase-top-off', 'root-ts', 'external-go-cli']) {
      const v = matrix.find((m: Variation) => id === m.id)!
      const docs = await generateDocs(v)
      const full = await generateDocs(v, { root: makeRoot() })
      const fullDocs = Object.keys(full.files).filter((p: string) => p.endsWith('.md'))
      const differ = fullDocs.filter((p: string) =>
        null != docs.files[p] ? docs.files[p] !== full.files[p] : !docs.present.has(p))
      deepStrictEqual(differ, [], id + ': documents the docs-only Root writes otherwise, or misses')
    }
  })

  test('a table header stands only over a row', () => {
    const tables = (texts: string[]): string[] => emptyTables({
      id: 'control', files: {}, present: new Set(), on: {}, applies: {},
      lines: { 'ts/README.md': texts.map((text: string) => ({ text, chain: 'Control' })) },
    }).map((f: Finding) => f.line)

    deepStrictEqual(tables(['| A | B |', '| --- | --- |', '| 1 | 2 |']), [])
    deepStrictEqual(tables(['| A | B |', '| --- | --- |', '', '| 1 | 2 |']), ['| A | B |'])
    deepStrictEqual(tables(['| A |', '|---|']), ['| A |'])
    deepStrictEqual(tables(['```', '| A |', '| --- |', '```']), [])
  })

  test('a sentence says features start off only when every feature it covers does', () => {
    const causes = (texts: string[]): string[] => startsOff({
      id: 'control', files: {}, present: new Set(),
      lines: { 'ts/README.md': texts.map((text: string) => ({ text, chain: 'Control' })) },
      on: { cache: false, log: true, retry: false },
      applies: { ts: ['cache', 'log', 'retry'] },
    }).map((f: Finding) => f.cause)

    deepStrictEqual(causes(['## Features', '', 'This SDK ships 3 optional features. Each is **inactive until you',
      'switch it on**, so `feature.log.active` is false.']), ['log'])
    deepStrictEqual(causes(['## Features', '', 'The others are **inactive until you switch them on**.']), ['log'])
    deepStrictEqual(causes(['## Features', '', '`log` is **on by default**. The others are',
      '**inactive until you switch them on**.']), [])
    deepStrictEqual(causes(['#### `log`', '', '- Inactive by default: leaving it out costs nothing.']), ['log'])
    deepStrictEqual(causes(['#### `retry`', '', '- Inactive by default: leaving it out costs nothing.']), [])
    deepStrictEqual(causes(['> **Features:** `cache`, `log`, `retry` — opt-in,', '> inactive until switched on.']),
      ['log'])
    deepStrictEqual(causes(['## Features', '', '```', 'inactive until switched on', '```']), [])
    deepStrictEqual(causes(['# Tools', '', 'The write tools are off by default.']), [])
  })

  // The control's stale sentence, dangling link and unfired marker, and
  // nothing more.
  test('the negative control is reported, and nothing else changes', async () => {
    const feature = FEATURES[0]
    const base = matrix[0]
    const without = matrix.find((v: Variation) => 'feature-' + feature === v.id)!
    const count = async (control: boolean) => {
      const opts = control ? { control: negativeControl(feature) } : {}
      const b = await generateDocs(base, opts)
      const w = await generateDocs(without, opts)
      return [...link(b), ...marker(b), ...off(w, without.subject!)]
    }
    const plain = await count(false)
    const controlled = await count(true)
    const extra = controlled.filter((f: Finding) => 'GUARD.md' === f.doc)
    deepStrictEqual(extra.map((f: Finding) => f.relation).sort(), ['link', 'marker', 'off'])
    strictEqual(controlled.length - plain.length, 3)
  })
})
