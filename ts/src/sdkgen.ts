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

import { KIT, resolvedSpec } from '@voxgig/apidef'
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

import { resolvedFor, liveHint, pointFacts, hasLiveScenarios } from './helpers/resolved'
import type { RegisterOptions } from './cmp/Registered'

import { buildIdNames, entityRelationName, flowSteps } from './helpers/buildIdNames'
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
  assertMigrated,
  definitionPath,
  definitionFolder,
  definitionNames,
  indexPath,
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
  sdkName,
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
import { KINDS } from './action/kind'



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

  existing?: {
    txt?: any
    bin?: any
  }

  dryrun?: boolean

  external?: Record<string, ExternalOverride>
}


type ExternalOverride = {
  path?: string
  sdkrel?: string
  enclosing?: boolean
}


const { Jostraca } = JostracaModule


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

  let aontu: any = null

  const jopts = {
    now,
    control: {
      dryrun: opts.dryrun
    },
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
      // apidef publishes the resolved definition on the model build's
      // context; jostraca merges `meta` into every component's ctx$, and
      // docgen is handed these same options.
      meta: { spec, apidef: resolvedSpec(spec.buildctx) },
      debug: opts.debug,
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

    const root = Path.resolve(folder)

    const externalOverride = resolveExternalOverride(opts, log)
    // Snapshot the decision before preflight. In particular, do not check a
    // missing optional destination once for safety and AGAIN before writing:
    // if it appeared between those checks, the pass could write into content
    // that was never ownership-validated.
    const external: ExternalPlan[] =
      externalItems(model, root, ['target'], externalOverride)
        .map((ext) => ({ ...ext, skip: externalSkipReason(ext, fs) }))

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
    const path = './model/sdk.aontu'
    const errs: any[] = []

    // A verb that does not act on a project (see `needsModel`) is run where
    // there is no project model, so its absence is not an error there. Its
    // PRESENCE still is compiled — an author checking a package from inside a
    // project should get the same model every other verb gets.
    if (!wanted && !fs.existsSync(path)) {
      return { model: { main: {} } as any, url: path }
    }

    assertMigrated(fs, [
      path, ...Object.keys(KINDS).map((kind: string) => indexPath('.', kind))])

    if (null == aontu) {
      aontu = new Aontu()
    }

    const aopts = { path, errs }
    const src = fs.readFileSync(path, 'utf8')

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

  const config = {
    root: opts.root,
    def: opts.def || 'no-def',
    kind: 'openapi-3',
    model: opts.model ? (opts.model.folder + '/api.aontu') : 'no-model',
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

    return await sdkgen.generate({ model, build, config, buildctx: ctx })
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
          // The override relocates this run's output, root placement included.
          delete output.root
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



function checkExternalFolders(external: ExternalPlan[], root: string, fs: any) {
  const claimed: Record<string, string> = {}

  for (const ext of external) {
    if (!ext.active) continue

    const label = ext.kind.charAt(0).toUpperCase() + ext.kind.slice(1)

    const where = label + ' "' + ext.name + '" has output path "' +
      ext.target.output.path + '", which resolves to: ' + ext.folder +
      '\n  (SDK project: ' + root + ')'

    if (true === ext.target.output.root) {
      throw new SdkGenError(
        label + ' "' + ext.name + '" declares both `output: path` and ' +
        '`output: root: true`.\n  ' + where +
        '\n  `path` generates it into another repository and `root` at the ' +
        'root of this one. Keep one.')
    }

    if (ext.folder === root || folderContains(root, ext.folder)) {
      throw new SdkGenError(
        'External output path is inside the SDK project.\n  ' + where +
        '\n  An item generating into the SDK project must leave `output: ' +
        'path` unset — it is then generated in-tree, as <sdk-project>/' +
        ext.name + '/.')
    }

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


function externalSdkRel(ext: ExternalSpec, root: string, log: any): string {
  const declared = String(ext.target.output?.sdkrel || '')
  if ('' !== declared) return declared

  const derived = Path.relative(ext.folder, root).split(Path.sep).join('/')

  // Every segment that is not '..' is a real directory name on the way back
  // down to the SDK project. The LAST is the project's own folder; any
  // earlier one is a directory ABOVE it, which nothing in the model declares.
  const named = derived.split('/').filter((seg) => '..' !== seg)

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
  resolvedFor,
  liveHint,
  pointFacts,
  hasLiveScenarios,

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
  entityRelationName,
  flowSteps,
  getMatchEntries,
  collectDeps,

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
  sdkName,
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
