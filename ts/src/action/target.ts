
import Path from 'node:path'

import {
  Project,
  Folder,
  Copy,
  File,
  Content,
  cmp,
  each,
  template,
} from 'jostraca'

import { showChanges } from '@voxgig/util'

import { showDryrun } from '../helpers/dryrun'

import { templateReplacements, provenanceReplace } from '../helpers/stdrep'

import { isJunk, copyOpts } from '../helpers/junk'

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
  BASE_FEATURE,
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

import { kindModel, kindIndex, resolveKind, escapeRe } from './kind'

import { BUNDLED, resolveSource, registerInstalled } from './resolve'


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
    control: {
      dryrun: !!actx.opts.dryrun
    },
    // Per-call for the same reason `control` is: this action runs on whatever
    // Jostraca instance the caller handed it, and a template tree must not
    // carry a maintainer's build droppings into a project. See helpers/junk.
    cmp: copyOpts(),
  }

  opts.log.info({
    point: 'target-start',
    note: (actx.opts.dryrun ? '** DRY RUN **' : '')
  })


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

  registerInstalled('target', targets, actx)

  // feature_add copies feature templates for every target in the model,
  // which now includes the ones just added.
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
  const { ctx$, targets, features, actx } = props
  const { model, log } = ctx$

  const fs = ctx$.fs()

  // The prune below writes through `fs` directly rather than through
  // jostraca, so it has to be told about the dry run itself.
  const dryrun = !!actx?.opts?.dryrun


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

      // Resolved through the shared kind spine, so a BARE name follows what
      // the model records exactly as a feature's does. Without that, a target
      // installed from an external package resolved back to the bundled
      // scaffold on its next `target add` — the same write-only-provenance
      // trap features had.
      const source = resolveKind(tref, 'target', ctx$)
      const { name: tname, folder: tfolder, origname: torigname, base } = source
      tnames.push(tname)
      const targetNote = tname + (tname != tref ? ' ref:' + tref : '')

      log.info({
        point: 'target-name', name: tname, folder: tfolder,
        target: tref,
        tname,
        note: tname + (tname != torigname ? 'original' + torigname : '') + ' from:' + tfolder
      })

      const aliased = tname !== torigname

      // The definition file and the index entry: the same for every kind, so
      // they are emitted once, in action/kind.
      Folder({ name: 'model/target' }, () => kindModel({
        ctx$, kind: 'target', source, names: tnames,
        content: ctx$.meta.content.target_index,
      }))

      if (aliased) {
        aliasCmpTree(ctx$, tfolder + '/src/cmp/' + torigname,
          'src/cmp/' + tname, torigname, tname)
      }
      else {
        Folder({ name: 'src/cmp/' + tname }, () => {
          Copy({
            from: tfolder + '/src/cmp/' + torigname,
            // exclude: true
          })
        })
      }

      const trim = trimFeatures(ctx$, tfolder, torigname, tname, features)

      pruneStaleTemplates(
        ctx$, tfolder + '/tm/' + torigname, 'tm/' + tname, trim, dryrun)

      Folder({ name: 'tm/' + tname }, () => {
        Copy({
          from: tfolder + '/tm/' + torigname,
          exclude: trim,
          // Shared with doctor, which re-applies them before comparing.
          replace: templateReplacements(model, tname),
        })
      })

      log.info({
        point: 'target-done', target: tref, note: targetNote
      })

    })

    if (0 < tnames.length) {
      Folder({ name: 'model/target' }, () => kindIndex({
        kind: 'target', names: tnames,
        content: ctx$.meta.content.target_index,
      }))
    }
  })
})




function aliasCmpName(name: string, torigname: string, tname: string): string {
  return name.replace(
    new RegExp('_' + escapeRe(torigname) + '(\\.[^.]+)$'), '_' + tname + '$1')
}


function aliasCmpText(
  src: string, torigname: string, tname: string, cmpbase = 'src/cmp/',
): string {
  const orig = escapeRe(torigname)

  return src
    // The fragment directory, read relative to __dirname. The fragments are
    // copied into the ALIAS's folder, so leaving the origin path would miss —
    // or, if the origin target is also installed, silently read ITS fragments.
    .replace(new RegExp(escapeRe(cmpbase) + orig + '/', 'g'), cmpbase + tname + '/')
    // Sibling imports: `'./Package_go'` -> `'./Package_go2'`. Anchored on the
    // closing quote (captured, so the style is preserved) to keep it off file
    // EXTENSIONS — `Main.fragment.go` must not become `Main.fragment.go2`.
    .replace(new RegExp('_' + orig + '([\'"])', 'g'), '_' + tname + '$1')
}


