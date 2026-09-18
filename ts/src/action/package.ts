import { kindCollection } from '../helpers/kindCollection'

import Path from 'node:path'

import { KIT } from '../types'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import {
  MANIFEST,
  ITEM_NAME_RE,
  probePackage,
  readManifest,
  validateManifest,
} from '../helpers/manifest'

import type { Manifest, Finding } from '../helpers/manifest'

import { satisfies } from '../helpers/semver'

import { KINDS, kindDef } from './kind'

import { cmd_package_check } from './check'

import { doctor } from './doctor'

import { resolveSource, registerInstalled, nameConflict } from './resolve'
import type { Source } from './resolve'


const CMD_MAP: any = Object.assign(Object.create(null), {
  add: cmd_package_add,
  check: cmd_package_check,
  list: cmd_package_list,
  update: cmd_package_update,
})


const ADD_ORDER = ['target', 'feature', 'edition']


async function action_package(
  args: string[], actx: ActionContext,
): Promise<ActionResult> {
  const cmdname = args[1]
  const cmd = CMD_MAP[cmdname]

  if (null == cmd) {
    throw new SdkGenError(
      'Unknown package cmd: ' + cmdname + ' (expected: ' +
      Object.keys(CMD_MAP).sort().join(', ') + ')')
  }

  return await cmd(args, actx)
}


type PackageSource = {
  ref: string
  root: string
  sdk: string
  manifest: Manifest
}


function resolvePackage(ref: string, actx: ActionContext): PackageSource {
  const { found, search } = probePackage(actx.fs(), actx.folder ?? '.', ref)

  if (null == found) {
    throw new SdkGenError(
      'Package not found: ' + ref + '\n  looked for a `.sdk` folder in:\n    ' +
      search.join('\n    '))
  }

  const { root, sdk, read } = found

  if (null == read.manifest) {
    throw new SdkGenError(
      'No package manifest: ' + read.file +
      (null == read.err ? '' : '\n  ' + read.err) +
      '\n  `package add` installs what a manifest declares. For a folder' +
      ' without one, add its items directly:' +
      '\n    voxgig-sdkgen target add ' + ref + '/<name>')
  }

  return { ref, root, sdk, manifest: read.manifest }
}


// Everything wrong with the package, or nothing. Reported as ONE message
// rather than one-per-throw, because an author fixing a manifest wants the
// whole list, not the first line of it.
function refuse(src: PackageSource, found: Finding[], log: any) {
  // The non-errors are still worth saying — an unclaimed extra is nearly
  // always a forgotten manifest edit — but they do not stop the install.
  for (const f of found) {
    if ('error' !== f.level) {
      log[f.level](f)
    }
  }

  const errors = found.filter((f: Finding) => 'error' === f.level)

  if (0 === errors.length) {
    return
  }

  throw new SdkGenError(
    src.ref + ': package manifest does not match the package (' +
    Path.join(src.root, MANIFEST) + ')\n  ' +
    errors.map((f: Finding) => f.note).join('\n  '))
}


function checkEngine(src: PackageSource, actx: ActionContext) {
  const range = src.manifest.engines?.sdkgen

  if (null == range || '' === range) {
    return
  }

  const ok = satisfies(SDKGEN_VERSION, range)

  if (false === ok) {
    throw new SdkGenError(
      src.ref + ': needs @voxgig/sdkgen ' + range +
      ', this is ' + SDKGEN_VERSION +
      '\n  upgrade @voxgig/sdkgen, or install an earlier version of ' + src.ref)
  }

  if (null == ok) {
    actx.log.warn({
      point: 'package-engine-unparsed', package: src.manifest.name,
      range, version: SDKGEN_VERSION,
      note: src.ref + ': cannot compare `engines.sdkgen` range ' +
        JSON.stringify(range) + ' against ' + SDKGEN_VERSION +
        '; proceeding — see helpers/semver for the supported subset'
    })
  }
}


