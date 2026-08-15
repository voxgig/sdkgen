// `package add` / `package list`.
//
// WHAT THIS VERB HAS TO GET RIGHT
//
// It installs several things in a loop, so its failure mode is the
// HALF-INSTALLED project: item four turns out not to be in the package, and
// the first three are already written with a partial index. Everything below
// is ultimately about that — validate the whole claim before writing
// anything, and refuse a typo'd `--only` rather than quietly installing less
// than asked.
//
// It is deliberately NOT a new copy pipeline: it builds the same refs a hand
// typed `target add` would take and hands them to the same action, so
// provenance, index handling, the feature fan-out and dry run come along
// unchanged. The tests check that equivalence directly.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, rejects } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { package_add, action_package } from '../dist/action/package.js'
import { ACTION_MAP, actionNames } from '../dist/action/dispatch.js'
import {
  SCAFFOLD, ROOT, makeProject, recordLog, targetRef, target_add, feature_add,
} from './actionharness'


// A package providing one target (the bundled `go`, renamed) and one feature
// (the bundled `retry`). That is the shape of a real language package: it
// implements the standard feature set rather than redefining it, and here it
// also ships one feature of its own so both kinds are exercised.
function makePackage(manifest?: any): string {
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-pkg-'))
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(Path.join(sdk, 'model', 'target'), { recursive: true })
  Fs.mkdirSync(Path.join(sdk, 'model', 'feature'), { recursive: true })

  Fs.cpSync(Path.join(SCAFFOLD, 'src', 'cmp', 'go'),
    Path.join(sdk, 'src', 'cmp', 'iotgo'), { recursive: true })
  Fs.cpSync(Path.join(SCAFFOLD, 'tm', 'go'),
    Path.join(sdk, 'tm', 'iotgo'), { recursive: true })

  Fs.writeFileSync(Path.join(sdk, 'model', 'target', 'iotgo.aontu'),
    Fs.readFileSync(Path.join(SCAFFOLD, 'model', 'target', 'go.aontu'), 'utf8')
      .replace(/target: go:/g, 'target: iotgo:'))

  Fs.cpSync(Path.join(SCAFFOLD, 'model', 'feature', 'retry.aontu'),
    Path.join(sdk, 'model', 'feature', 'retry.aontu'))

  // Components are dispatched by convention, so their names follow the target.
  const cmpdir = Path.join(sdk, 'src', 'cmp', 'iotgo')
  for (const f of Fs.readdirSync(cmpdir)) {
    if (f.endsWith('_go.ts')) {
      Fs.renameSync(Path.join(cmpdir, f),
        Path.join(cmpdir, f.replace(/_go\.ts$/, '_iotgo.ts')))
    }
  }

  Fs.writeFileSync(Path.join(dir, 'sdkgen-package.json'),
    JSON.stringify(manifest ?? {
      sdkgen: { package: 1 },
      name: '@acme/sdkgen-iot',
      version: '1.4.0',
      provides: { target: ['iotgo'], feature: ['retry'] },
    }, null, 2))

  return dir
}


async function addPackage(
  pkg: string, flags: any = {}, opts: any = {},
): Promise<any> {
  const project = makeProject(opts)
  project.actx.flags = flags
  await package_add([pkg], project.actx)
  return project
}