function aliasCmpTree(
  ctx$: any,
  fromDir: string,
  toRel: string,
  torigname: string,
  tname: string,
  cmpbase = 'src/cmp/',
) {
  const fs = ctx$.fs()

  const aliasText = (src: string) =>
    aliasCmpText(src, torigname, tname, cmpbase)

  const emit = (dir: string, rel: string) => {
    let entries: any[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    }
    catch (e: any) {
      return
    }

    // Sorted, so an aliased tree is emitted in the same byte-stable order
    // everything else in this toolchain is. Junk is dropped here because this
    // walk stands in for a tree Copy, which drops it through
    // `cmp.Copy.ignore` — an aliased install must not be the one path that
    // ships a maintainer's `__pycache__`. See helpers/junk.
    const names = entries
      .map((ent: any) => ent.name)
      .filter((name: string) => !isJunk(name))
      .sort()

    for (const name of names) {
      const child = Path.join(dir, name)
      const ent = entries.find((e: any) => e.name === name)

      if (ent.isDirectory()) {
        Folder({ name }, () => emit(child, rel + '/' + name))
        continue
      }

      const renamed = aliasCmpName(name, torigname, tname)

      const src = fs.readFileSync(child, 'utf8')

      File({ name: renamed }, () => Content(template(aliasText(src), ctx$.model)))
    }
  }

  Folder({ name: toRel }, () => emit(fromDir, toRel))
}




function pruneStaleTemplates(
  ctx$: any,
  fromDir: string,
  toRel: string,
  trim: RegExp[],
  dryrun?: boolean,
) {
  const { log } = ctx$
  const fs = ctx$.fs()
  const folder = ctx$.folder ?? '.'
  const destDir = Path.join(folder, toRel)

  const listRel = (root: string): string[] => {
    const out: string[] = []
    const walk = (dir: string, rel: string) => {
      let entries: any[]
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      }
      catch (e: any) {
        return
      }
      for (const ent of entries) {
        if (isJunk(ent.name)) {
          continue
        }

        const child = Path.join(dir, ent.name)
        const childRel = '' === rel ? ent.name : rel + '/' + ent.name
        if (ent.isDirectory()) {
          walk(child, childRel)
        }
        else {
          out.push(childRel)
        }
      }
    }
    walk(root, '')
    return out
  }

  const sourceFiles = listRel(fromDir)

  // An unreadable source tree must not be read as "everything is stale" — that
  // would empty the destination.
  if (0 === sourceFiles.length) {
    return
  }

  // What SHOULD be present: source, minus anything the trim excludes. The trim
  // patterns are matched against the source-relative path, the same way Copy
  // applies them.
  const trimmed = (rel: string) => trim.some((re) => re.test(rel))
  const want = new Set(sourceFiles.filter((rel) => !trimmed(rel)))

  const stale = listRel(destDir).filter((rel) => !want.has(rel))
  if (0 === stale.length) {
    return
  }

  if (dryrun) {
    log.info({
      point: 'target-template-prune', target: toRel, count: stale.length,
      files: stale, dryrun: true,
      note: toRel + ': would remove ' + stale.length +
        ' stale template(s) — ** DRY RUN **, nothing was written'
    })
    for (const rel of stale) {
      log.info({
        point: 'target-template-prune-file', target: toRel,
        file: toRel + '/' + rel, dryrun: true,
        note: 'would remove ' + toRel + '/' + rel
      })
    }
    return
  }

  const removed: string[] = []
  for (const rel of stale) {
    try {
      fs.unlinkSync(Path.join(destDir, rel))
      removed.push(rel)
    }
    catch (e: any) {
      log.warn({
        point: 'target-template-prune', target: toRel, file: rel,
        note: 'could not remove stale template ' + rel + ': ' + e.message
      })
    }
  }

  if (0 < removed.length) {
    log.info({
      point: 'target-template-prune', target: toRel, count: removed.length,
      files: removed,
      note: toRel + ': removed ' + removed.length +
        ' stale template(s) the toolchain no longer provides for this SDK'
    })
  }
}


function featureCatalogue(ctx$: any, tfolder: string): string[] {
  const fs = ctx$.fs()
  const root = ctx$.folder ?? '.'

  const names = new Set<string>([
    ...availableFeatures(fs, Path.join(root, BUNDLED)),
    ...availableFeatures(fs, tfolder),
    ...availableFeatures(fs, root),
  ])

  return Array.from(names).sort()
}


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
  const selected = new Set([BASE_FEATURE, ...(features ?? [])])

  const available = featureCatalogue(ctx$, tfolder)
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


function readTargetFeature(
  ctx$: any,
  tfolder: string,
  torigname: string,
  tname: string,
): { trim: boolean, fullset: string[] } {
  const { log } = ctx$
  const fs = ctx$.fs()

  const path = tfolder + '/model/target/' + torigname + '.aon'

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


// `target add`'s view of the shared resolver: the same resolution every kind
// uses, with this action's historical field names. Kept as a wrapper so its
// callers (TargetRoot, doctor) and their tests do not have to move with the
// extraction.
function resolveTarget(tref: string, ctx$: any) {
  const src = resolveSource(tref, 'target', ctx$)

  return {
    tname: src.name,
    tfolder: src.folder,
    torigname: src.origname,
    base: src.base,
    package: src.package,
  }
}


export {
  action_target,
  featureCatalogue,
  target_add,
  resolveTarget,
  trimFeatures,
  readTargetFeature,
  aliasCmpText,
  aliasCmpName,
  aliasCmpTree,
  pruneStaleTemplates,
}
