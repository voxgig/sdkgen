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

import { SdkGenError, requirePath, isAuthActive, resolveAuthPrefix, resolveAuthIn, resolveAuthName, isAuthSuppressed, isHttpBasicAuth,
  CONFIG_DATA_THRESHOLD, CONFIG_REPR_VALUES, isConfigData, configRepr,
  configReprSetting, configDefinition, clean, rawStringLiteral } from './utility'

import { Main } from './cmp/Main'
import { featureApplies, targetFeatures, featureTags, unknownTags, TAGS } from './helpers/applicability'
import { ExternalTarget } from './cmp/ExternalTarget'

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
import { PublishWorkflow } from './cmp/PublishWorkflow'
import { Changelog } from './cmp/Changelog'
import { Test } from './cmp/Test'
import { TestControl, TEST_CONTROL_EXCLUDE } from './cmp/TestControl'
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
import { guardModelNames } from './helpers/modelNames'
import type { DepEntry } from './helpers/collectDeps'
import { canonToType, canonToDtype, canonKey, canonScalarKey } from './helpers/canonType'
import { canonToSpec, entityDataSpec, entityOpSpec, entitySpecs } from './helpers/canonSpec'
import { optionSpec, featureOptionSpec, entitySpecMap } from './helpers/optspec'
import { OP_SUFFIX, opTypeName, opParams, ownPoint, opActions, entityActions, entityPath, opRequestShape, entityIdField, entityDataIdField, entityOps, entityPrimaryOp, pickExampleEntity, entityClassName, entityTypeCollisions, warnEntityTypeCollisions, deriveEntityNames, entityCollection } from './helpers/opShape'
import { isReservedName, safeVarName, exampleVarName, phpEntityAccessor, entityCacheField, isRbCoreConstant, isRbSdkConstant, rbSafeTypeName, isSwiftSdkType, swiftSafeTypeName, isPhpReservedType, isPhpSdkClass, phpSafeTypeName, isTsReservedType, tsSafeTypeName, jsProp, jsOptProp, jsKey, luaKey, prefixLeadingDigit } from './helpers/naming'
import { serverVariables, hasServerVariables, serverVarEnv } from './helpers/serverVars'
import { primaryOpCall, idLiteral, matchArg, dataArg, litFor } from './helpers/opExample'
import type { ExampleLang } from './helpers/opExample'
import { liveStrict } from './helpers/testPolicy'
import { pointSegments, pointParts, pointTerminalParam, pointPathKey }
  from './helpers/pointPath'
import type { PathSegment } from './helpers/pointPath'
import {
  featureOf,
  availableFeatures,
  findFeatureSources,
  featureExcludes,
  fullsetExcludes,
  srcFeatureExcludes,
  pluginExcludes,
  pluginExcludesFor,
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

import { edition_add } from './action/edition'

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

  // WHERE AN OUT-OF-TREE ITEM GOES, DECIDED AT GENERATE TIME RATHER THAN IN
  // THE MODEL. Keyed by item name:
  //
  //   external: { 'seneca-provider': { path: '../..', sdkrel: '.sdksrc/acme-sdk', enclosing: true } }
  //
  // `output: path` in the model is a fact about ONE developer's checkout
  // layout, and it is committed. The same model generated from a different
  // layout is the same model — a different INVOCATION of it, not a second
  // truth to encode — so the second layout belongs here and not in a second
  // committed value that the two layouts then fight over.
  //
  // The case that forced it: a provider repo that carries a tagged checkout
  // of its SDK in a subfolder and regenerates itself from it. The SDK's own
  // committed model cannot describe that, because the SDK does not know it
  // has been cloned into someone else's repo.
  external?: Record<string, ExternalOverride>
}


