/* Copyright (c) 2024-2025 Richard Rodger, MIT License */

import Fs from 'node:fs'
import Path from 'node:path'

import { prettyPino, Pino } from '@voxgig/util'

import * as JostracaModule from 'jostraca'
import { Aontu } from 'aontu'

import {
  showChanges,
} from '@voxgig/util'

import type {
  ActionContext,
  ActionResult,
} from './types'

import { SdkGenError, requirePath, isAuthActive, resolveAuthPrefix, isHttpBasicAuth,
  CONFIG_DATA_THRESHOLD, CONFIG_REPR_VALUES, isConfigData, configRepr,
  configReprSetting, configDefinition, clean, rawStringLiteral } from './utility'

import { Main } from './cmp/Main'
import { featureApplies, targetFeatures, featureTags, unknownTags, TAGS } from './helpers/applicability'
import { ExternalTarget } from './cmp/ExternalTarget'
import { Docs, DocsItem } from './cmp/Docs'
import { ExternalDocs } from './cmp/ExternalDocs'

import { KIT } from '@voxgig/apidef'
import { Deploy } from './cmp/Deploy'
import { Entity } from './cmp/Entity'
import { Feature } from './cmp/Feature'
import { Readme } from './cmp/Readme'
import { ReadmeTop } from './cmp/ReadmeTop'
import { AgentGuideTop } from './cmp/AgentGuideTop'
import { AgentGuide } from './cmp/AgentGuide'
import { AgentGuideFeature } from './cmp/AgentGuideFeature'
import { License } from './cmp/License'
import { Security } from './cmp/Security'
import { Changelog } from './cmp/Changelog'
import { Test } from './cmp/Test'
import { ReadmeInstall } from './cmp/ReadmeInstall'
import { ReadmeQuick } from './cmp/ReadmeQuick'
import { ReadmeErrors } from './cmp/ReadmeErrors'
import { ReadmeIntro } from './cmp/ReadmeIntro'
import { ReadmeModel } from './cmp/ReadmeModel'
import { ReadmeOptions } from './cmp/ReadmeOptions'
import { ReadmeEntity } from './cmp/ReadmeEntity'
import { ReadmeHowto } from './cmp/ReadmeHowto'
import { ReadmeExplanation } from './cmp/ReadmeExplanation'
import { ReadmeRef } from './cmp/ReadmeRef'
import { ReadmeRefFeatures } from './cmp/ReadmeRefFeatures'
import { FeatureHook } from './cmp/FeatureHook'
import { registerComponent } from './cmp/Registered'
import type { RegisterOptions } from './cmp/Registered'

import { buildIdNames } from './helpers/buildIdNames'
import { getMatchEntries } from './helpers/getMatchEntries'
import { collectDeps } from './helpers/collectDeps'
import type { DepEntry } from './helpers/collectDeps'
import { canonToType, canonToDtype, canonKey, canonScalarKey } from './helpers/canonType'
import { OP_SUFFIX, opTypeName, opParams, ownPoint, opActions, entityActions, entityPath, opRequestShape, entityIdField, entityDataIdField, entityOps, entityPrimaryOp, pickExampleEntity, entityClassName, entityTypeCollisions, warnEntityTypeCollisions, deriveEntityNames, entityCollection } from './helpers/opShape'
import { isReservedName, safeVarName, exampleVarName, phpEntityAccessor, entityCacheField, isRbCoreConstant, isRbSdkConstant, rbSafeTypeName, isSwiftSdkType, swiftSafeTypeName, isPhpReservedType, isPhpSdkClass, phpSafeTypeName, isTsReservedType, tsSafeTypeName, jsProp, jsOptProp, jsKey } from './helpers/naming'
import { serverVariables, hasServerVariables } from './helpers/serverVars'
import { primaryOpCall, idLiteral, matchArg, dataArg, litFor } from './helpers/opExample'
import type { ExampleLang } from './helpers/opExample'
import { liveStrict } from './helpers/testPolicy'
import {
  featureOf,
  availableFeatures,
  findFeatureSources,
  featureExcludes,
  fullsetExcludes,
  srcFeatureExcludes,
} from './helpers/featureSource'
import type { FeatureSource } from './helpers/featureSource'
import { stationLibrary } from './helpers/station'
import {
  definitionPath,
  definitionFolder,
  definitionNames,
} from './helpers/definition'
import { isNoise, copyOpts } from './helpers/junk'
import {
  MANIFEST,
  manifestPath,
  readManifest,
  validateManifest,
} from './helpers/manifest'
import type { Manifest, ManifestRead } from './helpers/manifest'
import {
  packageName,
  installCommand,
  registryState,
  isPublished,
  registryName,
  vendorCommand,
  pkgDescription,
  nonAffiliation,
  keywords,
  authorInfo,
  contributorList,
  envName,
  envToken,
  goModule,
  goVersion,
  goPackageIdent,
  packageVersion,
  repoInfo,
  apiName,
  langLabel,
  originName,
  PUBLISHER,
  PUBLISHER_URL,
  SECURITY_EMAIL,
  GENERATOR_URL,
} from './helpers/packageMeta'


