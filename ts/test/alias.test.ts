// `target add <ref>~<alias>` — installing a target under a different name.
//
// WHAT WENT WRONG
//
// An alias renamed the two FOLDERS and nothing else, so every other thing
// that carries the name disagreed, and an aliased project did not work at
// all:
//
//   - the model file kept the ORIGIN basename (jostraca defaults a
//     single-file Copy's destination to the source's, and target add passed
//     no `to`), so `target add go~go2` wrote model/target/go.aontu while
//     target-index.aontu gained `@"go2.aontu"` — an include of a file that
//     does not exist, which fails the whole model compile, not just the
//     alias;
//   - the copied model still declared `main: kit: target: go:`, so the alias
//     either collided with its origin or declared a target nothing else
//     referenced;
//   - components kept the origin suffix (`src/cmp/go2/Main_go.ts`), and
//     components are dispatched by CONVENTION — `cmp/<t>/Main_<t>` — so
//     nothing in the aliased tree resolved;
//   - components name their origin INSIDE the file too: sibling imports
//     (`from './Package_go'`) and the fragment directory read through
//     __dirname (`/../../../src/cmp/go/fragment/`, in 67 shipped components).
//
// The alias is the documented escape hatch for two variants of one language
// (docs/how-to/add-a-target.md) and, going forward, for a name collision
// between an external package and a bundled target — so it has to produce a
// target that actually builds.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'

import { makeProject, targetRef, target_add, SCAFFOLD, ROOT } from './actionharness'


// Every file the scaffold ships for a target, relative to its cmp folder.
function scaffoldCmpFiles(target: string): string[] {
  const root = Path.join(SCAFFOLD, 'src', 'cmp', target)
  const out: string[] = []

  const walk = (dir: string, rel: string) => {
    for (const ent of Fs.readdirSync(dir, { withFileTypes: true })) {
      const childRel = '' === rel ? ent.name : rel + '/' + ent.name
      if (ent.isDirectory()) {
        walk(Path.join(dir, ent.name), childRel)
      }
      else {
        out.push(childRel)
      }
    }
  }

  walk(root, '')
  return out.sort()
}


async function addAlias(ref: string, alias: string) {
  const project = makeProject({})
  await target_add([targetRef(ref) + '~' + alias], project.actx)
  return project
}