// This generator's own version, read from the package.json beside `dist`.
// Not from the consumer's model: `engines.sdkgen` is about the GENERATOR
// doing the installing, and the model describes the SDK being generated.
const SDKGEN_VERSION: string = (() => {
  try {
    return require('../../package.json').version
  }
  catch (err: any) {
    return '0.0.0'
  }
})()


function selectItems(
  src: PackageSource, only: string | undefined, log: any,
): Record<string, string[]> {
  const provides = src.manifest.provides ?? {}

  if (null == only) {
    return provides
  }

  const wanted: Record<string, string[]> = Object.create(null)
  const missing: string[] = []
  const specs = only.split(',').map((s) => s.trim()).filter(Boolean)

  if (0 === specs.length) {
    throw new SdkGenError(
      '--only was given but selects nothing: ' + JSON.stringify(only) +
      '\n  omit the flag to install everything the package provides')
  }

  for (const spec of specs) {
    const colon = spec.indexOf(':')

    if (colon < 0) {
      throw new SdkGenError(
        '--only expects <kind>:<name> entries, got: ' + spec +
        '\n  for example: --only target:iot-go,feature:circuitbreaker')
    }

    const kind = spec.slice(0, colon)
    const name = spec.slice(colon + 1)

    if (!(provides[kind] ?? []).includes(name)) {
      missing.push(spec)
      continue
    }

    (wanted[kind] = wanted[kind] ?? []).push(name)
  }

  if (0 < missing.length) {
    throw new SdkGenError(
      src.ref + ': does not provide ' + missing.join(', ') +
      '\n  it provides: ' + describeProvides(provides))
  }

  return wanted
}


function describeProvides(provides: Record<string, string[]>): string {
  const parts: string[] = []

  for (const kind of Object.keys(provides).sort()) {
    for (const name of provides[kind]) {
      parts.push(kind + ' `' + name + '`')
    }
  }

  return 0 === parts.length ? '(nothing)' : parts.join(', ')
}


function parseAliases(
  alias: string | undefined, wanted: Record<string, string[]>,
): Record<string, string> {
  // NULL-PROTOTYPE. A manifest may legally provide an item called
  // `constructor` or `toString` — the name grammar admits them — and on a
  // plain object `aliases['constructor']` is Object.prototype.constructor,
  // which is truthy, so an unaliased item got `~function Object() { … }`
  // appended and installed under that as a name.
  const out: Record<string, string> = Object.create(null)

  if (null == alias || '' === alias) {
    return out
  }

  for (const spec of alias.split(',').map((s) => s.trim()).filter(Boolean)) {
    const eq = spec.indexOf('=')

    if (eq < 0) {
      throw new SdkGenError(
        '--alias expects <name>=<alias> entries, got: ' + spec +
        '\n  for example: --alias iot-go=acme-go')
    }

    const from = spec.slice(0, eq)
    const to = spec.slice(eq + 1)

    if (!ITEM_NAME_RE.test(to)) {
      throw new SdkGenError(
        'Invalid alias in --alias ' + JSON.stringify(spec) + ': ' +
        JSON.stringify(to) + ' is not a name (matching ' +
        ITEM_NAME_RE.source + ')' +
        '\n  an alias becomes the directory the item is installed into')
    }

    const kind = Object.keys(wanted)
      .find((k: string) => (wanted[k] ?? []).includes(from))

    if (null == kind) {
      throw new SdkGenError(
        '--alias names ' + JSON.stringify(from) +
        ', which is not among the items being installed: ' +
        describeProvides(wanted))
    }

    if (!kindDef(kind).alias) {
      throw new SdkGenError(
        capitalise(kind) + ' aliasing is not supported: ' + spec +
        '\n  A ' + kind + ' name is part of the generated config ' +
        '(options.' + kind + '.<name>) and of the hook wiring in every ' +
        'target, so it cannot be renamed at install time.')
    }

    out[from] = to
  }

  return out
}


