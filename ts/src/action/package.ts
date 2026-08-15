// `package add` / `package list` — the whole-package verbs.
//
// See docs/design/sdkgen-packages.md §9.
//
// WHAT `package add` IS
//
// Not a new copy pipeline. It resolves a package ROOT, validates its manifest,
// and then runs the SAME per-kind add that `target add` / `feature add` run,
// once per provided item. Index handling, provenance stamping, feature
// fan-out, dry run and logging all come along unchanged, because they are not
// reimplemented. The value it adds over typing the individual adds is:
//
//   - the manifest is REQUIRED and validated first, so a package that lies
//     about what it provides fails before anything is written rather than
//     halfway through;
//   - the engine range is checked once, for the package, rather than never;
//   - ordering: targets before features, because `feature add` fans a
//     feature's source out across the targets already in the model, so a
//     feature installed first would find none of the package's own targets.
//
// WHY VALIDATION COMES FIRST, ALL OF IT
//
// The items are installed in a loop. If the fourth one turns out not to be in
// the package, the first three are already written and the project is left
// half-installed with a partial index. Validating the whole claim up front is
// what makes the loop safe to run at all.

import Path from 'node:path'

import { KIT } from '../types'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import {
  MANIFEST,
  readManifest,
  validateManifest,
} from '../helpers/manifest'

import type { Manifest, Finding } from '../helpers/manifest'

import { satisfies } from '../helpers/semver'

import { KINDS, kindDef } from './kind'

import { resolveSource } from './resolve'


const CMD_MAP: any = Object.assign(Object.create(null), {
  add: cmd_package_add,
  list: cmd_package_list,
})


// The kinds `package add` installs, IN ORDER.
//
// Targets first. `feature add` copies a feature's per-target source into every
// target already in the model, so a feature installed before the package's own
// targets would silently ship no source for them — the `feature-source-missing`
// warning, once per target, and a feature that does nothing.
const ADD_ORDER = ['target', 'feature']


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


// Where a package ROOT is, given a ref.
//
// The same probe chain `resolveSource` uses for an item, one level up: an
// installed npm package first, then a path relative to the project, then an
// absolute path. A package root is the folder HOLDING `.sdk`, which is what
// makes `<root>/<item>` the item ref — so the two resolvers agree by
// construction about what a package is.
type PackageSource = {
  ref: string
  root: string
  sdk: string
  manifest: Manifest
}


