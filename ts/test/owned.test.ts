
import { test, describe } from 'node:test'
import { ok, strictEqual, rejects, match } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { resolveSource } from '../dist/action/resolve.js'
import { kind_remove } from '../dist/action/remove.js'
import {
  SCAFFOLD_BASE, ROOT, makeProject, targetRef, target_add, feature_add,
  recordLog,
} from './actionharness'


// A feature and a target that no package provides: the project defines them
// in its own `.sdk`, which is where they are customised and kept.
const STAMP_MODEL =
  '\nmain: kit: feature: stamp: {\n  name: key()\n  title: "Stamp"\n' +
  "  version: '0.0.1'\n  active: true\n" +
  '  config: options: active: false\n  hook: {}\n}\n'

const STAMP_GO = 'package feature\n\n// stamp, as this project wrote it\n'

const BASH_MODEL =
  "\nmain: kit: target: bash: {\n  title: 'Bash'\n  ext: sh\n" +
  "  comment: line: \"#\"\n  module: name: 'demo'\n}\n"


function write(project: any, rel: string, content: string) {
  const path = Path.join(ROOT, rel)
  project.fs.mkdirSync(Path.dirname(path), { recursive: true })
  project.fs.writeFileSync(path, content)
}


function read(project: any, rel: string): string {
  return String(project.fs.readFileSync(Path.join(ROOT, rel), 'utf8'))
}


async function stampProject(log?: any) {
  const project = makeProject({ log })
  await target_add([targetRef('go')], project.actx)
  project.actx.model.main.kit.target.go = { name: 'go', base: SCAFFOLD_BASE }
  write(project, 'model/feature/stamp.aontu', STAMP_MODEL)
  write(project, 'tm/go/feature/stamp_feature.go', STAMP_GO)
  return project
}


describe('a feature the project defines', () => {

  test('feature add registers it and leaves its files as written', async () => {
    const log = recordLog()
    const project = await stampProject(log)

    await feature_add(['stamp'], project.actx)

    match(read(project, 'model/feature/feature-index.aontu'), /stamp\.aontu/)
    strictEqual(read(project, 'model/feature/stamp.aontu'), STAMP_MODEL)
    strictEqual(read(project, 'tm/go/feature/stamp_feature.go'), STAMP_GO)
    ok(log.lines.some((l: any) => 'feature-owned' === l.point))
    ok(!log.lines.some((l: any) => 'feature-source-unresolved' === l.point))
  })


  // The prune deletes what the target's source does not ship, and this file
  // was never in it.
  test('target add keeps its source in the target tree', async () => {
    const project = await stampProject()
    project.actx.model.main.kit.feature = {
      stamp: { name: 'stamp', active: true },
    }

    await target_add([targetRef('go')], project.actx)

    strictEqual(read(project, 'tm/go/feature/stamp_feature.go'), STAMP_GO)
  })


  test('feature remove refuses to delete it without --force', async () => {
    const project = await stampProject()
    await feature_add(['stamp'], project.actx)

    await rejects(
      () => kind_remove('feature', ['stamp'], project.actx),
      (err: any) => {
        match(String(err.message), /defined in this project/)
        return true
      })
    strictEqual(read(project, 'tm/go/feature/stamp_feature.go'), STAMP_GO)

    project.actx.flags = { force: true }
    await kind_remove('feature', ['stamp'], project.actx)
    ok(!project.fs.existsSync(ROOT + '/tm/go/feature/stamp_feature.go'))
  })
})


describe('a target the project defines', () => {

  test('target add registers it and copies nothing', async () => {
    const project = makeProject({})
    write(project, 'model/target/bash.aontu', BASH_MODEL)
    write(project, 'src/cmp/bash/Main_bash.ts', 'export {}\n')
    write(project, 'tm/bash/core.sh', 'echo core\n')
    const before = project.files()

    await target_add(['bash'], project.actx)

    match(read(project, 'model/target/target-index.aontu'), /bash\.aontu/)
    strictEqual(read(project, 'model/target/bash.aontu'), BASH_MODEL)
    strictEqual(read(project, 'tm/bash/core.sh'), 'echo core\n')
    // `target add` still installs the `test` feature every target needs.
    const added = project.files().filter((f: string) => !before.includes(f))
    ok(!added.some((f: string) => /^(src\/cmp|tm)\//.test(f)), added.join(', '))
  })


  test('a name nothing defines still fails', async () => {
    const project = makeProject({})
    await rejects(() => target_add(['nosuch'], project.actx),
      /Target definition not found/)
  })
})


describe('a package folder inside the project', () => {

  function layout() {
    const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-owned-'))
    const sdk = Path.join(tmp, 'proj', '.sdk')
    for (const dir of [
      Path.join(sdk, 'node_modules', '@voxgig', 'sdkgen', 'project', '.sdk'),
      Path.join(tmp, 'proj', 'ext', '.sdk', 'model', 'target'),
      Path.join(tmp, 'acme', '.sdk', 'model', 'target'),
    ]) {
      Fs.mkdirSync(dir, { recursive: true })
    }
    for (const pkg of [Path.join(tmp, 'proj', 'ext'), Path.join(tmp, 'acme')]) {
      Fs.writeFileSync(Path.join(pkg, '.sdk', 'model', 'target', 'bash.aontu'),
        BASH_MODEL)
    }
    return { tmp, ctx$: { folder: sdk, fs: () => Fs } }
  }


  test('is refused, pointing at .sdk', () => {
    const { tmp, ctx$ } = layout()
    try {
      let err: any
      try {
        resolveSource('../ext/bash', 'target', ctx$)
      }
      catch (e: any) {
        err = e
      }
      match(String(err?.message), /inside this project/)
      match(String(err?.message), /model\/target\/bash\.aontu/)
    }
    finally {
      Fs.rmSync(tmp, { recursive: true, force: true })
    }
  })


  test('a checkout beside the project is still a source', () => {
    const { tmp, ctx$ } = layout()
    try {
      const source = resolveSource('../../acme/bash', 'target', ctx$)
      strictEqual(source.folder, Path.join(tmp, 'acme', '.sdk'))
      ok(!source.owned)
    }
    finally {
      Fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
})