import {
  action_target,
  target_add,
} from './action/target'

import {
  action_feature,
  feature_add,
} from './action/feature'

import {
  action_doctor,
  doctor,
} from './action/doctor'
import type { DoctorReport } from './action/doctor'

import {
  action_package,
  package_add,
  package_update,
} from './action/package'

import { cmd_package_check } from './action/check'

import { docs_add } from './action/docs'

// The verbs, built from the kind registry — see action/dispatch.
import { ACTION_MAP, actionNames, needsModel } from './action/dispatch'



// TODO: use shape
type SdkGenOptions = {
  folder: string
  fs: any
  root?: string
  def?: string
  model?: {
    folder: string
    entity: any
  }
  meta?: {
    name: string
  }
  debug?: boolean | string
  pino?: any, // ReturnType<typeof Pino>
  now?: () => number

  // TODO: match Jostraca
  existing?: {
    txt?: any
    bin?: any
  }

  dryrun?: boolean
}


const { Jostraca } = JostracaModule


// A BROKEN PROJECT MODEL IS THE USER'S FILE, NOT A CRASH.
//
// One constructor for both routes out of `resolveModel` — the throw aontu
// actually takes, and the `errs` array it documents but never fills — because
// two spellings of the same error is how this repo keeps reintroducing the
// same defect.
//
// aontu's own diagnostic is the valuable part and is passed through
// UNTOUCHED: it carries the source excerpt, a caret under the offending
// token, and an explanation. What it lacks is any statement of WHOSE file
// this is, so the path leads. Wrapping it in an SdkGenError is what makes the
// CLI print it as a message instead of dumping the error object and a stack
// trace through sdkgen's internals — `handleError` reserves clean output for
// that name.
function modelError(path: string, cause: any, rooterrs: any[]): any {
  const detail = String(cause?.msg ?? cause?.message ?? cause ?? '').trim()

  const err: any = new SdkGenError(
    'Model Error: ' + path + '\n' + detail)

  err.cause$ = [cause]
  err.rooterrs$ = rooterrs

  // A syntax error is the user's typo, and there is nothing for them to do
  // with a stack. `why` lives on the structured entries rather than the
  // thrown wrapper, so it is read from the first of them.
  if ('syntax' === (cause?.why ?? rooterrs?.[0]?.why)) {
    err.uxmsg$ = true
  }

  return err
}


