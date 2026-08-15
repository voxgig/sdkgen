// CHARACTERIZATION: exactly what `target add` and `feature add` write today.
//
// WHY THIS EXISTS
//
// The add pipeline is about to be rebuilt on a kind registry — `target` and
// `feature` become data, and one `add(kind, ...)` action replaces the two
// hand-written pipelines (docs/design/sdkgen-packages.md §8, delivery phase
// 2). That refactor touches the two most incident-scarred functions in the
// repo (the OptionsShape dry-run trap; the pruneStaleTemplates history), and
// its whole promise is that the OUTPUT does not move.
//
// Nothing could have checked that promise. The action suites assert on file
// LISTS and on a handful of contents; a refactor could have changed the bytes
// of any of ~2,800 copied files in any of 27 targets and stayed green.
//
// So: a manifest of `<path> <hash>` for every file each add writes, captured
// before the refactor and required to reproduce exactly after it. Same
// technique `generate.test.ts` uses for components, and the discipline
// AGENTS.md demands whenever generated output changes ("characterize it
// first").
//
// WHEN THIS FAILS
//
// A failure is not automatically a bug — a deliberate scaffold change moves
// these hashes, and that is exactly what the manifest is for: the diff shows
// which targets a change reached. Re-read the diff, satisfy yourself it is
// what you meant, then regenerate:
//
//     npm run golden
//
// MACHINE-INDEPENDENCE
//
// The manifest must be identical on every machine, in a worktree and in CI,
// so nothing in it may depend on where the checkout lives. That is why the
// harness references targets the way a consumer does
// (`node_modules/@voxgig/sdkgen/project/<t>`) rather than by absolute path:
// `base` is recorded relative to the project root, so the `'BASE'`
// substitution no longer writes this checkout's location into the copied
// target model. A guard below fails if any absolute path leaks back in.

import { test, describe } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'
import { createHash } from 'node:crypto'

import {
  SCAFFOLD, PROJECT, ROOT, makeProject, targetRef, target_add, feature_add,
} from './actionharness'


const GOLDEN = Path.resolve(__dirname, '..', 'test', 'golden', 'add-output.txt')

// Set by `npm run golden`.
const UPDATE = '1' === process.env.SDKGEN_GOLDEN_UPDATE


// Every target and feature the scaffold ships, discovered rather than listed,
// so a new one is characterized without anyone remembering to add it here.
function shipped(kind: string): string[] {
  return Fs.readdirSync(Path.join(SCAFFOLD, 'model', kind))
    .filter((f: string) => f.endsWith('.aontu') && !f.includes('-index'))
    .map((f: string) => f.replace(/\.aontu$/, ''))
    .sort()
}


// Short but ample: a 12-hex-char prefix over ~3,000 files leaves collision
// odds negligible, and keeps the manifest readable in a diff.
//
// LINE ENDINGS ARE NORMALISED FIRST. This repo has no `.gitattributes`, so a
// Windows checkout may materialise the scaffold with CRLF — which would flip
// every hash in the manifest and fail this suite on the Windows CI job for a
// reason that has nothing to do with the add pipeline. What the goldens are
// for is detecting output changes caused by a REFACTOR, so the checkout's
// line-ending policy is noise here.
function hash(content: Buffer): string {
  const lf = Buffer.from(content.toString('binary').replace(/\r\n/g, '\n'), 'binary')
  return createHash('sha256').update(lf).digest('hex').slice(0, 12)
}


// `<path> <hash>` for every file in the project, sorted by path.
//
// Paths are joined with '/' rather than Path.join: these are memfs paths, and
// on Windows Path.join would hand the layered fs a backslash path it does not
// resolve.
function manifest(project: any): string[] {
  return project.files().map((rel: string) => {
    const content = project.fs.readFileSync(ROOT + '/' + rel)
    return rel + ' ' + hash(content)
  })
}


