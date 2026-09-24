import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects, match } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { kind_remove } from '../dist/action/remove.js'
import { action_target } from '../dist/action/target.js'
import { action_feature } from '../dist/action/feature.js'
import { action_edition, edition_add } from '../dist/action/edition.js'
import { doctor } from '../dist/action/doctor.js'
import {
  SCAFFOLD_BASE, ROOT, KIT, makeProject, targetRef, target_add, feature_add,
  recordLog,
} from './actionharness'


// A project with `go` added, its model declaring the target the way
// `target add` records it, so doctor can find the scaffold it came from.
async function addedProject(opts: { feature?: Record<string, any>, log?: any } = {}) {
  const project = makeProject({ feature: opts.feature ?? {}, log: opts.log })

  await target_add([targetRef('go')], project.actx)

  project.actx.model.main[KIT].target.go = { name: 'go', base: SCAFFOLD_BASE }

  return project
}


function has(project: any, rel: string): boolean {
  return project.fs.existsSync(Path.join(ROOT, rel))
}


function read(project: any, rel: string): string {
  return String(project.fs.readFileSync(Path.join(ROOT, rel), 'utf8'))
}


function write(project: any, rel: string, content: string) {
  const path = Path.join(ROOT, rel)
  project.fs.mkdirSync(Path.dirname(path), { recursive: true })
  project.fs.writeFileSync(path, content)
}