function SdkGen(opts: SdkGenOptions) {
  const fs = opts.fs || Fs
  const folder = opts.folder || '../'
  const now = opts.now || (() => Date.now())

  // Per-instance cache of the Aontu model loader. Previously a module-level
  // global, which leaked the (relative) preload across SdkGen instances.
  let aontu: any = null

  const jopts = {
    now,
    control: {
      dryrun: opts.dryrun
    },
    // Generated SDK output is fully model-derived and never hand-edited, so
    // OVERWRITE existing files on regenerate (jostraca's default). Do NOT enable
    // the 3-way `merge` here: it merges against a `.jostraca` base that drifts
    // from the toolchain, which (a) silently KEEPS a stale generated file when a
    // template adds a field a newer component references (-> `undefined: X`
    // compile errors, e.g. Control.Actor / Result.Stream), and (b) injects
    // `<<<<<<<` conflict markers when a generated/index file is touched, which
    // then break downstream parsers (aontu) and compilers. Overwrite makes
    // generation deterministic: same model -> byte-stable output.
    // See docs/explanation/regeneration-overwrite.md.
    existing: {
      txt: {
        write: true,
        merge: false
      }
    },
    // No copied tree carries a maintainer's `.DS_Store` or `__pycache__` into
    // an SDK. Set here AND per call (see helpers/junk) — the actions run on
    // whatever instance their caller supplies, so neither placement covers
    // every path on its own.
    cmp: copyOpts()
  }

  const jostraca = Jostraca(jopts)

  const pino = prettyPino('sdkgen', opts)
  const log = pino.child({ cmp: 'sdkgen' })


  async function generate(spec: any) {
    const start = Date.now()
    const { model, config } = spec

    log.info({ point: 'generate-start', start, note: opts.dryrun ? '** DRY RUN **' : '' })
    log.debug({ point: 'generate-spec', spec })

    let Root = spec.root

    if (null == Root && null != config?.root) {
      clear(config.root)
      const rootModule: any = require(config.root)
      Root = rootModule.Root
    }

    const jopts = {
      fs: () => fs,
      folder,
      log: log.child({ cmp: 'jostraca' }),
      meta: { spec },
      debug: opts.debug,
      // Respect the caller's `existing` policy (the .sdk/build/sdkgen.js action
      // config). SDK output should be OVERWRITE, not 3-way merge — that is set
      // at the scaffold source (create-sdkgen build/sdkgen.js: existing.txt =
      // { write:true, merge:false }); see docs/explanation/regeneration-overwrite.md.
      existing: opts.existing,
      // Per-call, for the same reason the actions pass it: jostraca applies
      // OptionsShape to `generate`'s own options first, so its
      // `control.dryrun: false` default wins over the instance-level flag.
      control: {
        dryrun: !!opts.dryrun
      },
      // Per-call for the same reason as `control` above: an option the
      // instance carries is not reliably the one a generate sees.
      cmp: copyOpts(),
    }

    // Targets that write OUTSIDE the SDK repo (`output: path`) are generated
    // by their own pass, rooted at that path — see cmp/ExternalTarget for why
    // a folder name cannot do this. The in-tree pass must not see them, or
    // the consumer Root would also emit them into `<sdk-repo>/<target>/`.
    //
    // `folder` may be relative (a consumer's build passes '..' from `.sdk`),
    // so resolve it ONCE: every destination is compared against it, and a
    // comparison between a relative and an absolute path is meaningless.
    const root = Path.resolve(folder)
    // Snapshot the decision before preflight. In particular, do not check a
    // missing optional destination once for safety and AGAIN before writing:
    // if it appeared between those checks, the pass could write into content
    // that was never ownership-validated.
    const external: ExternalPlan[] =
      externalItems(model, root, ['target', 'docs'])
        .map((ext) => ({ ...ext, skip: externalSkipReason(ext, fs) }))

    // Before ANY file is written, in-tree included: a destination that turns
    // out to be wrong must abort the whole generation, not leave half of it
    // done. See checkExternalFolders.
    checkExternalFolders(external, root, fs)

    const jres = await jostraca.generate(
      jopts, () => Root({ model: 0 === external.length ? model : withoutExternal(model, external) }))

    showChanges(jopts.log, 'generate-result', jres, Path.dirname(process.cwd()))

    // IN-TREE DOCS, in their own pass over the same root.
    //
    // The alternative is one `Kinds()` call in the consumer's `Root.ts` —
    // which create-sdkgen writes once and never revisits, so every project
    // scaffolded before the docs kind existed would have to be hand-edited
    // before `docs add` did anything. A second pass costs one more changes
    // report and makes the kind work in projects that predate it, which is
    // the whole point of putting the destinations in packages.
    //
    // Items with `output: path` are excluded here and generated by the loop
    // below, exactly as out-of-tree targets are.
    const intreedocs = Object.keys(model?.main?.[KIT]?.docs ?? {})
      .filter((name: string) => {
        const item = model.main[KIT].docs[name]
        const path = item?.output?.path
        return false !== item?.active && (null == path || '' === path)
      })

    // AN IN-TREE DOCS ITEM AND A TARGET CANNOT SHARE A NAME.
    //
    // `docs` and `target` are separate namespaces — deliberately, so an item
    // of each may be called `api` — and their `.sdk` trees are nested apart
    // (`src/cmp/docs/<n>` vs `src/cmp/<n>`), so installing both is fine.
    //
    // Their GENERATED destinations are not separate. Both render into
    // `<sdk-repo>/<name>/`, the docs pass runs second, and jostraca is
    // last-write-wins — so a docs item named `go` would quietly overwrite the
    // Go SDK's README, and whatever else the two have in common, leaving a
    // corrupt SDK and a green run.
    //
    // Refused rather than reordered, and refused BEFORE the docs pass writes
    // anything: this is the in-tree half of the rule `checkExternalFolders`
    // enforces for out-of-tree destinations, and the fix is the same either
    // way — give one of them `output: path`, or rename it.
    const targets: any = model?.main?.[KIT]?.target ?? {}

    for (const name of intreedocs) {
      const target = targets[name]

      if (null == target || false === target.active) {
        continue
      }

      const tpath = target.output?.path

      if (null != tpath && '' !== tpath) {
        continue
      }

      throw new SdkGenError(
        'Docs item "' + name + '" and target "' + name + '" would both ' +
        'generate into <sdk-project>/' + name + '/.\n' +
        '  They are separate kinds, so sharing a name is legal — but they ' +
        'share one output folder, and the docs pass runs second, so it ' +
        'would overwrite the SDK.\n' +
        '  Give one of them `output: path`, or rename it.')
    }

    if (0 < intreedocs.length) {
      log.info({
        point: 'generate-docs-start', docs: intreedocs,
        note: intreedocs.join(', ')
      })

      const dres = await jostraca.generate(jopts, () => Docs({ model }))

      showChanges(jopts.log, 'generate-docs-result', dres,
        Path.dirname(process.cwd()))
    }

    for (const ext of external) {
      // A skipped external target is still removed from the in-tree model
      // above: neither `active: false` nor a missing `output.create: false`
      // destination may relocate it into `<sdk-repo>/<target>/`.
      // The snapshot is deliberately not re-taken to ADMIT an item: a
      // destination that appeared since would be written without ever having
      // been ownership-validated. Re-taking it to SKIP one is the opposite
      // direction and cannot open that hole. Without this, an optional
      // destination deleted or moved between the snapshot and this pass is
      // recreated by jostraca's ensureDir — exactly what `output.create:
      // false` promises not to do.
      const gone = false === ext.target.output?.create && !fs.existsSync(ext.folder)

      if (null != ext.skip || gone) {
        log.info({
          point: 'generate-external-skip', target: ext.name, folder: ext.folder,
          note: ext.skip ?? (ext.name + ' output folder disappeared after ' +
            'preflight and output.create=false, not generated')
        })
        continue
      }

      log.info({
        point: 'generate-external', target: ext.name, folder: ext.folder,
        note: ext.name + ' -> ' + ext.folder
      })

      const sdkrelpath = externalSdkRel(ext, root, log)

      const eres = 'docs' === ext.kind ?
        await jostraca.generate(
          { ...jopts, folder: ext.folder },
          () => ExternalDocs({
            model, item: ext.target, cmpfolder: folder, sdkrelpath,
          })) :
        await jostraca.generate(
        { ...jopts, folder: ext.folder },
        () => ExternalTarget({
          model, target: ext.target, cmpfolder: folder,
          // How to walk BACK to the SDK project from the destination. An
          // item generating out of tree usually sits beside the SDK in a
          // known layout, and its own docs, scripts and live tests need to
          // name that path.
          sdkrelpath,
        }))

      showChanges(jopts.log, 'generate-result', eres, Path.dirname(process.cwd()))
    }

    log.info({ point: 'generate-end' })

    return { ok: true, name: 'sdkgen' }
  }


  // Action arguments are PATHS AND NAMES, and they reach the actions as the
  // raw strings the shell gave us.
  //
  // They used to be mapped through `Jsonic(arg)` first, which parses each one
  // as relaxed JSON — so a Windows absolute ref arrived as an OBJECT:
  // `Jsonic('C:\\pkg\\go')` is `{ C: '\\pkg\\go' }`, and every downstream path
  // join then missed. (`ts,py` also became `['ts','py']`, which is why
  // parseAddNames still carries a non-string branch; it splits on commas
  // itself, so nothing is lost by handing it strings.)
  //
  // Nothing here wants structured arguments: every action takes names and
  // refs. Parsing them was pure loss.
  //
  // `flags` is the second parameter because `--only` and `--alias` are
  // arguments to ONE command, not generator configuration: passing them
  // through `SdkGen({…})` like `debug`/`dryrun` would make a later
  // `action()` call on the same instance silently inherit them.
  async function action(
    args: string[], flags?: Record<string, any>,
  ): Promise<any> {
    const actname = args[0]
    const actionFunc = ACTION_MAP[actname]

    if (null == actionFunc) {
      throw new SdkGenError(
        'Unknown action: ' + actname +
        ' (expected: ' + actionNames().join(', ') + ')')
    }

    const ctx = resolveActionContext(flags, needsModel(args))

    return await actionFunc(args, ctx)
  }


  function resolveActionContext(
    flags?: Record<string, any>, wantmodel?: boolean,
  ): ActionContext {

    // TODO: use AsyncLocalStorage to avoid reloading model
    const { model, url } = resolveModel(false !== wantmodel)

    const ctx: ActionContext = {
      fs: () => fs,
      log,
      folder: '.', // The `generate` folder,
      model,
      url,
      jostraca,
      opts,
      flags: flags ?? {},
    }

    return ctx
  }


  function resolveModel(wanted: boolean) {
    const path = './model/sdk.aon'
    const errs: any[] = []

    // A verb that does not act on a project (see `needsModel`) is run where
    // there is no project model, so its absence is not an error there. Its
    // PRESENCE still is compiled — an author checking a package from inside a
    // project should get the same model every other verb gets.
    if (!wanted && !fs.existsSync(path)) {
      return { model: { main: {} } as any, url: path }
    }

    if (null == aontu) {
      aontu = new Aontu()
    }

    const aopts = { path, errs }
    const src = fs.readFileSync(path, 'utf8')

    // AONTU THROWS; IT DOES NOT FILL `errs`.
    //
    // The `errs` array is handed to `generate` and stays empty on every
    // failure — syntax, unresolved path and unify conflict alike all raise an
    // AontuError instead (verified against 0.52 by running each). So the
    // `0 < errs.length` branch this used to have could never fire, and every
    // broken project model reached the CLI as a bare AontuError: `handleError`
    // prints the raw object for anything that is not an SdkGenError, so the
    // user got aontu's diagnostic followed by a stack trace into sdkgen's
    // `dist/` and a dump of the error's own fields. It read as an sdkgen
    // crash rather than a problem in their own file.
    //
    // The array is still passed, and still checked below, because that is
    // aontu's documented option and a later version may start using it. Both
    // routes build the error the same way, so they cannot drift.
    let model: any

    try {
      model = aontu.generate(src, aopts)
    }
    catch (aerr: any) {
      if (true !== aerr?.aontu) {
        throw aerr
      }

      // The structured errors are reachable after all — the thrown error
      // carries the accessor the empty array was standing in for.
      throw modelError(path, aerr,
        'function' === typeof aerr.errs ? aerr.errs() : [])
    }

    if (0 < errs.length) {
      throw modelError(path, errs[0], errs)
    }

    model.const = { name: model.name }

    names(model.const, model.name)

    model.const.year = new Date().getFullYear()

    return {
      model,
      url: path,
    }
  }


  const target = {
    add: async (targets: string[]): Promise<ActionResult> => {
      const ctx = resolveActionContext()
      return target_add(targets, ctx)
    }
  }

  const feature = {
    add: async (features: string[]): Promise<ActionResult> => {
      const ctx = resolveActionContext()
      return feature_add(features, ctx)
    }
  }

  // The third kind. sdkgen ships no docs items, so every ref here is a path
  // into a package — see action/docs.
  const docs = {
    add: async (items: string[]): Promise<ActionResult> => {
      const ctx = resolveActionContext()
      return docs_add(items, ctx)
    }
  }

  // The whole-package verbs. `flags` mirrors the CLI's `--only` / `--alias`,
  // for the same reason they are `action`'s second parameter rather than
  // constructor options: they are arguments to one call.
  const packages = {
    add: async (
      refs: string[], flags?: Record<string, any>,
    ): Promise<ActionResult> => {
      const ctx = resolveActionContext(flags)
      return package_add(refs, ctx)
    },

    list: async (): Promise<ActionResult> => {
      const ctx = resolveActionContext()
      return action_package(['package', 'list'], ctx)
    },

    update: async (
      names: string[], flags?: Record<string, any>,
    ): Promise<ActionResult> => {
      const ctx = resolveActionContext(flags)
      return package_update(names, ctx)
    },

    // Validate a package being AUTHORED — see action/check. The only verb
    // here that does not need a project model, because it does not act on a
    // project; `false` says so to `resolveActionContext`.
    check: async (refs?: string[]): Promise<ActionResult> => {
      const ctx = resolveActionContext(undefined, false)
      return cmd_package_check(['package', 'check', ...(refs ?? [])], ctx)
    },
  }

  // Has this project's `.sdk/` drifted from the scaffold? See action/doctor.
  const check = async (): Promise<ActionResult> => {
    const ctx = resolveActionContext()
    return doctor(ctx)
  }



  return {
    pino: pino as any,
    generate,
    action,
    check,
    docs,
    target,
    feature,

    // `package` is a reserved word in a strict-mode object shorthand, so the
    // local binding is `packages` and the PUBLIC name matches the CLI verb.
    package: packages,
  }

}