describe('aliased target add', () => {

  test('the model file lands under the ALIAS name', async () => {
    const project = await addAlias('go', 'go2')
    const files = project.files()

    ok(files.includes('model/target/go2.aontu'),
      'no model/target/go2.aontu; got: ' +
      files.filter((f) => f.startsWith('model/target/')).join(', '))
    ok(!files.includes('model/target/go.aontu'),
      'the origin-named model file was written as well')
  })


  test('the index names a file that EXISTS', async () => {
    // The defect that broke the whole model, not just the alias: an index
    // entry with no file behind it.
    const project = await addAlias('go', 'go2')
    const index = project.fs.readFileSync(
      ROOT + '/model/target/target-index.aontu', 'utf8')

    ok(index.includes('@"go2.aontu"'), 'index does not name the alias')

    for (const m of String(index).matchAll(/@"([^"]+)"/g)) {
      ok(project.files().includes('model/target/' + m[1]),
        'target-index.aontu includes ' + m[1] + ', which was never written')
    }
  })


  test('the copied model DECLARES the alias', async () => {
    const project = await addAlias('go', 'go2')
    const src = project.fs.readFileSync(ROOT + '/model/target/go2.aontu', 'utf8')

    ok(/main:\s*kit:\s*target:\s*go2:/.test(src),
      'model does not declare `main: kit: target: go2:`')
    ok(!/main:\s*kit:\s*target:\s*go:/.test(src),
      'model still declares the ORIGIN target')
  })


  test('the per-target feature-deps slot moves with it', async () => {
    // Every shipped target model carries
    // `main: kit: feature: &: target: <t>: deps: &: { kind: ... }`. It
    // belongs to the installed target, so it has to be keyed by the alias.
    const project = await addAlias('go', 'go2')
    const src = project.fs.readFileSync(ROOT + '/model/target/go2.aontu', 'utf8')

    ok(/feature:\s*&:\s*target:\s*go2:/.test(src),
      'the feature-deps slot still names the origin target')
  })


  test('a QUOTED target key is rewritten too', async () => {
    // go-cli declares `main: kit: target: 'go-cli': {`. A rewrite that only
    // handled the bare form would leave a hyphenated target undeclared.
    const project = await addAlias('go-cli', 'cli2')
    const src = project.fs.readFileSync(ROOT + '/model/target/cli2.aontu', 'utf8')

    ok(/target:\s*'cli2':/.test(src),
      'quoted target key not rewritten: ' +
      String(src).split('\n').filter((l) => l.includes('target:')).slice(0, 3).join(' | '))
    ok(!/target:\s*'go-cli':/.test(src),
      'model still declares the origin target')
  })


  test('the target keeps its own VALUES', async () => {
    // The rewrite matches on `target: <name>:` rather than on the bare name,
    // so a value that happens to equal the target name (`ext: go`) survives.
    const project = await addAlias('go', 'go2')
    const src = project.fs.readFileSync(ROOT + '/model/target/go2.aontu', 'utf8')

    ok(/ext:\s*go\b/.test(src) && !/ext:\s*go2\b/.test(src),
      'the alias rewrite corrupted `ext`')
  })


  test('every component is renamed to the alias suffix', async () => {
    const project = await addAlias('go', 'go2')

    const got = project.files()
      .filter((f) => f.startsWith('src/cmp/go2/'))
      .map((f) => f.slice('src/cmp/go2/'.length))
      .sort()

    // The whole tree arrives, with `_go` -> `_go2` on the file NAME only.
    const want = scaffoldCmpFiles('go')
      .map((f) => f.replace(/_go(\.[^.]+)$/, '_go2$1'))
      .sort()

    deepStrictEqual(got, want, 'aliased cmp tree does not match the origin tree')

    ok(got.includes('Main_go2.ts'),
      'no Main_go2.ts — the `cmp/<t>/Main_<t>` dispatch cannot resolve')
    ok(!got.some((f) => /_go\.(ts|json)$/.test(f)),
      'a component kept the origin suffix')
  })


  test('the fragment folder is preserved, and its files are NOT renamed', async () => {
    // `Main.fragment.go` is language source, not a component: its `.go` is a
    // file extension, and renaming it would break the fragment reads.
    const project = await addAlias('go', 'go2')
    const frags = project.files()
      .filter((f) => f.startsWith('src/cmp/go2/fragment/'))

    ok(0 < frags.length, 'the fragment folder was not copied')
    ok(frags.some((f) => f.endsWith('Main.fragment.go')),
      'fragment files were renamed: ' + frags.join(', '))
  })


  test('sibling imports point at the aliased files', async () => {
    const project = await addAlias('go', 'go2')
    const main = project.fs.readFileSync(
      ROOT + '/src/cmp/go2/Main_go2.ts', 'utf8')

    ok(main.includes("from './Package_go2'"),
      'sibling import not rewritten: ' +
      String(main).split('\n').filter((l) => l.includes('import')).join(' | '))
    ok(!/_go['"]/.test(main), 'an origin-suffixed import survived')
  })


  test('the import QUOTE STYLE is preserved', async () => {
    // Regression: rewriting through jostraca's `replace` map canonicalises
    // each key into a regex group NAME, and `_go'` / `_go"` reduce to the
    // same one — so the double-quote entry won and every single-quoted
    // import came out as `from './Package_go2"`, which does not parse.
    const project = await addAlias('go', 'go2')
    const main = project.fs.readFileSync(
      ROOT + '/src/cmp/go2/Main_go2.ts', 'utf8')

    ok(!/'[^'\n]*_go2"/.test(main), 'an import quote was flipped to "')
    ok(!/"[^"\n]*_go2'/.test(main), "an import quote was flipped to '")
  })


  test('the fragment path points into the ALIAS folder', async () => {
    // The fragments are copied to the alias's folder. Left alone, the origin
    // path either misses or — if the origin target is ALSO installed —
    // silently reads that target's fragments.
    const project = await addAlias('go', 'go2')
    const main = project.fs.readFileSync(
      ROOT + '/src/cmp/go2/Main_go2.ts', 'utf8')

    ok(main.includes('src/cmp/go2/fragment/'),
      'fragment path not rewritten to the alias folder')
    ok(!main.includes('src/cmp/go/fragment/'),
      'fragment path still reads the origin folder')
  })


  test('a file EXTENSION matching the target name is untouched', async () => {
    const project = await addAlias('go', 'go2')
    const main = project.fs.readFileSync(
      ROOT + '/src/cmp/go2/Main_go2.ts', 'utf8')

    ok(main.includes('Main.fragment.go'),
      'the `.go` extension in the fragment filename was rewritten')
    ok(!main.includes('Main.fragment.go2'),
      'the fragment filename gained the alias suffix')
  })


  test('the template tree lands under the alias', async () => {
    const project = await addAlias('go', 'go2')
    const tm = project.files().filter((f) => f.startsWith('tm/go2/'))

    ok(0 < tm.length, 'no tm/go2 tree')
    ok(!project.files().some((f) => f.startsWith('tm/go/')),
      'the origin template tree was written as well')
  })


  test('the aliased model COMPILES, and declares the alias', async () => {
    // The end-to-end version of the claims above: a shipped target model is
    // self-contained (readTargetFeature parses each one standalone), so the
    // aliased copy must still compile and must define main.kit.target.<alias>
    // and nothing under the origin name.
    const project = await addAlias('go', 'go2')
    const src = project.fs.readFileSync(ROOT + '/model/target/go2.aontu', 'utf8')

    const errs: any[] = []
    const model = new Aontu().generate(src, {
      path: Path.join(SCAFFOLD, 'model', 'target', 'go2.aontu'), errs,
    })

    strictEqual(errs.length, 0, 'aliased model did not compile: ' +
      errs.map((e: any) => e.msg || String(e)).join(' | '))

    const targets = model?.main?.kit?.target || {}
    ok(null != targets.go2, 'compiled model has no `go2` target')
    ok(null == targets.go, 'compiled model still carries the origin `go` target')

    // And the values came through intact, not just the key.
    strictEqual(targets.go2.ext, 'go', 'the alias lost its `ext`')
  })


  // The control: an UNALIASED add is untouched by any of this — the goldens
  // in characterize.test.ts pin the byte-level version of this claim.
  test('an unaliased add still writes the origin names', async () => {
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)
    const files = project.files()

    ok(files.includes('model/target/go.aontu'), 'no model/target/go.aontu')
    ok(files.includes('src/cmp/go/Main_go.ts'), 'no src/cmp/go/Main_go.ts')
  })
})