describe('target remove', () => {

  // A name, never a path. Path.join NORMALISES a traversal instead of
  // refusing it, so `go/../go` arrived at planning indistinguishable from
  // `go` and would have deleted the real target under a name nobody typed;
  // the second shape points outside the project altogether.
  for (const bad of ['go/../go', '../../model/target/go']) {
    test('refuses a name that is a path: ' + bad, async () => {
      const project = await addedProject()
      const before = project.vol.toJSON()

      await rejects(
        () => kind_remove('target', [bad], project.actx),
        (err: any) => {
          match(String(err.message), /Invalid target name/)
          match(String(err.message), /it is not a path/)
          return true
        })

      // Nothing planned, so nothing gone — the real target included.
      deepStrictEqual(project.vol.toJSON(), before)
      ok(has(project, 'tm/go/Makefile'))
    })
  }


  // --force is not a way past the grammar: it governs what may be DELETED,
  // and this name never reaches a plan to force.
  test('--force does not excuse a name that is a path', async () => {
    const project = await addedProject()
    project.actx.flags = { force: true }
    const before = project.vol.toJSON()

    await rejects(
      () => kind_remove('target', ['go/../go'], project.actx),
      /Invalid target name/)
    deepStrictEqual(project.vol.toJSON(), before)
  })


  test('refuses an edited alias model, and --force deletes it', async () => {
    const project = makeProject()
    await target_add([targetRef('go') + '~custom'], project.actx)
    project.actx.model.main[KIT].target.custom = {
      name: 'custom', origname: 'go', base: SCAFFOLD_BASE,
    }

    const model = 'model/target/custom.aontu'
    write(project, model, read(project, model) +
      '\nmain: kit: target: custom: publish: version: "9.9.9"\n')
    const before = project.vol.toJSON()

    await rejects(
      () => kind_remove('target', ['custom'], project.actx),
      (err: any) => {
        match(String(err.message), /model\/target\/custom\.aontu/)
        // Its own advice: the standard line names .sdk/model/, which is
        // where this file already is.
        match(String(err.message), /ALIAS's own model file/)
        return true
      })
    deepStrictEqual(project.vol.toJSON(), before)

    project.actx.flags = { force: true }
    await kind_remove('target', ['custom'], project.actx)
    strictEqual(has(project, model), false)
  })


  for (const edited of [false, true]) {
    test('external feature source: ' + (edited ? 'refuses edits' : 'removes clean copies'),
      async () => {
        const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-remove-feature-'))
        const sdk = Path.join(dir, '.sdk')
        try {
          Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })
          Fs.mkdirSync(Path.join(sdk, 'tm', 'go', 'feature'), { recursive: true })
          Fs.writeFileSync(Path.join(sdk, 'model', 'feature', 'external.aontu'),
            'main: kit: feature: external: { name: external, active: true, base: "BASE" }\n')
          Fs.writeFileSync(Path.join(sdk, 'tm', 'go', 'feature', 'external_feature.go'),
            'package feature\n')
          Fs.writeFileSync(Path.join(dir, 'sdkgen-package.json'), JSON.stringify({
            sdkgen: { package: 1 }, name: '@acme/sdkgen-external', version: '1.0.0',
            provides: { feature: ['external'] },
          }))

          const project = await addedProject()
          await feature_add([Path.join(dir, 'external')], project.actx)
          project.actx.model.main[KIT].feature.external = {
            name: 'external', origname: 'external', base: sdk, active: true,
          }
          const source = 'tm/go/feature/external_feature.go'
          ok(has(project, source))

          const model = 'model/feature/external.aontu'
          write(project, model, read(project, model) + '\n# project customization\n')
          const keptModel = read(project, model)

          if (edited) {
            write(project, source, read(project, source) + '// project customization\n')
            const before = project.vol.toJSON()
            await rejects(
              () => kind_remove('target', ['go'], project.actx),
              /tm\/go\/feature\/external_feature\.go/)
            deepStrictEqual(project.vol.toJSON(), before)
            project.actx.flags = { force: true }
          }

          await kind_remove('target', ['go'], project.actx)
          strictEqual(has(project, source), false)
          strictEqual(read(project, model), keptModel)
        }
        finally {
          Fs.rmSync(dir, { recursive: true, force: true })
        }
      })
  }

  test('removes exactly what target add wrote', async () => {
    const project = await addedProject()

    ok(has(project, 'src/cmp/go/Main_go.ts'))
    ok(has(project, 'tm/go/core/error.go'))
    ok(has(project, 'model/target/go.aontu'))
    match(read(project, 'model/target/target-index.aontu'), /go\.aontu/)

    const res: any = await kind_remove('target', ['go'], project.actx)

    strictEqual(has(project, 'src/cmp/go'), false, 'components remain')
    strictEqual(has(project, 'tm/go'), false, 'templates remain')
    strictEqual(has(project, 'model/target/go.aontu'), false, 'model file remains')
    ok(!/go\.aontu/.test(read(project, 'model/target/target-index.aontu')),
      'the index entry remains')
    ok(has(project, 'model/feature/test.aontu'), 'the test feature must stay')

    strictEqual(project.actx.model.main[KIT].target.go, undefined,
      'the in-memory model still declares the target')

    ok(res.report.ok)
    ok(0 < res.report.removed.length)
    deepStrictEqual(res.report.refused, [])

    // The inverse of add: nothing left for doctor to see.
    const after: any = await doctor(project.actx)
    deepStrictEqual(after.report.stale, [])
    deepStrictEqual(after.report.forked, [])
  })


  test('refuses a forked component, and --force deletes it', async () => {
    const project = await addedProject()

    write(project, 'src/cmp/go/Main_go.ts', '// forked\n')

    await rejects(
      () => kind_remove('target', ['go'], project.actx),
      (err: any) => {
        match(err.message, /refusing to delete what `target add` did not write/)
        match(err.message, /src\/cmp\/go\/Main_go\.ts/)
        return true
      })

    ok(has(project, 'src/cmp/go/Main_go.ts'), 'a refusal must delete nothing')
    ok(has(project, 'tm/go/core/error.go'), 'a refusal must delete nothing')
    ok(has(project, 'model/target/go.aontu'), 'a refusal must delete nothing')

    project.actx.flags = { force: true }
    await kind_remove('target', ['go'], project.actx)

    strictEqual(has(project, 'src/cmp/go'), false)
    strictEqual(has(project, 'model/target/go.aontu'), false)
  })


  test('refuses an unrecognised file in a tree it owns', async () => {
    const project = await addedProject()

    write(project, 'tm/go/utility/mine.go', 'package utility\n')

    await rejects(
      () => kind_remove('target', ['go'], project.actx),
      /tm\/go\/utility\/mine\.go/)

    ok(has(project, 'tm/go/utility/mine.go'))
  })


  test('refuses a project-owned additive component', async () => {
    const project = await addedProject()

    write(project, 'src/cmp/go/Extra_go.ts', 'export const Extra = 1\n')

    await rejects(
      () => kind_remove('target', ['go'], project.actx),
      /src\/cmp\/go\/Extra_go\.ts/)
  })


  test('a dry run writes nothing and lists everything', async () => {
    const log = recordLog()
    const project = await addedProject({ log })
    project.actx.opts.dryrun = true

    const res: any = await kind_remove('target', ['go'], project.actx)

    ok(has(project, 'src/cmp/go/Main_go.ts'))
    ok(has(project, 'tm/go/core/error.go'))
    ok(has(project, 'model/target/go.aontu'))
    match(read(project, 'model/target/target-index.aontu'), /go\.aontu/)
    ok(null != project.actx.model.main[KIT].target.go,
      'a dry run must not touch the in-memory model')

    ok(res.report.dryrun)
    ok(res.report.removed.includes('src/cmp/go/Main_go.ts'))
    ok(res.report.removed.includes('model/target/go.aontu'))

    const listed = log.lines.filter((l: any) => 'remove-file' === l.point)
    ok(listed.every((l: any) => true === l.dryrun && /^would remove/.test(l.note)))
    ok(listed.some((l: any) => /index entry/.test(l.note)))
  })


  test('generated output is kept unless --delete-output', async () => {
    const project = await addedProject({ log: recordLog() })

    write(project, '../go/go.mod', 'module demo\n')

    const kept: any = await kind_remove('target', ['go'], project.actx)
    ok(has(project, '../go/go.mod'), 'output was deleted without the flag')
    ok(kept.report.notes.some((n: string) => /--delete-output/.test(n)),
      'the kept output must be said out loud')

    const again = await addedProject()
    write(again, '../go/go.mod', 'module demo\n')
    again.actx.flags = { deleteOutput: true }

    await kind_remove('target', ['go'], again.actx)
    strictEqual(has(again, '../go/go.mod'), false)
    strictEqual(has(again, '../go'), false)
  })


  test('a target that is not installed is an error', async () => {
    const project = makeProject()

    await rejects(
      () => kind_remove('target', ['rb'], project.actx),
      /target not installed: rb/)
  })


  test('a source that cannot be found needs --force', async () => {
    const project = await addedProject()

    // Recorded as coming from an uninstalled package.
    project.actx.model.main[KIT].target.go = {
      name: 'go', base: 'node_modules/@acme/gone/.sdk', package: '@acme/gone',
    }

    await rejects(
      () => kind_remove('target', ['go'], project.actx),
      /source not found/)

    project.actx.flags = { force: true }
    await kind_remove('target', ['go'], project.actx)
    strictEqual(has(project, 'model/target/go.aontu'), false)
  })


  test('the project model is reported when it still declares the target', async () => {
    const project = await addedProject()

    write(project, 'model/sdk.aontu',
      "name: 'demo'\n" +
      '@"./target/target-index.aontu"\n' +
      '@"./feature/feature-index.aontu"\n' +
      "main: kit: target: go: publish: version: '1.0.0'\n")

    const res: any = await kind_remove('target', ['go'], project.actx)
    ok(res.report.notes.some((n: string) =>
      /model\/sdk\.aontu still declares main\.kit\.target\.go/.test(n)), res.report.notes)
  })


  test('dispatches through the target action', async () => {
    const project = await addedProject()

    await action_target(['target', 'remove', 'go'], project.actx)
    strictEqual(has(project, 'model/target/go.aontu'), false)
  })
})