SdkGen.makeBuild = async function(opts: SdkGenOptions) {
  let sdkgen: any = undefined
  // let apidef: any = undefined

  const config = {
    root: opts.root,
    def: opts.def || 'no-def',
    kind: 'openapi-3',
    model: opts.model ? (opts.model.folder + '/api.aon') : 'no-model',
    meta: opts.meta || {},
  }

  return async function build(model: any, build: any, ctx: any) {
    if (null == sdkgen) {
      sdkgen = SdkGen({
        ...opts,
        pino: build.log,
        debug: build.spec.debug,
      })
    }

    // await apidef.generate({ model, build, config })
    return await sdkgen.generate({ model, build, config })
  }
}



type ExternalSpec = {
  // Which kind's collection this item came from — `target` or `docs`. The
  // out-of-tree rules are the same for both; only the dispatch differs.
  kind: string
  name: string
  target: any
  folder: string
  active: boolean
}


type ExternalPlan = ExternalSpec & {
  // Snapshotted before destination validation and consumed unchanged by the
  // generation loop, so a filesystem race cannot bypass the safety guard.
  skip: string | null
}


// Targets declaring `output: path` — generated into their own repo rather
// than into `<sdk-repo>/<target>/`.
//
// A relative path resolves against the SDK repo root, so a sibling checkout
// is '../<repo>'. That is deliberately the SAME base the generator writes
// everything else against: a path in the model should not depend on the
// directory the command happened to be run from.
//
// An INACTIVE target is still listed: it must be taken out of the in-tree
// model (see withoutExternal) so that switching it off does not silently
// relocate it into `<sdk-repo>/<target>/`. The generate loop skips it.
// Every item, of every kind, that generates OUTSIDE the SDK repo.
//
// Keyed by kind because `docs` needs exactly this and a second copy of it
// would drift: the out-of-tree rules — a destination must be outside the
// project, unclaimed, and either empty or previously generated into — are
// properties of WRITING SOMEWHERE ELSE, not of being a target.
//
// The claim map spanning kinds is the load-bearing part: a docs item and a
// target pointed at the same folder would otherwise silently overwrite each
// other, in whatever order the passes happen to run.
function externalItems(
  model: any, folder: string, kinds: string[],
): ExternalSpec[] {
  return kinds.flatMap((kind: string) => {
    const items = model?.main?.[KIT]?.[kind] || {}

    return Object.keys(items).sort()
      .map((name: string) => ({ kind, name, target: items[name] }))
      .filter((t: any) => {
        const path = t.target?.output?.path
        return null != path && '' !== path
      })
      .map((t: any) => ({
        ...t,
        folder: Path.resolve(folder, String(t.target.output.path)),
        active: false !== t.target.active,
      }))
  })
}


