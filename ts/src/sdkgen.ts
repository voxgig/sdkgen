/* Copyright (c) 2024-2025 Richard Rodger, MIT License */

import Fs from 'node:fs'
import Path from 'node:path'

import { prettyPino, Pino } from '@voxgig/util'

import * as JostracaModule from 'jostraca'
import { Aontu } from 'aontu'

import {
  showChanges,
  getdlog,
} from '@voxgig/util'

import type {
  ActionContext,
  ActionResult,
} from './types'

import { SdkGenError, requirePath, isAuthActive, resolveAuthPrefix,
  CONFIG_DATA_THRESHOLD, CONFIG_REPR_VALUES, isConfigData, configRepr,
  configReprSetting, configDefinition, clean, rawStringLiteral } from './utility'

import { Main } from './cmp/Main'
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
import { FeatureHook } from './cmp/FeatureHook'
import { registerComponent } from './cmp/Registered'
import type { RegisterOptions } from './cmp/Registered'

import { buildIdNames } from './helpers/buildIdNames'
import { getMatchEntries } from './helpers/getMatchEntries'
import { collectDeps } from './helpers/collectDeps'
import type { DepEntry } from './helpers/collectDeps'
import { canonToType, canonToDtype, canonKey } from './helpers/canonType'
import { OP_SUFFIX, opTypeName, opParams, opActions, entityActions, entityPath, opRequestShape, entityIdField, entityDataIdField, entityOps, entityPrimaryOp, pickExampleEntity, entityClassName, entityTypeCollisions, warnEntityTypeCollisions, deriveEntityNames, entityCollection } from './helpers/opShape'
import { isReservedName, safeVarName, exampleVarName, phpEntityAccessor, entityCacheField, isRbCoreConstant, rbSafeTypeName, isSwiftSdkType, swiftSafeTypeName, jsProp, jsOptProp, jsKey } from './helpers/naming'
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
import {
  definitionPath,
  definitionFolder,
  definitionNames,
} from './helpers/definition'
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


const dlog = getdlog('sdkgen', __filename)


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
    }
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
    const external = externalTargets(model, root)

    // Before ANY file is written, in-tree included: a destination that turns
    // out to be wrong must abort the whole generation, not leave half of it
    // done. See checkExternalFolders.
    checkExternalFolders(external, root, fs)

    const jres = await jostraca.generate(
      jopts, () => Root({ model: 0 === external.length ? model : withoutTargets(model, external) }))

    showChanges(jopts.log, 'generate-result', jres, Path.dirname(process.cwd()))

    for (const ext of external) {
      // `active: false` is the project's only lever to stop the generator
      // writing into a repo it does not own, so it has to be honoured HERE —
      // the consumer Root iterates targets raw and does not check it. The
      // target is still removed from the in-tree model above (withoutTargets
      // takes every `output: path` target, active or not), so switching one
      // off generates it nowhere rather than relocating it into
      // `<sdk-repo>/<target>/`.
      if (!ext.active) {
        log.info({
          point: 'generate-external-skip', target: ext.name, folder: ext.folder,
          note: ext.name + ' inactive, not generated'
        })
        continue
      }

      log.info({
        point: 'generate-external', target: ext.name, folder: ext.folder,
        note: ext.name + ' -> ' + ext.folder
      })

      const eres = await jostraca.generate(
        { ...jopts, folder: ext.folder },
        () => ExternalTarget({
          model, target: ext.target, cmpfolder: folder,
          // How to walk BACK to the SDK project from the destination. A
          // target generating out of tree usually sits beside the SDK in a
          // known layout, and its own docs, scripts and live tests need to
          // name that path.
          sdkrelpath: externalSdkRel(ext, root, log),
        }))

      showChanges(jopts.log, 'generate-result', eres, Path.dirname(process.cwd()))
    }

    const dlogs = dlog.log()
    if (0 < dlogs.length) {
      for (let dlogentry of dlogs) {
        log.debug({ point: 'generate-warning', dlogentry, note: String(dlogentry) })
      }
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
    const path = './model/sdk.aontu'
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

    const model = aontu.generate(src, aopts)

    if (0 < errs.length) {
      const serr = errs[0]
      const err: any = new SdkGenError('Model Error: ' + serr.msg)
      err.cause$ = [serr]

      if ('syntax' === serr.why) {
        err.uxmsg$ = true
      }

      err.rooterrs$ = errs
      throw err
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

    // await apidef.generate({ model, build, config })
    return await sdkgen.generate({ model, build, config })
  }
}