async function cmd_package_add(
  args: string[], actx: ActionContext,
): Promise<ActionResult> {
  const refs = args.slice(2).flatMap(
    (a: any) => 'string' === typeof a ? a.split(',') : a)
    .filter((r: any) => null != r && '' !== r)

  if (0 === refs.length) {
    throw new SdkGenError('package add: no package given')
  }

  return package_add(refs, actx)
}


async function package_add(
  refs: string[], actx: ActionContext,
): Promise<ActionResult> {
  const log = actx.log
  const flags = actx.flags ?? {}

  // `--only` and `--alias` name items, so they only make sense for ONE
  // package. Silently applying them to each of several would install the same
  // alias twice.
  if (1 < refs.length && (null != flags.only || null != flags.alias)) {
    throw new SdkGenError(
      '--only and --alias apply to a single package; ' + refs.length +
      ' were given: ' + refs.join(', '))
  }

  const plan = refs.map((ref: string) => plan_one(ref, flags, actx))

  checkCollisions(plan, actx)

  const results: any[] = []

  for (const { src, wanted, items } of plan) {
    log.info({
      point: 'package-add-start', package: src.manifest.name, ref: src.ref,
      version: src.manifest.version, root: src.root,
      note: src.manifest.name +
        (null == src.manifest.version ? '' : '@' + src.manifest.version) +
        ' <- ' + src.root
    })

    for (const kind of orderedKinds(wanted)) {
      const add = adderFor(kind)
      const itemrefs = items[kind] ?? []

      if (0 === itemrefs.length) {
        continue
      }

      if (null == add) {
        // Validation already rejected an unknown kind, so this is a kind the
        // registry knows and nothing can install yet — a `docs` entry before
        // its action exists. Say so rather than skipping in silence.
        log.warn({
          point: 'package-kind-unsupported', package: src.manifest.name, kind,
          names: wanted[kind],
          note: src.manifest.name + ': nothing can install `' + kind +
            '` items yet; skipped ' + (wanted[kind] ?? []).join(', ')
        })
        continue
      }

      results.push(await add(itemrefs, actx))

      registerInstalled(kind, itemrefs, actx)
    }

    log.info({
      point: 'package-add-end', package: src.manifest.name, ref: src.ref,
      note: src.manifest.name + ': added ' + describeProvides(wanted)
    })
  }

  // The LAST jostraca result, for the CLI's change summary. Each per-kind add
  // already reported its own changes as it ran.
  return { jres: results[results.length - 1]?.jres }
}


type Planned = {
  src: PackageSource
  wanted: Record<string, string[]>
  // Item refs, by kind, in the grammar the per-kind add already takes:
  // `<package-root>/<name>` with `~alias` appended when renamed. Building a
  // ref rather than calling an internal entry point is what keeps
  // `package add` and a hand-typed `target add` on exactly the same path.
  items: Record<string, string[]>
}


function plan_one(
  ref: string, flags: Record<string, any>, actx: ActionContext,
): Planned {
  const src = resolvePackage(ref, actx)

  checkEngine(src, actx)
  refuse(src, validateManifest(actx.fs(), src.sdk, src.manifest, KINDS),
    actx.log)

  const wanted = selectItems(src, flags.only, actx.log)
  const aliases = parseAliases(flags.alias, wanted)

  const items: Record<string, string[]> = Object.create(null)

  for (const kind of Object.keys(wanted)) {
    items[kind] = (wanted[kind] ?? []).map((name: string) =>
      Path.join(src.root, name) +
      (Object.prototype.hasOwnProperty.call(aliases, name) ?
        '~' + aliases[name] : ''))
  }

  return { src, wanted, items }
}


