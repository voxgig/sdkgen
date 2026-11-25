import { test, describe } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { SCAFFOLD, makeModel } from './generateharness'


const ROOT = Path.resolve(__dirname, '..', '..')

function bundledTargets(): string[] {
  return Fs.readdirSync(Path.join(SCAFFOLD, 'model', 'target'))
    .filter((f: string) => f.endsWith('.aontu') && 'target-index.aontu' !== f)
    .map((f: string) => f.replace(/\.aontu$/, '')).sort()
}

function untrimmed(): string[] {
  const targets = bundledTargets()
  const model = makeModel(targets, undefined, '', [])
  return targets.filter((t: string) => false === model.main.kit.target[t]?.feature?.trim)
}

function named(text: string, from: string, to: string): string[] {
  const flat = text.replace(/\s+/g, ' ')
  const start = flat.indexOf(from)
  const clause = 0 > start ? '' : flat.slice(start, flat.indexOf(to, start))
  const known = new Set(bundledTargets())
  return [...clause.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1])
    .filter((n: string) => known.has(n)).sort()
}


// The pack's names are fixed text: its models are in another repository.
describe('untrimmed targets', () => {
  test('the feature how-to names exactly the bundled targets that keep every feature', () => {
    const page = Fs.readFileSync(Path.join(ROOT, 'docs', 'how-to', 'add-a-feature.md'), 'utf8')
    deepStrictEqual(named(page, 'Among the bundled targets', 'In the language pack'), untrimmed())
  })

  test('the agent guide names the same targets', () => {
    const guide = Fs.readFileSync(Path.join(ROOT, 'AGENTS.md'), 'utf8')
    deepStrictEqual(named(guide, '`feature: { trim: false }` (currently', 'bundled, plus'), untrimmed())
  })
})