// Why this external item should not get a generation pass RIGHT NOW.
//
// `active: false` disables the target itself. `output.create: false` does
// something deliberately narrower: the target stays active in the model but
// an absent destination is treated as an optional checkout rather than a
// folder sdkgen should fabricate. If that repo is checked out later, the same
// unchanged model generates it normally.
//
// Snapshotted into ExternalPlan because both the pre-write destination guard
// and the actual pass must make the identical decision. If the guard skipped
// an item that the pass did not, generation could write outside the project
// without any of the ownership checks below.
function externalSkipReason(ext: ExternalSpec, fs: any): string | null {
  if (!ext.active) {
    return ext.name + ' inactive, not generated'
  }

  if (false === ext.target.output?.create && !fs.existsSync(ext.folder)) {
    return ext.name + ' output folder does not exist and ' +
      'output.create=false, not generated'
  }

  return null
}


// The `.jostraca` bookkeeping tree (meta log + a duplicate of the last
// generated output) that jostraca leaves at an output root. It is the only
// on-disk evidence that this toolchain has generated into a directory
// before, so it doubles as the OWNERSHIP MARKER: a destination carrying one
// has been generated into already, whoever set it up.
const EXTERNAL_MARKER = '.jostraca'

// Entries that do not count as content when deciding whether a destination
// is empty. A `git init` (or a clone of an empty repo) leaves only `.git`, and
// that is exactly the destination a FIRST generation is aimed at — as is one
// the maintainer opened in the Finder on the way to declaring it.
//
// `isNoise`, not `isJunk`: a destination holding build output is not empty,
// whether or not sdkgen would ever copy such a thing. See helpers/junk.