async function targetSection(target: string): Promise<string[]> {
  const project = makeProject({})
  await target_add([targetRef(target)], project.actx)
  return manifest(project)
}


// A feature's output depends on which targets are present to fan out over, so
// the target set is FIXED here — two languages that keep feature source in
// different places (`src/feature/<name>/` for ts, `feature/<name>_feature.go`
// for go), which is the discovery the fan-out has to get right.
async function featureSection(feature: string): Promise<string[]> {
  const project = makeProject({
    target: { ts: { name: 'ts' }, go: { name: 'go' } },
    feature: { [feature]: { name: feature, active: true } },
  })

  await target_add([targetRef('ts')], project.actx)
  await target_add([targetRef('go')], project.actx)

  const before = new Set(manifest(project))
  await feature_add([feature], project.actx)

  // Only what the FEATURE add contributed — the two target trees are already
  // characterized by their own sections.
  return manifest(project).filter((line: string) => !before.has(line))
}


async function build(): Promise<string[]> {
  const out: string[] = [
    '# GENERATED by test/characterize.test.ts — see the header there.',
    '# Regenerate with: npm run golden',
    '',
  ]

  for (const t of shipped('target')) {
    out.push('## target ' + t)
    out.push(...await targetSection(t))
    out.push('')
  }

  for (const f of shipped('feature')) {
    out.push('## feature ' + f)
    out.push(...await featureSection(f))
    out.push('')
  }

  return out
}


describe('characterize add output', () => {

  test('matches the golden manifest', async () => {
    const got = await build()

    if (UPDATE) {
      Fs.mkdirSync(Path.dirname(GOLDEN), { recursive: true })
      Fs.writeFileSync(GOLDEN, got.join('\n') + '\n')
      return
    }

    ok(Fs.existsSync(GOLDEN),
      'no golden manifest at ' + GOLDEN + ' — generate it with: npm run golden')

    const want = Fs.readFileSync(GOLDEN, 'utf8').split('\n')
      .filter((l: string) => '' !== l.trim())
    const have = got.filter((l: string) => '' !== l.trim())

    if (want.join('\n') === have.join('\n')) {
      return
    }

    // Report the first differences by PATH rather than dumping thousands of
    // lines: which files moved is the actionable part.
    const wantSet = new Set(want)
    const haveSet = new Set(have)
    const added = have.filter((l) => !wantSet.has(l) && !l.startsWith('#'))
    const removed = want.filter((l) => !haveSet.has(l) && !l.startsWith('#'))

    const show = (label: string, lines: string[]) => 0 === lines.length ? [] :
      ['  ' + label + ' (' + lines.length + '):',
        ...lines.slice(0, 12).map((l) => '    ' + l),
      ...(12 < lines.length ? ['    ...'] : [])]

    deepStrictEqual(added.length + removed.length, 0,
      'add output changed:\n' +
      show('now written / changed', added).join('\n') + '\n' +
      show('no longer written as before', removed).join('\n') +
      '\n  If this change is intended, regenerate: npm run golden')
  })


  test('the manifest is machine-independent', async () => {
    // The property the whole file depends on: nothing in what an add writes
    // may name where this checkout lives.
    const project = makeProject({})
    await target_add([targetRef('ts')], project.actx)

    // Both separator spellings: on Windows the constants carry backslashes,
    // but a leaked value may have been normalised on the way in.
    const fwd = (p: string) => p.split(Path.sep).join('/')
    const needles = [PROJECT, SCAFFOLD, fwd(PROJECT), fwd(SCAFFOLD)]

    const leaks: string[] = []
    for (const rel of project.files()) {
      const content = String(project.fs.readFileSync(ROOT + '/' + rel))
      if (needles.some((n) => content.includes(n))) {
        leaks.push(rel)
      }
    }

    deepStrictEqual(leaks, [],
      'an add wrote this checkout\'s absolute path into the project, so the ' +
      'golden manifest cannot be reproduced on another machine')
  })
})