// See SdkGenOptions.external. `enclosing` is separate from `path` on
// purpose — see checkExternalFolders.
type ExternalOverride = {
  path?: string
  sdkrel?: string
  enclosing?: boolean
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

    // BEFORE ANYTHING READS A NAME. An entity whose name starts with a digit
    // yields identifiers no target language accepts, and the consumer's own
    // Root.ts re-derives those names per target — so the only correction that
    // survives is one made to the model itself, before Root runs. No-op on
    // every model apidef produces; see helpers/modelNames.
    guardModelNames(model, log)

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

    const externalOverride = resolveExternalOverride(opts, log)
    // Snapshot the decision before preflight. In particular, do not check a
    // missing optional destination once for safety and AGAIN before writing:
    // if it appeared between those checks, the pass could write into content
    // that was never ownership-validated.
    const external: ExternalPlan[] =
      externalItems(model, root, ['target'], externalOverride)
        .map((ext) => ({ ...ext, skip: externalSkipReason(ext, fs) }))

    // Before ANY file is written, in-tree included: a destination that turns
    // out to be wrong must abort the whole generation, not leave half of it
    // done. See checkExternalFolders.
    checkExternalFolders(external, root, fs)

    const jres = await jostraca.generate(
      jopts, () => Root({ model: 0 === external.length ? model : withoutExternal(model, external) }))

    showChanges(jopts.log, 'generate-result', jres, Path.dirname(process.cwd()))

    // Docgen owns editions, destinations, templates, text QA and deployment.
    if (model?.main?.[KIT]?.doc?.active !== false && Object.values(model?.main?.[KIT]?.doc?.edition ?? {})
      .some((item: any) => item.active !== false)) {
      const docgenPath = require.resolve('@voxgig/docgen', {
        paths: [Path.join(root, '.sdk')],
      })
      await require(docgenPath).generate({ ...jopts, folder: root, model })
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

      const eres =
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
  const edition = {
    add: async (items: string[]): Promise<ActionResult> => {
      const ctx = resolveActionContext()
      return edition_add(items, ctx)
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
    edition,
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

  // The caller asked, at generate time, to write into a folder that CONTAINS
  // the SDK project. Never read from the model — see SdkGenOptions.external
  // and checkExternalFolders.
  enclosing: boolean
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
// The generate-time override of where out-of-tree items are written.
//
// Two ways in, merged, the environment winning:
//
//   opts.external     the caller holds the config — a build script it owns.
//   SDKGEN_EXTERNAL   JSON, for driving a checkout the caller does NOT own.
//
// The environment matters more than it looks. The case this exists for is a
// repository that carries a tagged checkout of its SDK and regenerates
// itself from it: the script doing that owns neither the SDK's model nor its
// `.sdk/build/sdkgen.js`, so any route that requires editing a file inside
// the checkout means patching someone else's repo on every clone — and the
// point of the exercise was that the clone is disposable.
//
// ONE JSON VARIABLE, not one variable per item per field. Item names carry
// hyphens (`seneca-provider`), so a
// `SDKGEN_EXTERNAL_SENECA_PROVIDER_PATH` scheme needs a name mangling with
// no inverse: `a-b` and `a_b` collide, and nothing can tell which was meant.
function resolveExternalOverride(
  opts: SdkGenOptions, log: any,
): Record<string, ExternalOverride> {
  const declared = opts.external || {}
  const raw = process.env.SDKGEN_EXTERNAL

  if (null == raw || '' === raw.trim()) {
    return declared
  }

  let parsed: any

  try {
    parsed = JSON.parse(raw)
  }
  catch (err: any) {
    throw new SdkGenError(
      'SDKGEN_EXTERNAL is not valid JSON: ' + (err?.message || err) +
      '\n  Expected an object keyed by item name, for example:' +
      '\n    {"seneca-provider":{"path":"../..","sdkrel":".sdksrc/acme-sdk","enclosing":true}}' +
      '\n  Got: ' + raw.slice(0, 200))
  }

  if (null == parsed || 'object' !== typeof parsed || Array.isArray(parsed)) {
    throw new SdkGenError(
      'SDKGEN_EXTERNAL must be a JSON OBJECT keyed by item name, for example:' +
      '\n    {"seneca-provider":{"path":"../..","sdkrel":".sdksrc/acme-sdk","enclosing":true}}' +
      '\n  Got: ' + raw.slice(0, 200))
  }

  const merged: Record<string, ExternalOverride> = { ...declared }

  for (const name of Object.keys(parsed)) {
    merged[name] = { ...(declared[name] || {}), ...(parsed[name] || {}) }
  }

  // LOUDLY. Generation writing somewhere other than the model says is
  // exactly the thing whose only previous trace was one INFO line naming a
  // resolved folder, and that cost a silent green run that emitted nothing.
  const named = Object.keys(parsed).sort()
  log.info({
    point: 'external-override',
    items: named.join(','),
    note: 'SDKGEN_EXTERNAL overrides the output of: ' + named.join(', '),
  })

  return merged
}


// SDK targets can generate into separately owned repositories. Documentation
// editions are confined to this SDK repository and are handled by docgen.
function externalItems(
  model: any, folder: string, kinds: string[],
  override: Record<string, ExternalOverride>,
): ExternalSpec[] {
  return kinds.flatMap((kind: string) => {
    const items = model?.main?.[KIT]?.[kind] || {}

    return Object.keys(items).sort()
      .map((name: string) => {
        // Overrides are keyed by installed target name.
        const ov = override[name] || {}

        // A SHALLOW CLONE, so the override never writes back into the model.
        // The in-tree pass still reads it, and `target add` still round-trips
        // it to disk; an override is for THIS RUN. Nothing compares these by
        // identity — withoutExternal keys by kind:name.
        const output = { ...(items[name]?.output || {}) }

        if (null != ov.path && '' !== ov.path) {
          output.path = ov.path
        }
        if (null != ov.sdkrel && '' !== ov.sdkrel) {
          output.sdkrel = ov.sdkrel
        }

        return { kind, name, target: { ...items[name], output }, ov }
      })
      // AFTER the override, so it can send an item out of tree that the
      // model generates in tree. The machinery needs nothing else for that:
      // withoutExternal takes it out of the in-tree pass by kind:name, and
      // every destination guard below runs on it either way.
      .filter((t: any) => {
        const path = t.target.output.path
        return null != path && '' !== path
      })
      .map((t: any) => ({
        kind: t.kind,
        name: t.name,
        target: t.target,
        folder: Path.resolve(folder, String(t.target.output.path)),
        enclosing: true === t.ov.enclosing,
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

    // A DESTINATION THAT CONTAINS THE PROJECT is what `..` produces, and it
    // is refused — UNLESS the caller said at generate time that it meant it.
    //
    // The legitimate case is a repository that carries a tagged checkout of
    // its SDK in a subfolder and regenerates itself from it: the SDK then
    // sits INSIDE its own output folder, and `output: path` resolves to an
    // ancestor. Generation writes the files its components declare and
    // prunes nothing, so the checkout survives its own run.
    //
    // `enclosing` is a separate flag from `path` on purpose, and only the
    // override can set it — never the model. Overriding a path is one
    // decision; writing over the directory holding the project is a second,
    // much worse thing to get wrong, and it fails silently: a typo'd `..`
    // fabricates a package tree over an unrelated repo, overwriting its
    // package.json, README, LICENSE and CI in place. Saying it twice is the
    // cost of keeping the typo caught for everyone who did not ask.
    if (folderContains(ext.folder, root) && !ext.enclosing) {
      throw new SdkGenError(
        'External output path contains the SDK project.\n  ' + where +
        '\n  Generation would write this package over the directory holding ' +
        'the SDK project itself.' +
        '\n  If that is deliberate — the SDK is checked out INSIDE its own ' +
        'output folder, and regenerates it — say so at generate time with ' +
        '`enclosing: true` in the ' + ext.name + ' entry of SDKGEN_EXTERNAL ' +
        'or the `external` build option. It cannot be set in the model.')
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

    // AN ENCLOSING DESTINATION ALWAYS HOLDS CONTENT: the SDK project itself
    // is inside it, along with whatever else the repository carries. The
    // emptiness check can therefore only ever say "yes, it has content", so
    // it carries no information here — and requiring `output: adopt` on top
    // of the opt-in would put the layout back in the SDK's COMMITTED model,
    // which is the coupling the generate-time override exists to break. An
    // SDK cloned into a repository it regenerates cannot have anticipated
    // being cloned there.
    //
    // The containment check above is what guards this case, and it is
    // stricter: it refuses unless the caller named this item and said
    // `enclosing` for it.
    if (ext.enclosing) continue

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

  // NOT WHEN THE OUTPUT ENCLOSES THE PROJECT. There the walk back descends
  // rather than ascends — `.sdksrc/acme-sdk` names the subfolder holding the
  // checkout and then the checkout, both INSIDE the output folder and both
  // chosen by whoever asked for this layout. Nothing is above anything, so
  // the warning's complaint (directories the model does not declare) is
  // false, and its advice (declare `output: sdkrel`) would put one layout's
  // path into the other's committed model.
  if (ext.enclosing) {
    return derived
  }

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
  PathSegment,
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
// `typeof` rather than a hand-written signature: jostraca 0.38 made cmp
// generic, `<P, Arg, Child>(component: (props: CmpProps<P>, ...) => any) =>
// Component<P, Arg, Child>`, and the old annotation `(component: Function) =>
// Component` no longer matched it. Deferring to the module's own type keeps
// this correct across jostraca versions AND still names the type, which is
// what prevented TS2742 in the first place.
export const cmp: typeof JostracaModule.cmp = JostracaModule.cmp
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
  PublishWorkflow,
  Changelog,
  Entity,
  Feature,
  Test,
  TestControl,
  TEST_CONTROL_EXCLUDE,
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
  resolveAuthIn,
  resolveAuthName,
  isAuthSuppressed,
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

  // apidef ADR-003: the model carries typed path segments, not braced
  // strings. Scaffold components read the path through these.
  pointSegments,
  pointParts,
  pointTerminalParam,
  pointPathKey,
  canonToType,
  canonToSpec,
  entityDataSpec,
  entityOpSpec,
  entitySpecs,
  optionSpec,
  featureOptionSpec,
  entitySpecMap,
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
  guardModelNames,
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
  serverVarEnv,
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
  pluginExcludes,
  pluginExcludesFor,
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
  luaKey,
  prefixLeadingDigit,

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