function checkCollisions(plan: Planned[], actx: ActionContext) {
  const claimed = new Map<string, string>()
  const clashes: string[] = []

  for (const { src, items } of plan) {
    for (const kind of Object.keys(items)) {
      for (const ref of items[kind]) {
        let source: Source
        try {
          source = resolveSource(ref, kind, actx)
        }
        catch (err: any) {
          // Unresolvable here means the add will fail too, with a better
          // message than this check could give. Let it.
          continue
        }

        const key = kind + ':' + source.name

        const earlier = claimed.get(key)
        if (null != earlier && earlier !== src.manifest.name) {
          clashes.push(kind + ' `' + source.name + '`: both ' + earlier +
            ' and ' + src.manifest.name + ' provide it')
          continue
        }
        claimed.set(key, src.manifest.name)

        const conflict = nameConflict(kind, source, actx)

        if (null != conflict) {
          clashes.push(
            kind + ' `' + source.name + '`: already installed from ' +
            (conflict.package || conflict.base) +
            ', and ' + src.manifest.name + ' provides it too')
        }
      }
    }
  }

  if (0 === clashes.length) {
    return
  }

  throw new SdkGenError(
    'Name collision, nothing installed:\n  ' + clashes.join('\n  ') +
    '\n\n  Either install the one you want by its own ref:' +
    '\n    voxgig-sdkgen target add <package>/<name>' +
    '\n  or install this package\'s under a different name:' +
    '\n    voxgig-sdkgen package add <package> --alias <name>=<alias>')
}


// `ADD_ORDER` first, then anything else the registry knows, so a kind added
// later installs without editing this list.
function orderedKinds(wanted: Record<string, string[]>): string[] {
  const rest = Object.keys(wanted)
    .filter((k: string) => !ADD_ORDER.includes(k)).sort()

  return [...ADD_ORDER.filter((k: string) => null != wanted[k]), ...rest]
}


// Registered by `dispatch`, to keep this module out of a require cycle with
// `target.ts` (which imports `feature.ts`, which imports `kind.ts`).
const ADDERS: Record<string, (refs: string[], actx: ActionContext) => Promise<any>> =
  Object.create(null)


function registerAdder(
  kind: string, add: (refs: string[], actx: ActionContext) => Promise<any>,
) {
  ADDERS[kind] = add
}


function adderFor(
  kind: string,
): ((refs: string[], actx: ActionContext) => Promise<any>) | undefined {
  if (0 === Object.keys(ADDERS).length) {
    require('./dispatch')
  }

  return ADDERS[kind]
}


async function cmd_package_update(
  args: string[], actx: ActionContext,
): Promise<ActionResult> {
  const names = args.slice(2).flatMap(
    (a: any) => 'string' === typeof a ? a.split(',') : a)
    .filter((r: any) => null != r && '' !== r)

  if (0 === names.length) {
    throw new SdkGenError(
      'package update: no package given' +
      '\n  `voxgig-sdkgen package list` shows what this project has installed')
  }

  return package_update(names, actx)
}


// One item this project got from the package being updated.
type Installed = {
  kind: string
  name: string
  origname: string
  base: string
  aliased: boolean
}


function installedFrom(pkgname: string, actx: ActionContext): Installed[] {
  const kit: any = (actx.model as any)?.main?.[KIT] ?? {}
  const found: Installed[] = []

  for (const kind of Object.keys(KINDS).sort()) {
    const items = kindCollection({ main: { [KIT]: kit } }, kind)

    for (const name of Object.keys(items).sort()) {
      const item = items[name]

      if (null == item || 'object' !== typeof item ||
        item.package !== pkgname) {
        continue
      }

      const origname = item.origname || name

      found.push({
        kind, name, origname,
        base: item.base || '',
        aliased: kindDef(kind).alias && origname !== name,
      })
    }
  }

  return found
}


