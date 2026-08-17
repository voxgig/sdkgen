// THE JUNK FILTER — what a developer's machine leaves in a tree, and what
// sdkgen must therefore refuse to see.
//
// The incident: a `tm/py/utility/__pycache__/make_options.cpython-314.pyc`,
// created by running that module in place, copied verbatim by `target add py`,
// and caught only by the golden manifest. Everything below is one of the two
// halves of the fix.
//
// THE FIRST HALF is that every walk drops it — the tree Copy, the aliased
// component walk that stands in for a Copy, the prune, doctor's drift walk, the
// feature scan, the definition listing. A filter applied by four of six places
// is worse than none: the writer and the reader then disagree about what a tree
// contains, which is the shape of drift doctor exists to report.
//
// THE SECOND HALF, and the reason the first test here matters most, is that the
// list must never match a file somebody meant. It is checked against every name
// in the shipped scaffold — 2,000-odd files across 27 targets — so a pattern
// broad enough to eat a template fails here, loudly, rather than silently
// dropping one file out of one language's SDK.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { isJunk, isNoise, JUNK, copyOpts } from '../dist/helpers/junk.js'
import { definitionNames } from '../dist/helpers/definition.js'
import { findFeatureEntries } from '../dist/helpers/featureSource.js'
import { doctor } from '../dist/action/doctor.js'

import {
  SCAFFOLD, PROJECT, ROOT, KIT, makeProject, target_add,
} from './actionharness'


// Junk of every family, planted at a path where it would really appear.
const PLANTED: Record<string, string> = {
  'tm/go/__pycache__/make_options.cpython-314.pyc': 'compiled\n',
  'tm/go/.DS_Store': 'finder\n',
  'tm/go/core/error.go.orig': 'conflicted\n',
  'tm/go/node_modules/left-pad/index.js': 'installed\n',
  'tm/go/.git/config': '[core]\n',
  'src/cmp/go/.DS_Store': 'finder\n',
  'src/cmp/go/__pycache__/Main_go.pyc': 'compiled\n',
}


// A package holding the real `go` target under its own name, with junk in it.
// The real target, as `packagecheck.test.ts` argues: a hand-built stub would
// pass what the shipped trees fail.
function makePackage(): string {
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-junk-'))
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'target'), { recursive: true })
  Fs.cpSync(Path.join(SCAFFOLD, 'src', 'cmp', 'go'),
    Path.join(sdk, 'src', 'cmp', 'go'), { recursive: true })
  Fs.cpSync(Path.join(SCAFFOLD, 'tm', 'go'),
    Path.join(sdk, 'tm', 'go'), { recursive: true })
  Fs.cpSync(Path.join(SCAFFOLD, 'model', 'target', 'go.aontu'),
    Path.join(sdk, 'model', 'target', 'go.aontu'))

  for (const [rel, content] of Object.entries(PLANTED)) {
    const path = Path.join(sdk, rel)
    Fs.mkdirSync(Path.dirname(path), { recursive: true })
    Fs.writeFileSync(path, content)
  }

  return dir
}


async function addFrom(dir: string, ref: string) {
  const project = makeProject({})
  await target_add([Path.join(dir, ref)], project.actx)
  return project
}


// The names a walk would have to have let through for the planted junk to
// arrive: matched loosely, because a copy renames nothing here.
const NEEDLES = [
  '__pycache__', '.DS_Store', '.orig', 'node_modules', '.git/', '.pyc',
]

function junkIn(files: string[]): string[] {
  return files.filter((f: string) => NEEDLES.some((n) => f.includes(n)))
}


