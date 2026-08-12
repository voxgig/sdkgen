
import Path from 'node:path'

import {
  Project,
  Folder,
  Copy,
  File,
  cmp,
  each,
} from 'jostraca'

import { showChanges } from '@voxgig/util'

import { showDryrun } from '../helpers/dryrun'

import { getelem } from '@voxgig/struct'

import { Aontu } from 'aontu'

import {
  KIT
} from '../types'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import {
  availableFeatures,
  findFeatureSources,
  featureExcludes,
  fullsetExcludes,
} from '../helpers/featureSource'

import {
  feature_add
} from './feature'

import {
  UpdateIndex,
  parseAddNames,
  loadContent,
} from './action'


const CMD_MAP: any = {
  add: cmd_target_add
}



async function action_target(args: string[], actx: ActionContext): Promise<ActionResult> {
  const cmdname = args[1]

  const cmd = CMD_MAP[cmdname]

  if (null == cmd) {
    throw new SdkGenError('Unknown target cmd: ' + cmdname)
  }

  return await cmd(args, actx)
}


async function cmd_target_add(args: string[], actx: ActionContext): Promise<ActionResult> {
  return target_add(parseAddNames(args), actx)
}


// Code API
async function target_add(targets: string[], actx: ActionContext): Promise<ActionResult> {
  // const jostraca = Jostraca()
  const jostraca = actx.jostraca

  const opts = {
    fs: actx.fs,
    folder: actx.folder,
    log: actx.log.child({ cmp: 'jostraca' }),
    meta: {
      // model: actx.model,
      // tree: actx.tree,
      url: actx.url,
      content: loadContent(actx, 'target')
    },
    model: actx.model,
    // Dry run must be passed per-call, not left to the Jostraca instance.
    // jostraca's `generate` runs its own options through OptionsShape FIRST,
    // which fills in `control.dryrun: false`, and only then merges
    // `deep({}, gOpts.control, opts.control)` — so the shape default silently
    // OVERRIDES the instance-level flag. `-y target add ts` printed
    // ** DRY RUN ** and wrote every file. (Same trap as the `existing` FIX
    // note in jostraca.js.)
    control: {
      dryrun: !!actx.opts.dryrun
    },
  }

  opts.log.info({
    point: 'target-start',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })


  // The `test` feature is required by every generated target (SDK.test()
  // depends on it), so ensure it is added even if the model does not yet
  // declare it.
  //
  // Everything else has to be BOTH declared and active: `active` defaults to
  // false in the schema, and a feature the model has switched off should not
  // have its source land in the project. This used to be a plain
  // Object.keys(), so `retry: { active: false }` still shipped every retry
  // source file.
  const featuremodel: any = actx.model.main[KIT]?.feature ?? {}
  const features = Array.from(new Set([
    'test',
    ...Object.keys(featuremodel).filter((n: string) => false !== featuremodel[n]?.active),
  ]))

  const jres = await jostraca.generate(opts, () =>
    TargetRoot({ targets, features, actx }))

  showChanges(opts.log, 'target-result', jres)

  if (actx.opts.dryrun) {
    showDryrun(opts.log, 'target-result', jres, actx.folder)
  }

  // feature_add copies feature templates for targets already registered in
  // the model. The targets added above are not in the in-memory model yet,
  // so TargetRoot copies their feature templates itself.
  await feature_add(features, actx)

  opts.log.info({
    point: 'target-end',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })

  return {
    jres
  }
}


const TargetRoot = cmp(function TargetRoot(props: any) {
  const { ctx$, targets, features } = props
  const { model, log } = ctx$

  // TODO: jostraca - make from value easier to specify 
  // const tfolder = 'node_modules/@voxgig/sdkgen/project/.sdk'

  Project({}, () => {
    // Resolved names of every target in this run. The index File is
    // re-rendered per target and the last render wins, so each render must
    // carry all names seen so far, not just its own.
    const tnames: string[] = []

    each(targets, (n) => {
      const tref = n.val$

      log.info({
        point: 'target-build',
        target: tref,
        note: tref
      })

      const { tname, tfolder, torigname, base } = resolveTarget(tref, ctx$)
      tnames.push(tname)
      const targetNote = tname + (tname != tref ? ' ref:' + tref : '')

      log.info({
        point: 'target-name', name: tname, folder: tfolder,
        target: tref,
        tname,
        note: tname + (tname != torigname ? 'original' + torigname : '') + ' from:' + tfolder
      })

      Folder({ name: 'model/target' }, () => {
        Copy({
          from: tfolder + '/model/target/' + torigname + '.aontu',
          // exclude: true
          replace: {
            "'BASE'": "'" + base + "'"
          }
        })
        File({ name: 'target-index.aontu' }, () => UpdateIndex({
          content: ctx$.meta.content.target_index,
          names: tnames,
        }))
      })

      Folder({ name: 'src/cmp/' + tname }, () => {
        Copy({
          from: tfolder + '/src/cmp/' + torigname,
          // exclude: true
        })
      })

      // Copy the whole template tree MINUS the source of every feature the
      // model did not ask for. Which files those are is discovered from the
      // tree rather than assumed (see helpers/featureSource), because each
      // language puts feature source somewhere different.
      const trim = trimFeatures(ctx$, tfolder, torigname, tname, features)

      Folder({ name: 'tm/' + tname }, () => {
        Copy({
          from: tfolder + '/tm/' + torigname,
          exclude: trim,
          replace: {

            // TODO: standard replacements
            ProjectName: model.const.Name,
          }
        })
      })

      log.info({
        point: 'target-done', target: tref, note: targetNote
      })

    })
  })
})