async function package_update(
  names: string[], actx: ActionContext,
): Promise<ActionResult> {
  const log = actx.log
  const flags = actx.flags ?? {}

  const results: any[] = []

  // EVERY package's items resolved and CHECKED before any of them is
  // fetched. `package update A,B` that finished A and then refused B would
  // exit as failed having already changed A's dependencies and `.sdk` — the
  // partial command the gate exists to prevent, one level up from where it
  // was already prevented.
  const plan = names.map((pkgname: string) => {
    const installed = installedFrom(pkgname, actx)

    if (0 === installed.length) {
      throw new SdkGenError(
        'Nothing installed from ' + pkgname +
        '\n  `voxgig-sdkgen package list` shows which packages this project ' +
        'has, and what each supplied')
    }

    return { pkgname, installed }
  })

  // STEP 1 — before anything moves, for all of them.
  for (const { pkgname, installed } of plan) {
    await preCheck(pkgname, installed, actx)
  }

  for (const { pkgname, installed } of plan) {
    log.info({
      point: 'package-update-start', package: pkgname,
      items: installed.length,
      note: pkgname + ': updating ' + installed.length + ' item(s)'
    })

    // STEP 2 — now the source may change.
    await fetchPackage(pkgname, installed, actx)

    // STEP 2b — the fetched version is a DIFFERENT package from the one
    // step 1 measured, and nothing has validated it. `package add` refuses a
    // package whose manifest lies or whose `engines.sdkgen` is beyond this
    // generator; an update that skipped those checks would overwrite `.sdk`
    // with components written for a generator this is not.
    validateFetched(pkgname, installed, actx)

    // STEP 3.
    results.push(...await reAdd(pkgname, installed, actx))

    log.info({
      point: 'package-update-end', package: pkgname,
      note: pkgname + ': updated'
    })
  }

  return { jres: results[results.length - 1]?.jres }
}


function blastRadius(
  installed: Installed[], actx: ActionContext,
): Set<string> {
  const wanted = new Set(installed.map((i: Installed) => i.kind + ':' + i.name))

  if (!installed.some((i: Installed) => 'target' === i.kind)) {
    return wanted
  }

  const features: any = (actx.model as any)?.main?.[KIT]?.feature ?? {}

  for (const name of Object.keys(features)) {
    if (false !== features[name]?.active) {
      wanted.add('feature:' + name)
    }
  }

  return wanted
}


// STEP 1: is the project's copy of this package's items unmodified?
//
// Runs the SAME comparison `doctor` runs, scoped to these items — a gate that
// decides whether to overwrite a project's files must not have its own idea
// of what counts as a difference.
async function preCheck(
  pkgname: string, installed: Installed[], actx: ActionContext,
) {
  const flags = actx.flags ?? {}

  const wanted = blastRadius(installed, actx)

  const res: any = await doctor(
    actx, (kind: string, name: string) => wanted.has(kind + ':' + name))

  const report = res.report

  const changed = [...report.forked, ...report.edited]

  if (0 === changed.length) {
    return
  }

  if (true === flags.force) {
    actx.log.warn({
      point: 'package-update-forced', package: pkgname, files: changed,
      note: pkgname + ': --force, overwriting ' + changed.length +
        ' locally-changed file(s): ' + changed.join(', ')
    })
    return
  }

  throw new SdkGenError(
    pkgname + ': ' + changed.length + ' file(s) differ from the installed ' +
    'source, so updating would overwrite them:\n  ' + changed.join('\n  ') +
    '\n\n  This means one of two things, and nothing recorded in the project ' +
    'tells them apart:' +
    '\n    - they are LOCAL EDITS, and `--force` will discard them;' +
    '\n    - or ' + pkgname + ' was already updated out of band (an ' +
    '`npm update` in another shell), in which case they are merely STALE ' +
    'and nothing is at risk.' +
    '\n\n  If you did not update it: copy anything you want to keep into ' +
    '.sdk/model/, then re-run with --force.' +
    '\n  If you did: reinstall the version you had, re-run this command, ' +
    'and it will check against the right source.')
}