// Refuse a destination the project cannot have meant.
//
// The external pass is the one code path that writes outside the repo it was
// pointed at, at a filesystem path taken verbatim from the model — and
// generation is overwrite, not merge, while jostraca's ensureDir creates
// missing parents. So a mistyped `output: path` does not fail: it fabricates
// a package tree at an arbitrary location, or overwrites an unrelated repo's
// package.json, README.md, LICENSE and CI workflow in place. The only trace
// was one INFO line naming the resolved folder.
//
// A destination must therefore be:
//   - outside the SDK project, in BOTH directions — inside it is what a
//     typo like '.' or 'ts' produces (and the external pass runs SECOND, so
//     it wins over what the in-tree pass just wrote), while a destination
//     that CONTAINS the project is what '..' produces;
//   - claimed by no other target;
//   - and either absent, empty, or carrying the marker a previous
//     generation left there.
//
// Anything else is refused with both paths named. NOT skipped: a project
// generating somewhere other than it believes must be told. A destination
// that legitimately holds other content first (a repo seeded with a README
// and LICENCE) says so once in the model, with `output: adopt: true`.
function checkExternalFolders(external: ExternalPlan[], root: string, fs: any) {
  const claimed: Record<string, string> = {}

  for (const ext of external) {
    // An INACTIVE item writes nothing and claims nothing: it is out of the
    // model for this run.
    //
    // An item skipped only because its optional destination is absent is a
    // different case. Path containment and the duplicate claim are model
    // invariants — they do not depend on folder contents — so skipping them
    // here let two items claim one absent path: the ordinary one generated
    // there, and the NEXT identical run then saw the folder, detected the
    // duplicate, and refused everything. The failure appeared one run after
    // the mistake. Validate the path; the `existsSync` guard below still
    // skips every check that reads the folder.
    if (!ext.active) continue

    const label = ext.kind.charAt(0).toUpperCase() + ext.kind.slice(1)

    const where = label + ' "' + ext.name + '" has output path "' +
      ext.target.output.path + '", which resolves to: ' + ext.folder +
      '\n  (SDK project: ' + root + ')'

    if (ext.folder === root || folderContains(root, ext.folder)) {
      throw new SdkGenError(
        'External output path is inside the SDK project.\n  ' + where +
        '\n  An item generating into the SDK project must leave `output: ' +
        'path` unset — it is then generated in-tree, as <sdk-project>/' +
        ext.name + '/.')
    }

    if (folderContains(ext.folder, root)) {
      throw new SdkGenError(
        'External output path contains the SDK project.\n  ' + where +
        '\n  Generation would write this package over the directory holding ' +
        'the SDK project itself.')
    }

    // ACROSS KINDS, not within one: `docs` and `target` are separate
    // namespaces, so an item of each may legitimately be called `api` — and
    // pointing both at one folder is the mistake this catches.
    if (null != claimed[ext.folder]) {
      throw new SdkGenError(
        'External output path is already claimed by ' +
        claimed[ext.folder] + '.\n  ' + where +
        '\n  Two items generating into the same folder overwrite each ' +
        'other, in whatever order the passes run.')
    }
    claimed[ext.folder] = ext.kind + ' "' + ext.name + '"'

    if (!fs.existsSync(ext.folder)) continue

    if (!fs.statSync(ext.folder).isDirectory()) {
      throw new SdkGenError(
        'External output path is not a folder.\n  ' + where)
    }

    if (true === ext.target.output.adopt) continue

    const entries: string[] = fs.readdirSync(ext.folder)
      .map((entry: any) => String(entry))

    if (entries.includes(EXTERNAL_MARKER)) continue

    const content = entries.filter((entry) => !isNoise(entry))

    if (0 < content.length) {
      throw new SdkGenError(
        'External target output folder already holds content this generator ' +
        'did not write.\n  ' + where +
        '\n  Found: ' + content.slice(0, 8).join(', ') +
        (8 < content.length ? ', ...' : '') +
        '\n  Generation OVERWRITES, so this would replace that content. ' +
        'Check the path;\n  if the folder is right, declare it: `main: kit: ' +
        'target: \'' + ext.name + '\': output: adopt: true`.')
    }
  }
}