// Path patterns that keep a target's unwanted feature source out of the
// project: the source of every AVAILABLE feature the model did not select,
// plus the templates that only compile with the complete feature set.
//
// Returns an empty list — copy the whole tree, as before — when the target
// opts out with `feature: { trim: false }`, or when its model cannot be
// read. Trimming a target whose templates are not ready for it produces a
// project that does not build, so an unreadable declaration must fail safe
// rather than fail tidy.
function trimFeatures(
  ctx$: any,
  tfolder: string,
  torigname: string,
  tname: string,
  features: string[],
): RegExp[] {
  const { log } = ctx$
  const fs = ctx$.fs()

  const cfg = readTargetFeature(ctx$, tfolder, torigname, tname)

  if (false === cfg.trim) {
    log.info({
      point: 'target-feature-trim', target: tname, trim: false,
      note: tname + ': feature trim disabled, copying all feature source'
    })
    return []
  }

  // `base` is not a declared feature — it is the always-present foundation
  // every other feature builds on — so it is never a trim candidate.
  const selected = new Set(['base', ...(features ?? [])])

  const available = availableFeatures(fs, tfolder)
  const drop = findFeatureSources(fs, tfolder + '/tm/' + torigname, available)
    .filter((s) => !selected.has(s.name))

  const trimmed = 0 < drop.length

  log.info({
    point: 'target-feature-trim', target: tname, trim: true,
    drop: drop.map((s) => s.name),
    note: tname + ': ' + (trimmed ?
      ('dropping ' + drop.length + ' unselected feature source entries') :
      'all available features selected')
  })

  return [
    ...featureExcludes(drop),
    // The cross-feature test suite is only excluded when something WAS
    // trimmed; a project carrying the full set keeps its feature tests.
    ...(trimmed ? fullsetExcludes(cfg.fullset) : []),
  ]
}


// Load a target's `feature` declaration from its own model file.
//
// The target being added is not in the in-memory model yet (that is what
// `target add` is for), so this reads the very file that is about to be
// copied into `model/target/`. Each shipped target model is self-contained,
// so Aontu can resolve it on its own.
function readTargetFeature(
  ctx$: any,
  tfolder: string,
  torigname: string,
  tname: string,
): { trim: boolean, fullset: string[] } {
  const { log } = ctx$
  const fs = ctx$.fs()

  const path = tfolder + '/model/target/' + torigname + '.aontu'

  try {
    const errs: any[] = []
    const model = new Aontu().generate(fs.readFileSync(path, 'utf8'), { path, errs })

    if (0 < errs.length) {
      throw new Error(errs.map((e: any) => e.msg || String(e)).join('\n'))
    }

    const feature = model?.main?.[KIT]?.target?.[torigname]?.feature ?? {}

    return {
      trim: false !== feature.trim,
      fullset: Array.isArray(feature.fullset) ? feature.fullset : [],
    }
  }
  catch (err: any) {
    log.warn({
      point: 'target-feature-model', target: tname, path,
      err: err.message,
      note: tname + ': cannot read target model (' + err.message +
        '); copying all feature source'
    })
    return { trim: false, fullset: [] }
  }
}


function resolveTarget(tref: string, ctx$: any) {
  let tname = tref
  let torigname = tref
  let tfolder = 'node_modules/@voxgig/sdkgen/project/.sdk'

  const root = ctx$.folder
  const fs = ctx$.fs()

  let fulltfolder = Path.normalize(Path.join(root, tfolder))
  tname = getelem(tref.split('/'), -1)

  let aliasref = tref
  torigname = getelem(aliasref.split('/'), -1)
  const aliasing = tref.split('~')
  if (1 < aliasing.length) {
    aliasref = aliasing[0]
    tname = aliasing.slice(1).join('~')
    torigname = getelem(aliasref.split('/'), -1)
  }

  const search: string[] = []
  let found = false
  if (aliasref.includes('/')) {
    // NOTE: the last path element of the ref is the target name, not a folder.
    const aliasbase = Path.dirname(aliasref)

    if (!aliasref.startsWith('/')) {
      fulltfolder = Path.normalize(Path.join(root, 'node_modules', aliasbase, '.sdk'))
      search.push(fulltfolder)
      found = fs.existsSync(fulltfolder)

      if (!found) {
        fulltfolder = Path.normalize(Path.join(root, aliasbase, '.sdk'))
        search.push(fulltfolder)
        found = fs.existsSync(fulltfolder)
      }
    }
    else {
      fulltfolder = Path.normalize(Path.join(aliasbase, '.sdk'))
      search.push(fulltfolder)
      found = fs.existsSync(fulltfolder)
    }
  }
  else {
    search.push(fulltfolder)
    found = fs.existsSync(fulltfolder)
  }

  if (!found) {
    throw new Error('Target folder not found in:\n' + search.join('\n  '))
  }

  const rootslash = root.endsWith('/') ? root : root + '/'
  const out = {
    tname,
    tfolder: fulltfolder,
    torigname,
    base: fulltfolder.replace(rootslash, '')
  }

  return out
}


export {
  action_target,
  target_add,
  resolveTarget,
  trimFeatures,
  readTargetFeature,
}