async function fetchPackage(
  pkgname: string, installed: Installed[], actx: ActionContext,
) {
  const flags = actx.flags ?? {}

  if (true === flags.nofetch) {
    actx.log.info({
      point: 'package-update-nofetch', package: pkgname,
      note: pkgname + ': --no-fetch, using the source already installed'
    })
    return
  }

  if (true === actx.opts?.dryrun) {
    actx.log.info({
      point: 'package-update-dryrun-fetch', package: pkgname,
      note: pkgname + ': ** DRY RUN ** not fetching; the check and the ' +
        're-add below run against the source already installed'
    })
    return
  }

  const fetch = actx.fetchPackage ?? npmFetch

  if (null == actx.fetchPackage) {
    const local = installed.find((i: Installed) =>
      '' !== i.base && !isNodeModules(i.base))

    if (null != local) {
      throw new SdkGenError(
        pkgname + ': installed from ' + local.base + ', which npm does not ' +
        'manage, so fetching would update a different copy and change ' +
        'nothing here.' +
        '\n  Update that source yourself (git pull, rebuild, …) and re-run ' +
        'with --no-fetch.')
    }
  }

  await fetch(pkgname, actx)
}


// Is this base inside a `node_modules` directory — i.e. is it npm's to
// update? Checked on the '/'-normalised recorded value, which is how `base`
// is written (see helpers/stdrep), plus the platform separator for an
// absolute base recorded on Windows.
function isNodeModules(base: string): boolean {
  const norm = base.split(Path.sep).join('/')
  return norm.startsWith('node_modules/') || norm.includes('/node_modules/')
}


async function npmFetch(pkgname: string, actx: ActionContext) {
  const { execFile } = require('node:child_process')
  const { promisify } = require('node:util')

  const run = promisify(execFile)
  const cwd = actx.folder ?? '.'

  actx.log.info({
    point: 'package-update-fetch', package: pkgname, cwd,
    note: pkgname + ': npm install ' + pkgname + '@latest'
  })

  try {
    const out = await run(
      'win32' === process.platform ? 'npm.cmd' : 'npm',
      ['install', '--save-dev', pkgname + '@latest'],
      { cwd, maxBuffer: 64 * 1024 * 1024 })

    actx.log.debug({
      point: 'package-update-fetched', package: pkgname,
      stdout: out.stdout, stderr: out.stderr
    })
  }
  catch (err: any) {
    throw new SdkGenError(
      pkgname + ': fetch failed — ' + (err.message || String(err)) +
      '\n  nothing has been overwritten. Fetch it yourself and re-run with ' +
      '--no-fetch, or fix the install and try again.' +
      (null == err.stderr ? '' : '\n\n' + err.stderr))
  }
}


function validateFetched(
  pkgname: string, installed: Installed[], actx: ActionContext,
) {
  const base = installed.find((i: Installed) => '' !== i.base)?.base

  if (null == base) {
    return
  }

  const root = Path.join(
    Path.isAbsolute(base) ? base : Path.join(actx.folder ?? '.', base), '..')

  const read = readManifest(actx.fs(), Path.join(root, '.sdk'))

  if (null == read.manifest) {
    actx.log.info({
      point: 'package-update-unmanifested', package: pkgname, file: read.file,
      note: pkgname + ': the source declares no manifest, so the fetched ' +
        'version could not be validated'
    })
    return
  }

  const src: PackageSource = {
    ref: pkgname, root, sdk: Path.join(root, '.sdk'), manifest: read.manifest,
  }

  checkEngine(src, actx)
  refuse(src, validateManifest(actx.fs(), src.sdk, src.manifest, KINDS),
    actx.log)
}