// Is `path` inside `folder`? Both must already be resolved. Path.relative
// rather than a string prefix, so that a sibling whose name merely STARTS
// with the folder's ('/x/sdk' vs '/x/sdk-provider') is not read as nested.
function folderContains(folder: string, path: string): boolean {
  const rel = Path.relative(folder, path)
  return '' !== rel && !rel.startsWith('..' + Path.sep) && '..' !== rel &&
    !Path.isAbsolute(rel)
}


// The path from the destination back to the SDK project, which the target's
// own docs, scripts and live tests name (the companion test server lives in
// the SDK repo and is not published).
//
// It is DERIVED from the two resolved folders by default, which is only
// honest while the walk back crosses nothing the model does not name. It
// does not for `output: path: '../<repo>'`; it does for anything ascending
// further. voxgig-solardemo-sdk declares '../../seneca/solardemo-provider'
// and the derived inverse came out as '../../voxgig-sdk/voxgig-solardemo-sdk'
// — where `voxgig-sdk` is the name of the WORKSPACE DIRECTORY holding the SDK
// checkout on one machine, no part of the model. That string is committed
// into the destination's README.md and three test files, so a second
// developer with the same two repos under a differently named parent
// regenerates a spurious diff in tracked files and an instruction path that
// is wrong on the first machine.
//
// So a project that ascends further declares the walk back explicitly, as
// `output: sdkrel`, and is warned until it does.
function externalSdkRel(ext: ExternalSpec, root: string, log: any): string {
  const declared = String(ext.target.output?.sdkrel || '')
  if ('' !== declared) return declared

  const derived = Path.relative(ext.folder, root).split(Path.sep).join('/')

  // Every segment that is not '..' is a real directory name on the way back
  // down to the SDK project. The LAST is the project's own folder; any
  // earlier one is a directory ABOVE it, which nothing in the model declares.
  const named = derived.split('/').filter((seg) => '..' !== seg)

  if (1 < named.length) {
    log.warn({
      point: 'external-sdkrel-derived', target: ext.name, sdkrel: derived,
      note: ext.name + ': path back to the SDK project derived as \'' +
        derived + '\', which names ' + (named.length - 1) +
        ' directory(s) above the SDK project that the model does not ' +
        'declare — this machine\'s layout will be committed to the ' +
        'generated files. Declare `output: sdkrel` instead.'
    })
  }

  return derived
}


// The model the IN-TREE pass sees: the same model with the out-of-tree
// targets taken out.
//
// A shallow clone down to `target` only — the model is large, entities and
// features are shared with the external pass, and a deep copy would both
// cost and quietly break identity comparisons.
// The model the IN-TREE pass sees: every out-of-tree item removed, whatever
// its kind. Rendering one in both passes would ALSO write it into
// `<sdk-repo>/<name>/`, which is the folder the item asked not to use.
function withoutExternal(
  model: any, external: { kind: string, name: string }[],
): any {
  const drop = new Set(external.map((e) => e.kind + ':' + e.name))

  const kit: any = { ...model.main[KIT] }

  for (const kind of new Set(external.map((e) => e.kind))) {
    const items = model?.main?.[KIT]?.[kind] || {}
    const kept: any = {}

    for (const name of Object.keys(items)) {
      if (!drop.has(kind + ':' + name)) {
        kept[name] = items[name]
      }
    }

    kit[kind] = kept
  }

  return {
    ...model,
    main: { ...model.main, [KIT]: kit },
  }
}


// Adapted from https://github.com/sindresorhus/import-fresh - Thanks!
function clear(path: string) {
  if (null == path) {
    return
  }

  let filePath = require.resolve(path)

  if (require.cache[filePath]) {
    const children = require.cache[filePath].children.map(child => child.id)

    // Delete module from cache
    delete require.cache[filePath]

    for (const id of children) {
      clear(id)
    }
  }


  if (require.cache[filePath] && require.cache[filePath].parent) {
    let i = require.cache[filePath].parent.children.length

    while (i--) {
      if (require.cache[filePath].parent.children[i].id === filePath) {
        require.cache[filePath].parent.children.splice(i, 1)
      }
    }
  }

}




export type {
  SdkGenOptions,
  ExampleLang,
  DepEntry,
  FeatureSource,
  DoctorReport,
  RegisterOptions,
  Manifest,
  ManifestRead,
}