type ExternalSpec = {
  name: string
  target: any
  folder: string
  active: boolean
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
// model (see withoutTargets) so that switching it off does not silently
// relocate it into `<sdk-repo>/<target>/`. The generate loop skips it.
function externalTargets(model: any, folder: string): ExternalSpec[] {
  const targets = model?.main?.[KIT]?.target || {}

  return Object.keys(targets).sort()
    .map((name: string) => ({ name, target: targets[name] }))
    .filter((t: any) => {
      const path = t.target?.output?.path
      return null != path && '' !== path
    })
    .map((t: any) => ({
      ...t,
      folder: Path.resolve(folder, String(t.target.output.path)),
      active: false !== t.target.active,
    }))
}


// The `.jostraca` bookkeeping tree (meta log + a duplicate of the last
// generated output) that jostraca leaves at an output root. It is the only
// on-disk evidence that this toolchain has generated into a directory
// before, so it doubles as the OWNERSHIP MARKER: a destination carrying one
// has been generated into already, whoever set it up.
const EXTERNAL_MARKER = '.jostraca'

// Entries that do not count as content when deciding whether a destination
// is empty. A `git init` (or a clone of an empty repo) leaves only `.git`,
// and that is exactly the destination a FIRST generation is aimed at.
const EXTERNAL_EMPTY = ['.git', '.DS_Store']


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
function checkExternalFolders(external: ExternalSpec[], root: string, fs: any) {
  const claimed: Record<string, string> = {}

  for (const ext of external) {
    // An inactive target writes nothing, so its destination is not a hazard —
    // and switching a target off must not require keeping its now-unused
    // path valid.
    if (!ext.active) continue

    const where = 'Target "' + ext.name + '" has output path "' +
      ext.target.output.path + '", which resolves to: ' + ext.folder +
      '\n  (SDK project: ' + root + ')'

    if (ext.folder === root || folderContains(root, ext.folder)) {
      throw new SdkGenError(
        'External target output path is inside the SDK project.\n  ' + where +
        '\n  A target generating into the SDK project must leave `output: ' +
        'path` unset — it is then generated in-tree, as <sdk-project>/' +
        ext.name + '/.')
    }

    if (folderContains(ext.folder, root)) {
      throw new SdkGenError(
        'External target output path contains the SDK project.\n  ' + where +
        '\n  Generation would write this package over the directory holding ' +
        'the SDK project itself.')
    }

    if (null != claimed[ext.folder]) {
      throw new SdkGenError(
        'External target output path is already claimed by target "' +
        claimed[ext.folder] + '".\n  ' + where +
        '\n  Two targets generating into the same folder overwrite each ' +
        'other, in target-name order.')
    }
    claimed[ext.folder] = ext.name

    if (!fs.existsSync(ext.folder)) continue

    if (!fs.statSync(ext.folder).isDirectory()) {
      throw new SdkGenError(
        'External target output path is not a folder.\n  ' + where)
    }

    if (true === ext.target.output.adopt) continue

    const entries: string[] = fs.readdirSync(ext.folder)
      .map((entry: any) => String(entry))

    if (entries.includes(EXTERNAL_MARKER)) continue

    const content = entries.filter((entry) => !EXTERNAL_EMPTY.includes(entry))

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
function withoutTargets(model: any, external: { name: string }[]): any {
  const drop = new Set(external.map((e) => e.name))
  const targets = model?.main?.[KIT]?.target || {}

  const kept: any = {}
  for (const name of Object.keys(targets)) {
    if (!drop.has(name)) {
      kept[name] = targets[name]
    }
  }

  return {
    ...model,
    main: {
      ...model.main,
      [KIT]: { ...model.main[KIT], target: kept },
    },
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
  FeatureHook,
  registerComponent,

  Jostraca,
  SdkGen,

  requirePath,
  isAuthActive,
  resolveAuthPrefix,
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

  OP_SUFFIX,
  opTypeName,
  opParams,
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
  rbSafeTypeName,
  isSwiftSdkType,
  swiftSafeTypeName,
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
  PUBLISHER,
  PUBLISHER_URL,
  SECURITY_EMAIL,
  GENERATOR_URL,
}