async function reAdd(
  pkgname: string, installed: Installed[], actx: ActionContext,
): Promise<any[]> {
  const log = actx.log
  const results: any[] = []

  const skipped = installed.filter((i: Installed) => i.aliased)

  if (0 < skipped.length) {
    log.info({
      point: 'package-update-alias-model-kept', package: pkgname,
      items: skipped.map((i: Installed) => i.kind + '/' + i.name),
      note: pkgname + ': keeping the model file of ' + skipped.length +
        ' aliased item(s) — that file is where an alias is differentiated, ' +
        'so upstream model changes to ' +
        skipped.map((i: Installed) => i.origname).join(', ') +
        ' must be ported by hand: ' +
        skipped.map((i: Installed) =>
          'model/' + i.kind + '/' + i.name + '.aon').join(', ')
    })
  }

  // Same order as `package add`, for the same reason: `feature add` fans a
  // feature's source across the targets in the model.
  const byKind: Record<string, string[]> = Object.create(null)

  for (const item of installed) {
    // The ref that reinstalls it — exactly what `recordedRef` reconstructs
    // for doctor, so an update and a check agree about where an item is from.
    const ref = Path.join(item.base, '..', item.origname) +
      (item.origname === item.name ? '' : '~' + item.name)

    ;(byKind[item.kind] = byKind[item.kind] ?? []).push(ref)
  }

  for (const kind of orderedKinds(byKind)) {
    const add = adderFor(kind)

    if (null == add) {
      log.warn({
        point: 'package-kind-unsupported', package: pkgname, kind,
        note: pkgname + ': nothing can install `' + kind + '` items yet'
      })
      continue
    }

    results.push(await add(byKind[kind], actx))
  }

  return results
}


async function cmd_package_list(
  _args: string[], actx: ActionContext,
): Promise<ActionResult> {
  const log = actx.log
  const fs = actx.fs()
  const kit: any = (actx.model as any)?.main?.[KIT] ?? {}

  const groups: Record<string, any[]> = Object.create(null)

  for (const kind of Object.keys(KINDS).sort()) {
    const items = kindCollection({ main: { [KIT]: kit } }, kind)

    for (const name of Object.keys(items).sort()) {
      const item = items[name]

      if (null == item || 'object' !== typeof item) {
        continue
      }

      // An item with no recorded base predates provenance; it is still
      // installed, and saying "(unrecorded)" is more use than omitting it.
      const pkg = ('' === item.package || null == item.package) ?
        UNRECORDED : item.package

      ;(groups[pkg] = groups[pkg] ?? []).push({
        kind, name,
        origname: item.origname || name,
        base: item.base || '',
      })
    }
  }

  const packages = Object.keys(groups).sort()

  for (const pkg of packages) {
    // The version ON DISK, not one recorded at add time: what `package
    // update` would compare against is the source as it is now.
    const version = installedVersion(fs, actx.folder ?? '.', groups[pkg])

    log.info({
      point: 'package-list-entry', package: pkg, version,
      items: groups[pkg],
      note: pkg + (null == version ? '' : '@' + version) + ': ' +
        groups[pkg].map((i: any) =>
          i.kind + ' `' + i.name + '`' +
          (i.origname === i.name ? '' : ' (' + i.origname + ')')).join(', ')
    })
  }

  log.info({
    point: 'package-list-end', packages: packages.length,
    note: 0 === packages.length ?
      'nothing installed' : packages.length + ' package(s)'
  })

  return { jres: undefined as any, report: { packages, groups } } as any
}


const UNRECORDED = '(unrecorded)'


// Read the version from the manifest the items say they came from. All items
// of one package share a base in practice; the first that yields a manifest
// answers.
function installedVersion(
  fs: any, project: string, items: any[],
): string | undefined {
  for (const item of items) {
    if ('' === item.base) {
      continue
    }

    const sdk = Path.isAbsolute(item.base) ?
      item.base : Path.join(project, item.base)

    const read = readManifest(fs, sdk)

    if (null != read.manifest?.version) {
      return read.manifest.version
    }
  }

  return undefined
}


function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


export {
  action_package,
  package_add,
  package_update,
  installedFrom,
  resolvePackage,
  selectItems,
  parseAliases,
  registerAdder,
  SDKGEN_VERSION,
}