export type {
  SdkModel,
  ModelKit,
  ModelTarget,
  ModelFeature,
  ModelEntity,
  ModelDep,
  ModelHook,
} from './types'



type Component = (props: any, children?: any) => void


// Prevents TS2742
export const cmp: (component: Function) => Component = JostracaModule.cmp
export const names: (base: any, name: string, prop?: string) => any = JostracaModule.names
export const each: (subject?: any, apply?: any) => any = JostracaModule.each
export const snakify: (input: any[] | string) => string = JostracaModule.snakify
export const camelify: (input: any[] | string) => string = JostracaModule.camelify
export const kebabify: (input: any[] | string) => string = JostracaModule.kebabify
export const cmap: (o: any, p: any) => any = JostracaModule.cmap
export const vmap: (o: any, p: any) => any = JostracaModule.vmap
export const get: (root: any, path: string | string[]) => any = JostracaModule.get
export const getx: (root: any, path: string | string[]) => any = JostracaModule.getx
export const template: (root: any, path: string | string[]) => any = JostracaModule.template
export const indent: (src: string, indent: string | number | undefined) => any = JostracaModule.indent

export const deep: (...args: any[]) => any = JostracaModule.deep
export const omap: (...args: any[]) => any = JostracaModule.omap


export const Project: Component = JostracaModule.Project
export const Folder: Component = JostracaModule.Folder
export const File: Component = JostracaModule.File
export const Content: Component = JostracaModule.Content
export const Copy: Component = JostracaModule.Copy
export const Fragment: Component = JostracaModule.Fragment
export const Inject: Component = JostracaModule.Inject
export const Line: Component = JostracaModule.Line
export const Slot: Component = JostracaModule.Slot
export const List: Component = JostracaModule.List


export {
  Main,
  Deploy,
  License,
  Security,
  Changelog,
  Entity,
  Feature,
  Test,
  Readme,
  ReadmeTop,
  AgentGuideTop,
  AgentGuide,
  AgentGuideFeature,
  ReadmeInstall,
  ReadmeQuick,
  ReadmeErrors,
  ReadmeIntro,
  ReadmeModel,
  ReadmeOptions,
  ReadmeEntity,
  ReadmeHowto,
  ReadmeExplanation,
  ReadmeRef,
  ReadmeRefFeatures,
  FeatureHook,
  registerComponent,

  Jostraca,
  SdkGen,

  requirePath,
  isAuthActive,
  resolveAuthPrefix,
  isHttpBasicAuth,
  CONFIG_DATA_THRESHOLD,
  CONFIG_REPR_VALUES,
  isConfigData,
  configRepr,
  configReprSetting,
  configDefinition,
  clean,
  rawStringLiteral,

  // Scaffold components need this to fail a generation with an actionable
  // message rather than a bare Error (py-data guards on its sibling `py`).
  SdkGenError,

  buildIdNames,
  getMatchEntries,
  collectDeps,
  canonToType,
  canonToDtype,
  canonKey,
  canonScalarKey,

  OP_SUFFIX,
  opTypeName,
  opParams,
  ownPoint,
  opActions,
  entityActions,
  entityPath,
  opRequestShape,
  entityIdField,
  entityDataIdField,
  entityOps,
  entityPrimaryOp,
  pickExampleEntity,
  entityClassName,
  entityTypeCollisions,
  warnEntityTypeCollisions,
  deriveEntityNames,
  entityCollection,
  isReservedName,
  safeVarName,
  exampleVarName,
  phpEntityAccessor,
  entityCacheField,
  isRbCoreConstant,
  isRbSdkConstant,
  rbSafeTypeName,
  isSwiftSdkType,
  swiftSafeTypeName,
  isPhpReservedType,
  isPhpSdkClass,
  phpSafeTypeName,
  isTsReservedType,
  tsSafeTypeName,
  serverVariables,
  hasServerVariables,
  liveStrict,
  primaryOpCall,
  idLiteral,
  matchArg,
  dataArg,
  litFor,
  featureOf,
  availableFeatures,
  findFeatureSources,
  featureExcludes,
  fullsetExcludes,
  srcFeatureExcludes,
  stationLibrary,

  featureApplies,
  targetFeatures,
  featureTags,
  unknownTags,
  TAGS,

  definitionPath,
  definitionFolder,
  definitionNames,

  MANIFEST,
  manifestPath,
  readManifest,
  validateManifest,

  jsProp,
  jsOptProp,
  jsKey,

  packageName,
  installCommand,
  registryState,
  isPublished,
  registryName,
  vendorCommand,
  pkgDescription,
  nonAffiliation,
  keywords,
  authorInfo,
  contributorList,
  envName,
  envToken,
  goModule,
  goVersion,
  goPackageIdent,
  packageVersion,
  repoInfo,
  apiName,
  langLabel,
  originName,
  PUBLISHER,
  PUBLISHER_URL,
  SECURITY_EMAIL,
  GENERATOR_URL,
}