describe('junk filter', () => {

  // THE test: an over-broad pattern is a silently dropped template.
  test('nothing in the shipped scaffold is junk', () => {
    const hits: string[] = []

    const walk = (dir: string, rel: string) => {
      for (const ent of Fs.readdirSync(dir, { withFileTypes: true })) {
        const childrel = '' === rel ? ent.name : rel + '/' + ent.name

        if (isJunk(ent.name)) {
          hits.push(childrel)
          continue
        }

        if (ent.isDirectory()) {
          walk(Path.join(dir, ent.name), childrel)
        }
      }
    }

    walk(PROJECT, '')

    deepStrictEqual(hits, [],
      'the junk filter matches a file the scaffold actually ships — that file ' +
      'would be dropped from every SDK generated from it')
  })


  test('it recognises what a machine leaves behind', () => {
    for (const name of [
      '__pycache__', 'make_options.cpython-314.pyc', '.DS_Store', 'node_modules',
      '.git', 'Main_go.ts~', '.#target.aontu', '#target.aontu#', '.error.go.swp',
      'error.go.orig', 'error.go.rej', 'Thumbs.db', '.venv', 'zig-out',
      '.pytest_cache', 'SDK.class', '_build', '.stack-work',
    ]) {
      ok(isJunk(name), 'not caught as junk: ' + name)
    }
  })


  test('it leaves alone what a template may be called', () => {
    // `target` is the one that would hurt most: it is cargo's and maven's
    // output directory AND sdkgen's own model directory for the kind.
    for (const name of [
      'target', 'build', 'dist', 'bin', 'out', 'obj', 'src', 'test', 'lib',
      '.gitignore', '.gitkeep', '.vscode', 'package.json', 'Main_go.ts',
      'go.mod', 'pyproject.toml', 'utility.py', 'sdk.gemspec',
    ]) {
      strictEqual(isJunk(name), false, 'wrongly treated as junk: ' + name)
    }
  })


  // The distinction the two lists exist for.
  test('build output is junk to copy and content to find', () => {
    strictEqual(isJunk('node_modules'), true)
    strictEqual(isNoise('node_modules'), false,
      'a destination holding node_modules would be read as empty')

    strictEqual(isNoise('.DS_Store'), true)
    strictEqual(isNoise('.git'), true)
  })


  // jostraca ≤0.31.0 merges this list over its own default with `deep()`,
  // which recursed into index 0 and kept the default there. Index 0 was
  // therefore a hole, and `copyOpts` fills it with the value already in it —
  // still pinned, because sdkgen runs against whatever jostraca a consumer
  // has installed.
  test('the copy ignore list survives jostracas merge', () => {
    const { ignore } = copyOpts().Copy

    strictEqual(String(ignore[0]), String(/~$/),
      'index 0 is discarded by the merge — whatever is there must be a no-op')
    strictEqual(ignore.length, JUNK.length + 1)
  })


  describe('nothing junk reaches a project', () => {

    test('target add copies none of it', async () => {
      const dir = makePackage()
      try {
        const project = await addFrom(dir, 'go')
        const files = project.files()

        deepStrictEqual(junkIn(files), [],
          'target add copied junk out of the scaffold')

        // The copy still happened — the assertion above would also pass on an
        // add that wrote nothing at all.
        ok(20 < files.length, 'target add wrote almost nothing: ' + files.length)
        ok(files.includes('tm/go/core/error.go'), 'the real templates are missing')
      }
      finally {
        Fs.rmSync(dir, { recursive: true, force: true })
      }
    })


    test('an ALIASED add copies none of it either', async () => {
      // The aliased component tree is emitted file by file by sdkgen rather
      // than by jostraca's Copy — a second walk, and so a second chance to
      // ship a maintainer's `__pycache__`.
      const dir = makePackage()
      try {
        const project = await addFrom(dir, 'go~go2')
        const files = project.files()

        deepStrictEqual(junkIn(files), [],
          'the aliased component walk copied junk out of the scaffold')

        ok(files.includes('src/cmp/go2/Main_go2.ts'),
          'the aliased components are missing')
      }
      finally {
        Fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })


  // The prune's remit is the tree it WRITES, not the tree it finds.
  test('the template prune does not delete a projects own junk', async () => {
    const dir = makePackage()
    try {
      const project = await addFrom(dir, 'go')

      const own = ROOT + '/tm/go/__pycache__/utility.cpython-314.pyc'
      project.fs.mkdirSync(ROOT + '/tm/go/__pycache__', { recursive: true })
      project.fs.writeFileSync(own, 'the users own\n')

      // A resync: the prune runs and removes what the scaffold no longer has.
      await target_add([Path.join(dir, 'go')], project.actx)

      ok(project.fs.existsSync(own),
        'target add deleted a file in the project that it never wrote')
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  // The reader half: what the writer refuses to copy, doctor must refuse to
  // miss, or every project reports the scaffold's junk as missing forever.
  test('doctor reports no drift for junk on either side', async () => {
    const dir = makePackage()
    try {
      const project = await addFrom(dir, 'go')

      project.actx.model.main[KIT].target.go = {
        name: 'go', base: Path.join(dir, '.sdk'),
      }

      // Junk on the PROJECT side too, which is the other way round: a file
      // doctor finds and the scaffold does not have.
      project.fs.mkdirSync(ROOT + '/tm/go/__pycache__', { recursive: true })
      project.fs.writeFileSync(
        ROOT + '/tm/go/__pycache__/utility.cpython-314.pyc', 'local\n')
      project.fs.writeFileSync(ROOT + '/tm/go/.DS_Store', 'finder\n')

      const { report }: any = await doctor(project.actx)

      deepStrictEqual(junkIn(report.missing), [],
        'doctor asked for the scaffolds junk to be copied into the project')
      deepStrictEqual(junkIn(report.stale), [],
        'doctor reported the projects own junk as stale')
      strictEqual(report.ok, true, 'junk alone made doctor report drift')
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('a feature container of junk holds no features', () => {
    const dir = makePackage()
    try {
      // `find` is the shape `package check` uses to report strays, so junk
      // here becomes an unknown feature called `__pycache__`.
      const tm = Path.join(dir, '.sdk', 'tm', 'go')
      const cache = Path.join(tm, 'feature', '__pycache__')
      Fs.mkdirSync(cache, { recursive: true })
      Fs.writeFileSync(Path.join(cache, 'retry.cpython-314.pyc'), 'compiled\n')
      Fs.writeFileSync(Path.join(tm, 'feature', '.DS_Store'), 'finder\n')

      const names = findFeatureEntries(Fs, tm, new Set(['retry']))
        .map((e: any) => e.name)

      // Named literally, not filtered through `isJunk` — a test that asks the
      // function under test what to expect passes however that function is
      // broken.
      deepStrictEqual(
        names.filter((n: string) => '__pycache__' === n || '.DS_Store' === n),
        [], 'junk in a feature directory was read as a feature')
      ok(names.includes('retry'), 'the real features stopped being found')
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('an editor lock beside a definition is not an item', () => {
    const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-junk-def-'))
    try {
      const kind = Path.join(dir, 'model', 'target')
      Fs.mkdirSync(kind, { recursive: true })
      Fs.writeFileSync(Path.join(kind, 'target-index.aontu'), '# Targets\n')
      Fs.writeFileSync(Path.join(kind, 'go.aontu'), '\n')
      // What emacs leaves while the file is open.
      Fs.writeFileSync(Path.join(kind, '.#go.aontu'), 'lock\n')

      deepStrictEqual(definitionNames(Fs, dir, 'target'), ['go'])
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