describe('feature remove', () => {

  test('removes the feature source from every target, the model and the index', async () => {
    const project = await addedProject({ feature: { log: { active: true } } })
    await feature_add(['log'], project.actx)

    ok(has(project, 'tm/go/feature/log_feature.go'))
    ok(has(project, 'model/feature/log.aontu'))
    match(read(project, 'model/feature/feature-index.aontu'), /log\.aontu/)

    await kind_remove('feature', ['log'], project.actx)

    strictEqual(has(project, 'tm/go/feature/log_feature.go'), false)
    strictEqual(has(project, 'model/feature/log.aontu'), false)
    ok(!/log\.aontu/.test(read(project, 'model/feature/feature-index.aontu')))
    ok(has(project, 'tm/go/feature/test_feature.go'), 'another feature went too')
    ok(has(project, 'tm/go/feature/base_feature.go'), 'base went too')
    strictEqual(project.actx.model.main[KIT].feature.log, undefined)
  })


  // Deactivating a feature is how a project stops shipping it without
  // deleting it, so `feature remove` is the next thing anyone runs.
  test('removes a feature the project deactivated', async () => {
    const project = await addedProject({ feature: { log: { active: true } } })
    await feature_add(['log'], project.actx)
    ok(has(project, 'tm/go/feature/log_feature.go'))

    project.actx.model.main[KIT].feature.log.active = false

    await kind_remove('feature', ['log'], project.actx)

    strictEqual(has(project, 'tm/go/feature/log_feature.go'), false)
    strictEqual(has(project, 'model/feature/log.aontu'), false)
    ok(has(project, 'tm/go/feature/base_feature.go'), 'base went too')
  })


  // And the protection survives: deactivated is not a way past the edit
  // check, or a project's own work would go silently on the next remove.
  test('still refuses an edited source in a deactivated feature', async () => {
    const project = await addedProject({ feature: { log: { active: true } } })
    await feature_add(['log'], project.actx)

    write(project, 'tm/go/feature/log_feature.go', '// project customization\n')
    project.actx.model.main[KIT].feature.log.active = false
    const before = project.vol.toJSON()

    await rejects(
      () => kind_remove('feature', ['log'], project.actx),
      /tm\/go\/feature\/log_feature\.go/)
    deepStrictEqual(project.vol.toJSON(), before)

    project.actx.flags = { force: true }
    await kind_remove('feature', ['log'], project.actx)
    strictEqual(has(project, 'tm/go/feature/log_feature.go'), false)
  })


  test('refuses an edited feature source', async () => {
    const project = await addedProject({ feature: { log: { active: true } } })
    await feature_add(['log'], project.actx)

    write(project, 'tm/go/feature/log_feature.go', '// edited\n')

    await rejects(
      () => kind_remove('feature', ['log'], project.actx),
      /tm\/go\/feature\/log_feature\.go/)

    ok(has(project, 'model/feature/log.aontu'))
  })


  test('the test feature cannot be removed', async () => {
    const project = await addedProject()

    await rejects(
      () => kind_remove('feature', ['test'], project.actx),
      /`test` cannot be removed/)

    ok(has(project, 'model/feature/test.aontu'))
  })


  test('dispatches through the feature action', async () => {
    const project = await addedProject({ feature: { log: { active: true } } })
    await feature_add(['log'], project.actx)

    await action_feature(['feature', 'remove', 'log'], project.actx)
    strictEqual(has(project, 'model/feature/log.aontu'), false)
  })
})