function resolvePackage(ref: string, actx: ActionContext): PackageSource {
  const fs = actx.fs()
  const project = actx.folder ?? '.'

  const search: string[] = []

  const candidates = Path.isAbsolute(ref) ? [ref] : [
    Path.join(project, 'node_modules', ref),
    Path.join(project, ref),
  ]

  for (const root of candidates) {
    const sdk = Path.normalize(Path.join(root, '.sdk'))
    search.push(sdk)

    if (!fs.existsSync(sdk)) {
      continue
    }

    const read = readManifest(fs, sdk)

    // A `.sdk` folder with no manifest is a legal source for a DIRECT ref and
    // is what every pre-manifest fixture is — but `package add` is the verb
    // that acts on a manifest, so here its absence is the error, and it says
    // which of the two commands the user wants.
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

  throw new SdkGenError(
    'Package not found: ' + ref + '\n  looked for a `.sdk` folder in:\n    ' +
    search.join('\n    '))
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


// Is this generator new enough for the package?
//
// `undefined` from `satisfies` means the range is outside the subset it
// understands — see helpers/semver. That is reported and ALLOWED: refusing on
// a range nobody could parse would block a package that works, which is worse
// than the incompatibility being guarded against.
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


// The items to install, as `<kind>` -> names, after `--only` is applied.
//
// `--only target:iot-go,feature:circuitbreaker` — a subset of what the
// manifest provides, named the same way the manifest keys them. A name that
// the package does not provide is an ERROR listing what it does, rather than
// a silent no-op: a typo'd `--only` that installed nothing and reported
// success is the failure this whole verb exists to remove.
function selectItems(
  src: PackageSource, only: string | undefined, log: any,
): Record<string, string[]> {
  const provides = src.manifest.provides ?? {}

  if (null == only || '' === only) {
    return provides
  }

  const wanted: Record<string, string[]> = {}
  const missing: string[] = []

  for (const spec of only.split(',').map((s) => s.trim()).filter(Boolean)) {
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


// `--alias iot-go=acme-go,other=thing` — the install-time renames, by ORIGIN
// name. Only kinds that permit aliasing may appear; a feature alias is
// refused here with the same explanation `feature add` gives, so the two
// entry points cannot disagree about what is allowed.
function parseAliases(
  alias: string | undefined, wanted: Record<string, string[]>,
): Record<string, string> {
  const out: Record<string, string> = {}

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

  const results: any[] = []

  for (const ref of refs) {
    const src = resolvePackage(ref, actx)

    log.info({
      point: 'package-add-start', package: src.manifest.name, ref,
      version: src.manifest.version, root: src.root,
      note: src.manifest.name +
        (null == src.manifest.version ? '' : '@' + src.manifest.version) +
        ' <- ' + src.root
    })

    checkEngine(src, actx)
    refuse(src, validateManifest(actx.fs(), src.sdk, src.manifest, KINDS), log)

    const wanted = selectItems(src, flags.only, log)
    const aliases = parseAliases(flags.alias, wanted)

    for (const kind of orderedKinds(wanted)) {
      const add = ADDERS[kind]

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

      // One ref per item, in the grammar the per-kind add already takes:
      // `<package-root>/<name>` with `~alias` appended when renamed. Building
      // a ref rather than calling an internal entry point is what keeps
      // `package add` and a hand-typed `target add` on exactly the same path.
      const itemrefs = (wanted[kind] ?? []).map((name: string) =>
        Path.join(src.root, name) +
        (null == aliases[name] ? '' : '~' + aliases[name]))

      if (0 === itemrefs.length) {
        continue
      }

      results.push(await add(itemrefs, actx))

      registerInstalled(kind, itemrefs, actx)
    }

    log.info({
      point: 'package-add-end', package: src.manifest.name, ref,
      note: src.manifest.name + ': added ' + describeProvides(wanted)
    })
  }

  // The LAST jostraca result, for the CLI's change summary. Each per-kind add
  // already reported its own changes as it ran.
  return { jres: results[results.length - 1]?.jres }
}


// Teach the IN-MEMORY model about what was just installed.
//
// ORDERING ALONE IS NOT ENOUGH, which is the whole reason this exists. An
// action reads `actx.model`, which was compiled from `model/sdk.aontu` before
// the run; writing `model/target/iotgo.aontu` does not change it, and nothing
// recompiles mid-process. So `feature add` — which copies a feature's source
// into every target IN THE MODEL — saw none of the targets `package add` had
// just written, and installed a feature with no source for them. Silently:
// the per-target warning is `feature-source-missing`, once each, in a run
// that otherwise reports success.
//
// Resolved through `resolveSource`, not reconstructed here, so the `base` and
// `origname` this records are by construction the ones the add itself
// stamped. Deriving them a second way is how the two would drift.
function registerInstalled(
  kind: string, itemrefs: string[], actx: ActionContext,
) {
  const kit: any = (actx.model as any)?.main?.[KIT]

  if (null == kit) {
    return
  }

  const items = kit[kind] = kit[kind] ?? {}

  for (const ref of itemrefs) {
    let source: any
    try {
      source = resolveSource(ref, kind, actx)
    }
    catch (err: any) {
      // The add itself just succeeded for this ref, so a failure here is not
      // something the caller can act on — but a later kind will behave as if
      // the item is not installed, so say why.
      actx.log.warn({
        point: 'package-register-failed', kind, ref, err: err.message,
        note: ref + ': installed, but could not be added to the in-memory ' +
          'model (' + err.message + '); later items in this run will not ' +
          'see it'
      })
      continue
    }

    // Do not overwrite what the model already declares: a project may have
    // configured an item it is now resyncing, and that configuration is the
    // project's, not the package's.
    items[source.name] = {
      ...(items[source.name] ?? {}),
      name: source.name,
      base: source.base,
      origname: source.origname,
      ...(null == source.package ? {} : { package: source.package }),
    }
  }
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


// `package list` — what this project has installed, and where each item came
// from. Read entirely from the MODEL's recorded provenance (§4), which is why
// there is no lockfile to consult and nothing that can disagree with it.
async function cmd_package_list(
  _args: string[], actx: ActionContext,
): Promise<ActionResult> {
  const log = actx.log
  const fs = actx.fs()
  const kit: any = (actx.model as any)?.main?.[KIT] ?? {}

  // package name -> kind -> [{name, base, origname}]
  const groups: Record<string, any[]> = Object.create(null)

  for (const kind of Object.keys(KINDS).sort()) {
    const items = kit[kind] ?? {}

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
  resolvePackage,
  selectItems,
  parseAliases,
  registerAdder,
  SDKGEN_VERSION,
}