describe('package add', () => {

  test('installs everything the manifest provides', async () => {
    const pkg = makePackage()
    try {
      const project = await addPackage(pkg)
      const files = project.files()

      ok(files.includes('model/target/iotgo.aontu'), 'the target is missing')
      ok(files.includes('model/feature/retry.aontu'), 'the feature is missing')
      ok(files.some((f: string) => f.startsWith('src/cmp/iotgo/')),
        'no components were copied')
      ok(files.some((f: string) => f.startsWith('tm/iotgo/')),
        'no templates were copied')

      // Both index files list what was installed, or the model will not
      // compile the new items in at all.
      const tindex = String(project.fs.readFileSync(
        ROOT + '/model/target/target-index.aontu', 'utf8'))
      ok(tindex.includes('@"iotgo.aontu"'), 'target index: ' + tindex)

      const findex = String(project.fs.readFileSync(
        ROOT + '/model/feature/feature-index.aontu', 'utf8'))
      ok(findex.includes('@"retry.aontu"'), 'feature index: ' + findex)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('records the package as provenance', async () => {
    // The point of the whole manifest: an installed item says which package
    // supplied it, so `package update` has something to act on.
    const pkg = makePackage()
    try {
      const project = await addPackage(pkg)

      const src = String(project.fs.readFileSync(
        ROOT + '/model/target/iotgo.aontu', 'utf8'))

      ok(src.includes("package: '@acme/sdkgen-iot'"),
        'no package provenance recorded:\n' + src.split('\n').slice(0, 12).join('\n'))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('is EQUIVALENT to adding the items by hand', async () => {
    // The design's central claim: `package add` is not a second pipeline. If
    // the two ever produce different trees, one of them is wrong and nobody
    // would know which.
    const pkg = makePackage()
    try {
      const viaPackage = await addPackage(pkg)

      // The same two items, in the same order, as a user would type them.
      const byHand = makeProject({})
      await target_add([Path.join(pkg, 'iotgo')], byHand.actx)
      byHand.actx.model.main.kit.target = {
        iotgo: { name: 'iotgo', base: Path.join(pkg, '.sdk') },
      }
      await feature_add([Path.join(pkg, 'retry')], byHand.actx)

      deepStrictEqual(viaPackage.files(), byHand.files(),
        '`package add` and the equivalent hand-typed adds wrote ' +
        'different trees')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('TARGETS before features', async () => {
    // `feature add` fans a feature's source out across the targets already in
    // the model, so a feature installed first would find none of the
    // package's own targets and silently ship no source for them.
    const pkg = makePackage()
    try {
      const log = recordLog()
      const project = await addPackage(pkg, {}, { log })

      ok(project.files().some(
        (f: string) => f.includes('tm/iotgo/') && f.includes('retry')),
        'no retry source landed in the package\'s own target: ' +
        project.files().filter((f: string) => f.includes('retry')).join(', '))

      ok(!log.lines.some((l: any) => 'feature-source-missing' === l.point &&
        'iotgo' === l.target),
        'the feature was installed before the target it needed')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })
})


describe('package add: refusing before writing', () => {

  test('a manifest that LIES fails, having written nothing', async () => {
    const pkg = makePackage({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-iot',
      provides: { target: ['iotgo', 'ghost'] },
    })
    try {
      const project = makeProject({})
      project.actx.flags = {}

      await rejects(() => package_add([pkg], project.actx),
        /does not match the package/)

      // THE point of validating first: `iotgo` is listed before `ghost` and
      // is perfectly installable, so a loop that validated per item would
      // have written it and then thrown.
      deepStrictEqual(
        project.files().filter((f: string) => f.includes('iotgo')), [],
        'a partial install was left behind')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('no manifest says which command to use instead', async () => {
    const pkg = makePackage()
    try {
      Fs.rmSync(Path.join(pkg, 'sdkgen-package.json'))

      const project = makeProject({})
      project.actx.flags = {}

      await rejects(() => package_add([pkg], project.actx),
        /No package manifest[\s\S]*target add/,
        'the error did not point at the direct-ref alternative')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('an unresolvable package lists where it looked', async () => {
    const project = makeProject({})
    project.actx.flags = {}

    await rejects(() => package_add(['@acme/nope'], project.actx),
      /Package not found[\s\S]*node_modules/,
      'the error did not say where it looked')
  })


  test('an incompatible engine range is refused, naming both', async () => {
    const pkg = makePackage({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-iot',
      engines: { sdkgen: '>=99' },
      provides: { target: ['iotgo'] },
    })
    try {
      const project = makeProject({})
      project.actx.flags = {}

      await rejects(() => package_add([pkg], project.actx),
        /needs @voxgig\/sdkgen >=99, this is \d+\.\d+\.\d+/)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('an UNPARSEABLE engine range warns and proceeds', async () => {
    // The failure direction that matters: refusing on a range nobody could
    // parse would block a package that works.
    const pkg = makePackage({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-iot',
      engines: { sdkgen: 'latest-ish' },
      provides: { target: ['iotgo'] },
    })
    try {
      const log = recordLog()
      const project = await addPackage(pkg, {}, { log })

      ok(project.files().includes('model/target/iotgo.aontu'),
        'an unparseable range blocked the install')
      ok(log.lines.some((l: any) => 'package-engine-unparsed' === l.point),
        'it proceeded SILENTLY')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a satisfied engine range installs quietly', async () => {
    const pkg = makePackage({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-iot',
      engines: { sdkgen: '>=1' },
      provides: { target: ['iotgo'] },
    })
    try {
      const log = recordLog()
      const project = await addPackage(pkg, {}, { log })

      ok(project.files().includes('model/target/iotgo.aontu'))
      ok(!log.lines.some((l: any) => 'package-engine-unparsed' === l.point),
        'a range it understands was reported as unparseable')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })
})


describe('package add --only / --alias', () => {

  test('--only installs a subset', async () => {
    const pkg = makePackage()
    try {
      const project = await addPackage(pkg, { only: 'target:iotgo' })
      const files = project.files()

      ok(files.includes('model/target/iotgo.aontu'))
      ok(!files.includes('model/feature/retry.aontu'),
        '--only installed something it was not asked for')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a typo in --only is an ERROR naming what is provided', async () => {
    // Not a silent no-op. `--only target:iot-goo` installing nothing and
    // reporting success is exactly the failure this verb exists to remove.
    const pkg = makePackage()
    try {
      const project = makeProject({})
      project.actx.flags = { only: 'target:iotgoo' }

      await rejects(() => package_add([pkg], project.actx),
        /does not provide target:iotgoo[\s\S]*it provides: [\s\S]*iotgo/)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('--only wants <kind>:<name>, and says so', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject({})
      project.actx.flags = { only: 'iotgo' }

      await rejects(() => package_add([pkg], project.actx),
        /--only expects <kind>:<name>/)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('--alias installs a target under a different name', async () => {
    const pkg = makePackage()
    try {
      const project = await addPackage(pkg,
        { only: 'target:iotgo', alias: 'iotgo=acmego' })
      const files = project.files()

      ok(files.includes('model/target/acmego.aontu'),
        'the alias was not installed: ' +
        files.filter((f: string) => f.startsWith('model/target/')).join(', '))
      ok(files.some((f: string) => f.startsWith('src/cmp/acmego/')),
        'components did not follow the alias')

      const src = String(project.fs.readFileSync(
        ROOT + '/model/target/acmego.aontu', 'utf8'))
      ok(src.includes("origname: 'iotgo'"),
        'the alias did not record where it came from')
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('aliasing a FEATURE is refused with the reason', async () => {
    // The same refusal `feature add` gives, so the two entry points cannot
    // disagree about what is allowed.
    const pkg = makePackage()
    try {
      const project = makeProject({})
      project.actx.flags = { alias: 'retry=breaker' }

      await rejects(() => package_add([pkg], project.actx),
        /Feature aliasing is not supported/)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('--alias for something not being installed is an error', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject({})
      project.actx.flags = { only: 'target:iotgo', alias: 'retry=breaker' }

      await rejects(() => package_add([pkg], project.actx),
        /not among the items being installed/)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('item flags are refused for several packages at once', async () => {
    // They name items, so applying them to each of several would install the
    // same alias twice.
    const project = makeProject({})
    project.actx.flags = { alias: 'iotgo=acmego' }

    await rejects(() => package_add(['a', 'b'], project.actx),
      /apply to a single package/)
  })
})


describe('package list', () => {

  test('groups installed items by the package that supplied them', async () => {
    const pkg = makePackage()
    try {
      const project = await addPackage(pkg)

      // What a reloaded project's model would carry, read back from the
      // provenance just written.
      const declared: any = {}
      for (const [kind, name] of [
        ['target', 'iotgo'], ['feature', 'retry'],
      ] as [string, string][]) {
        const src = String(project.fs.readFileSync(
          ROOT + '/model/' + kind + '/' + name + '.aontu', 'utf8'))
        declared[kind] = declared[kind] ?? {}
        declared[kind][name] = {
          name,
          base: (src.match(/^\s*base:\s*'([^']*)'/m) || [])[1],
          package: (src.match(/^\s*package:\s*'([^']*)'/m) || [])[1],
        }
      }
      Object.assign(project.actx.model.main.kit, declared)

      const log = recordLog()
      project.actx.log = log

      const res: any = await action_package(['package', 'list'], project.actx)

      deepStrictEqual(res.report.packages, ['@acme/sdkgen-iot'])

      const entry = log.lines.find(
        (l: any) => 'package-list-entry' === l.point)
      ok(null != entry, 'nothing was reported')
      strictEqual(entry.version, '1.4.0',
        'the version was not read from the source on disk')
      deepStrictEqual(entry.items.map((i: any) => i.kind + ':' + i.name).sort(),
        ['feature:retry', 'target:iotgo'])
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('an item with no recorded package is still listed', async () => {
    // Omitting it would make `package list` quietly under-report a project
    // that predates provenance. "(unrecorded)" is more use than silence.
    const project = makeProject({})
    await target_add([targetRef('go')], project.actx)
    project.actx.model.main.kit.target = { go: { name: 'go' } }

    const log = recordLog()
    project.actx.log = log

    const res: any = await action_package(['package', 'list'], project.actx)

    deepStrictEqual(res.report.packages, ['(unrecorded)'])
  })


  test('an empty project says so rather than nothing', async () => {
    const project = makeProject({})
    const log = recordLog()
    project.actx.log = log

    await action_package(['package', 'list'], project.actx)

    ok(log.lines.some((l: any) => 'package-list-end' === l.point &&
      l.note.includes('nothing installed')))
  })
})


// Review findings on #53, each pinned.
describe('package add: collisions and hostile inputs', () => {

  test('it REFUSES to overwrite a name from another source', async () => {
    // `add` is overwrite — that is how a resync works — but overwriting one
    // package's target with a different package's target of the same name is
    // not a resync. Done silently it replaces a working target's model,
    // components and templates with another's.
    const a = makePackage({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-a',
      provides: { target: ['iotgo'] },
    })
    const b = makePackage({
      sdkgen: { package: 1 }, name: '@other/sdkgen-b',
      provides: { target: ['iotgo'] },
    })
    try {
      const project = await addPackage(a)
      project.actx.flags = {}

      const before = project.files().length

      await rejects(() => package_add([b], project.actx),
        /Name collision, nothing installed[\s\S]*@acme\/sdkgen-a[\s\S]*--alias/,
        'the collision was not reported with both sources and a way out')

      strictEqual(project.files().length, before,
        'files were written despite the refusal')
    }
    finally {
      Fs.rmSync(a, { recursive: true, force: true })
      Fs.rmSync(b, { recursive: true, force: true })
    }
  })


  test('a RESYNC from the same source is not a collision', async () => {
    // The other half. If this failed, no project could ever update.
    const pkg = makePackage()
    try {
      const project = await addPackage(pkg)
      project.actx.flags = {}

      await package_add([pkg], project.actx)

      ok(project.files().includes('model/target/iotgo.aontu'))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('two packages claiming one name in ONE command are caught', async () => {
    // Neither is installed yet, so each would conflict with nothing.
    const a = makePackage({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-a',
      provides: { target: ['iotgo'] },
    })
    const b = makePackage({
      sdkgen: { package: 1 }, name: '@other/sdkgen-b',
      provides: { target: ['iotgo'] },
    })
    try {
      const project = makeProject({})
      project.actx.flags = {}

      await rejects(() => package_add([a, b], project.actx),
        /both @acme\/sdkgen-a and @other\/sdkgen-b provide it/)
    }
    finally {
      Fs.rmSync(a, { recursive: true, force: true })
      Fs.rmSync(b, { recursive: true, force: true })
    }
  })


  test('a LATER bad package stops the earlier good one', async () => {
    // The verb's guarantee is validation before writing. Applied per ref, it
    // would install the good package and then fail — the half-completed
    // command it exists to prevent.
    const good = makePackage()
    const bad = makePackage({
      sdkgen: { package: 1 }, name: '@other/sdkgen-bad',
      provides: { target: ['ghost'] },
    })
    try {
      const project = makeProject({})
      project.actx.flags = {}

      await rejects(() => package_add([good, bad], project.actx),
        /does not match the package/)

      deepStrictEqual(
        project.files().filter((f: string) => f.includes('iotgo')), [],
        'the first package was installed before the second was checked')
    }
    finally {
      Fs.rmSync(good, { recursive: true, force: true })
      Fs.rmSync(bad, { recursive: true, force: true })
    }
  })


  test('an alias that is not a NAME is refused', async () => {
    // The alias becomes a destination — `src/cmp/<alias>`, `tm/<alias>` —
    // and add overwrites what it writes, so `..` redirects the copy out of
    // the target's own directory and over unrelated scaffold.
    const pkg = makePackage()
    try {
      for (const bad of ['..', '../../elsewhere', 'a/b', '']) {
        const project = makeProject({})
        project.actx.flags = { only: 'target:iotgo', alias: 'iotgo=' + bad }

        await rejects(() => package_add([pkg], project.actx),
          /Invalid (target )?alias|--alias expects/,
          JSON.stringify(bad) + ' was accepted as an alias')
      }
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('a path-like alias is refused on the DIRECT path too', async () => {
    // Same hole, reached by `target add <ref>~<alias>`. Checked in the
    // resolver so the two entry points cannot disagree.
    const project = makeProject({})

    await rejects(
      () => target_add([targetRef('go') + '~..'], project.actx),
      /Invalid target alias/)
  })


  test('an item named like an Object property gets no phantom alias', async () => {
    // The name grammar admits `constructor`. On a plain object
    // `aliases['constructor']` is Object.prototype.constructor — truthy — so
    // an unaliased item had `~function Object() { … }` appended to its ref.
    const pkg = makePackage({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-iot',
      provides: { target: ['iotgo'] },
    })
    try {
      const project = makeProject({})
      project.actx.flags = { alias: 'iotgo=acmego' }
      await package_add([pkg], project.actx)

      const stray = project.files().filter((f: string) => f.includes('function'))
      deepStrictEqual(stray, [], 'an inherited property leaked into a path')
      ok(project.files().includes('model/target/acmego.aontu'))
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })


  test('an explicitly EMPTY --only is refused, not read as "everything"', async () => {
    // What a script gets from `--only=$ITEMS` with an empty variable.
    // Installing the whole package there is the opposite of what was asked,
    // at the one moment nobody is watching.
    const pkg = makePackage()
    try {
      for (const only of ['', '  ', ',', ' , ']) {
        const project = makeProject({})
        project.actx.flags = { only }

        await rejects(() => package_add([pkg], project.actx),
          /--only was given but selects nothing/,
          JSON.stringify(only) + ' installed everything')
      }
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })
})


describe('the action map', () => {

  test('is built from the kind registry, plus package and doctor', () => {
    deepStrictEqual(actionNames(),
      ['doctor', 'feature', 'package', 'target'],
      'a verb appeared or vanished — a new KIND should add one here with no ' +
      'dispatch code, but anything else is a deliberate change')
  })


  test('inherited Object properties are NOT actions', () => {
    // `voxgig-sdkgen toString` used to resolve to Object.prototype.toString,
    // pass the null check, and get CALLED with the action arguments.
    for (const name of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
      strictEqual((ACTION_MAP as any)[name], undefined,
        name + ' resolved to an inherited function')
    }
  })


  test('an unknown action names the ones that exist', async () => {
    const pkg = makePackage()
    try {
      const project = makeProject({})
      await rejects(
        () => action_package(['package', 'frobnicate'], project.actx),
        /Unknown package cmd: frobnicate \(expected: add, list\)/)
    }
    finally {
      Fs.rmSync(pkg, { recursive: true, force: true })
    }
  })
})