describe('edition remove', () => {

  function makePackage(): string {
    const name = 'summary'
    const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-remove-'))
    const sdk = Path.join(dir, '.sdk')

    Fs.mkdirSync(Path.join(sdk, 'model', 'edition'), { recursive: true })
    Fs.mkdirSync(Path.join(sdk, 'src', 'cmp', 'edition', name), { recursive: true })
    Fs.mkdirSync(Path.join(sdk, 'tm', 'edition', name), { recursive: true })

    Fs.writeFileSync(Path.join(sdk, 'model', 'edition', name + '.aontu'),
      `main: kit: doc: edition: ${name}: {\n  title: 'API edition'\n  base: 'BASE'\n}\n`)
    Fs.writeFileSync(
      Path.join(sdk, 'src', 'cmp', 'edition', name, 'Main_' + name + '.ts'),
      'const Main = 1\nexport { Main }\n')
    Fs.writeFileSync(Path.join(sdk, 'tm', 'edition', name, 'site.md'),
      '# ProjectName edition\n')
    Fs.writeFileSync(Path.join(dir, 'sdkgen-package.json'), JSON.stringify({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-edition', version: '1.0.0',
      provides: { edition: [name] },
    }))

    return dir
  }


  test('removes the trees, the model and the index entry', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await edition_add([Path.join(pkg, 'summary')], project.actx)

      ok(has(project, 'src/cmp/edition/summary/Main_summary.ts'))
      ok(has(project, 'tm/edition/summary/site.md'))
      ok(has(project, 'model/edition/summary.aontu'))

      await action_edition(['edition', 'remove', 'summary'], project.actx)

      strictEqual(has(project, 'src/cmp/edition/summary'), false)
      strictEqual(has(project, 'tm/edition/summary'), false)
      strictEqual(has(project, 'model/edition/summary.aontu'), false)
      ok(!/summary\.aontu/.test(read(project, 'model/edition/edition-index.aontu')))
      strictEqual(project.actx.model.main[KIT].doc.edition.summary, undefined)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('refuses an edited template master', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject()
      await edition_add([Path.join(pkg, 'summary')], project.actx)

      write(project, 'tm/edition/summary/site.md', '# mine\n')

      await rejects(
        () => kind_remove('edition', ['summary'], project.actx),
        /tm\/edition\/summary\/site\.md/)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })
})
