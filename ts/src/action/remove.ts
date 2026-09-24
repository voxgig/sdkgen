import { kindCollection } from '../helpers/kindCollection'

import Path from 'node:path'

import { KIT } from '../types'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import {
  assertMigrated, definitionPathAny, indexName, indexPath,
} from '../helpers/definition'

import { findFeatureSources, BASE_FEATURE } from '../helpers/featureSource'

import { ITEM_NAME_RE } from '../helpers/manifest'

import { isJunk } from '../helpers/junk'

import { kindDef, kindTrees } from './kind'

import { resolveSource, recordedRef } from './resolve'

import { removeIndexEntries } from './action'

import { doctor } from './doctor'


// Everything one `remove` would touch, decided before anything is written.
type RemovePlan = {
  kind: string
  name: string

  // Project-relative paths, files only.
  files: string[]

  // Trees to drop once their files are gone.
  dirs: string[]

  // Whether the index lists the item.
  indexed: boolean

  // The generated output directory beside `.sdk`, when the caller asked
  // for it and it exists.
  output?: string

  // Files `add` did not write as they stand: forked, edited, stale or
  // project-owned. The removal refuses on any of these unless forced.
  refused: string[]

  // The subset of `refused` that is an ALIASED item's own model file. Same
  // refusal, different advice — see the message in kindRemove.
  aliased: string[]

  // Things the caller must finish by hand.
  notes: string[]
}


async function kind_remove(
  kind: string, names: string[], actx: ActionContext,
): Promise<ActionResult> {
  const log = actx.log
  const dryrun = !!actx.opts?.dryrun
  const force = true === actx.flags?.force
  const deleteOutput = true === actx.flags?.deleteOutput

  kindDef(kind)

  if (0 === names.length) {
    throw new SdkGenError(kind + ' remove: nothing named' +
      '\n  usage: voxgig-sdkgen ' + kind + ' remove <name>[,<name>...]')
  }

  log.info({
    point: 'remove-start', kind, names,
    note: (dryrun ? '** DRY RUN ** ' : '') + kind + ' remove ' + names.join(',')
  })

  const plans: RemovePlan[] = []
  for (const name of names) {
    plans.push(await planRemove(kind, name, actx, deleteOutput))
  }

  const refused = plans.filter((p) => 0 < p.refused.length)

  if (0 < refused.length && !force) {
    // Differentiating an alias's model file is what an alias is for, so the
    // standard advice names the place that file already is.
    const aliased = refused.flatMap((p) => p.aliased)

    throw new SdkGenError(
      kind + ' remove: refusing to delete what `' + kind + ' add` did not write' +
      refused.map((p) => '\n  ' + p.name + ':' +
        p.refused.map((r) => '\n    ' + r).join('')).join('') +
      (0 < aliased.length ?
        ('\n  ' + aliased.join(', ') + ' is an ALIAS\'s own model file: the' +
          ' scaffold has none to compare it with, so differentiating it is' +
          ' expected and there is nowhere else to move it. Pass --force to' +
          ' delete it with the alias.') : '') +
      '\n  move any project decision into .sdk/model/, then run again;' +
      ' or pass --force to delete these too')
  }

  const removed: string[] = []

  for (const plan of plans) {
    for (const r of plan.refused) {
      log.warn({
        point: 'remove-forced', kind, [kind]: plan.name, file: r,
        note: plan.name + ': --force, deleting ' + r
      })
    }

    for (const note of plan.notes) {
      log.warn({ point: 'remove-note', kind, [kind]: plan.name, note })
    }

    removed.push(...applyRemove(plan, actx, dryrun))
  }

  log.info({
    point: 'remove-end', kind, names, count: removed.length,
    note: dryrun ?
      ('** DRY RUN ** ' + removed.length + ' path(s) would be removed; nothing was written') :
      ('removed ' + removed.length + ' path(s)')
  })

  return {
    report: {
      ok: true,
      kind,
      names,
      removed,
      refused: plans.flatMap((p) => p.refused),
      notes: plans.flatMap((p) => p.notes),
      dryrun,
    }
  }
}


async function planRemove(
  kind: string, name: string, actx: ActionContext, deleteOutput: boolean,
): Promise<RemovePlan> {
  const fs = actx.fs()
  const root = actx.folder
  const model: any = actx.model

  // A name, never a path: Path.join NORMALISES a traversal rather than
  // refusing it, so `go/../go` is indistinguishable from `go` once joined.
  // Same grammar as the add side, checked before any path is derived.
  if (!ITEM_NAME_RE.test(name)) {
    throw new SdkGenError(
      'Invalid ' + kind + ' name: ' + JSON.stringify(name) +
      '\n  a name matches ' + ITEM_NAME_RE.source + ' — it is not a path')
  }

  assertMigrated(fs, [indexPath(root, kind)])

  const declared: any = kindCollection(model, kind)?.[name]
  const modelfile = definitionPathAny(fs, root, kind, name)
  const hasModel = fs.existsSync(modelfile)

  if (null == declared && !hasModel) {
    throw new SdkGenError(
      kind + ' not installed: ' + name +
      '\n  nothing at ' + rel(root, modelfile) + ', and the model does not declare it')
  }

  if ('feature' === kind && ('test' === name || BASE_FEATURE === name)) {
    throw new SdkGenError(
      'feature remove: `' + name + '` cannot be removed' +
      '\n  every target\'s generated test suite depends on it, and `target add`' +
      ' installs it unconditionally')
  }

  const plan: RemovePlan = {
    kind, name, files: [], dirs: [], indexed: false,
    refused: [], aliased: [], notes: [],
  }

  // Feature overlays belong to both the feature and the target's tree.
  const inScope = (k: string, n: string) =>
    (k === kind && n === name) ||
    ('feature' === kind && 'target' === k) ||
    ('target' === kind && 'feature' === k)

  const source = resolveDeclared(kind, name, declared, actx)

  if (null == source) {
    plan.refused.push('(source not found: the copy cannot be compared with what' +
      ' `' + kind + ' add` wrote; every file below is deleted only under --force)')
  }

  // The feature being removed counts as selected, so its own source is
  // compared rather than written off as stale — see checkTarget.
  const findings = null == source ? { all: [], aliased: new Set<string>() } :
    await driftFindings(actx, inScope, 'feature' === kind ? [name] : undefined)

  if ('feature' === kind) {
    planFeature(plan, actx)
  }
  else {
    for (const tree of kindTrees(kind, name)) {
      const dir = Path.join(root, ...tree.path.split('/'))
      if (!fs.existsSync(dir)) {
        continue
      }
      plan.dirs.push(tree.path)
      plan.files.push(...walk(fs, dir).map((r) => tree.path + '/' + r))
    }
  }

  if (hasModel) {
    plan.files.push('model/' + kind + '/' + Path.basename(modelfile))
  }

  const wanted = new Set(plan.files)
  for (const f of findings.all) {
    if (wanted.has(f)) {
      plan.refused.push(f)
      if (findings.aliased.has(f)) {
        plan.aliased.push(f)
      }
    }
  }

  const index = indexPath(root, kind)
  plan.indexed = fs.existsSync(index) &&
    removeIndexEntries(String(fs.readFileSync(index, 'utf8')), [name]) !==
    String(fs.readFileSync(index, 'utf8'))

  if ('target' === kind) {
    planOutput(plan, actx, declared, deleteOutput)
  }

  plan.notes.push(...projectMentions(kind, name, actx))

  if ('feature' === kind && 0 < plan.files.length) {
    plan.notes.push(name + ': a target\'s cross-feature test suite may still' +
      ' name this feature; `target add <t>` re-applies the trim for each target')
  }

  return plan
}


function planFeature(plan: RemovePlan, actx: ActionContext) {
  const fs = actx.fs()
  const root = actx.folder
  const targets: any = (actx.model as any)?.main?.[KIT]?.target ?? {}

  for (const tname of Object.keys(targets).sort()) {
    const tm = Path.join(root, 'tm', tname)
    if (!fs.existsSync(tm)) {
      continue
    }

    for (const found of findFeatureSources(fs, tm, [plan.name])) {
      const abs = Path.join(tm, found.path)
      const base = 'tm/' + tname + '/' + found.path
      if (found.folder) {
        plan.dirs.push(base)
        plan.files.push(...walk(fs, abs).map((r) => base + '/' + r))
      }
      else {
        plan.files.push(base)
      }
    }
  }
}


function planOutput(
  plan: RemovePlan, actx: ActionContext, declared: any, deleteOutput: boolean,
) {
  const fs = actx.fs()
  const root = actx.folder

  if (null != declared?.output?.path) {
    plan.notes.push(plan.name + ': generates out of tree (' +
      declared.output.path + '); that output is not touched')
    return
  }

  const output = Path.join(root, '..', plan.name)

  if (!fs.existsSync(output)) {
    return
  }

  if (deleteOutput) {
    plan.output = output
    return
  }

  plan.notes.push(plan.name + ': generated output kept at ' +
    rel(root, output) + '; pass --delete-output to remove it')
}


function resolveDeclared(
  kind: string, name: string, declared: any, actx: ActionContext,
): any | undefined {
  const ref = recordedRef(declared, name) || name
  try {
    return resolveSource(
      ref, kind, { folder: actx.folder, fs: actx.fs, log: actx.log, model: actx.model })
  }
  catch (err: any) {
    return undefined
  }
}


async function driftFindings(
  actx: ActionContext, scope: (kind: string, name: string) => boolean,
  selected?: string[],
): Promise<{ all: string[], aliased: Set<string> }> {
  const quiet = quietLog(actx.log)
  const res: any = await doctor({ ...actx, log: quiet }, scope, selected)
  const report = res.report

  return {
    all: [
      ...report.forked,
      ...report.edited,
      ...report.stale,
      ...report.additive,
      ...report.aliasedDiff,
    ],
    // Kept apart because it needs different advice — see kindRemove.
    aliased: new Set<string>(report.aliasedDiff),
  }
}


// Model files outside the item's own that still name it: a project's
// declarations are the project's, so they are reported, never edited.
function projectMentions(kind: string, name: string, actx: ActionContext): string[] {
  const fs = actx.fs()
  const root = actx.folder
  const modeldir = Path.join(root, 'model')

  if (!fs.existsSync(modeldir)) {
    return []
  }

  const own = kind + '/'
  const re = new RegExp(
    '\\b' + kind + ':\\s*[\'"]?' + escapeRe(name) + '[\'"]?\\s*:')

  const out: string[] = []
  for (const r of walk(fs, modeldir)) {
    if (!/\.(aontu|aon)$/.test(r) || r.startsWith(own)) {
      continue
    }
    let src = ''
    try {
      src = String(fs.readFileSync(Path.join(modeldir, r), 'utf8'))
    }
    catch (err: any) {
      continue
    }
    if (re.test(src)) {
      out.push(name + ': model/' + r + ' still declares main.' + KIT + '.' +
        ('edition' === kind ? 'doc.edition' : kind) + '.' + name +
        '; remove that declaration by hand')
    }
  }

  return out
}


function applyRemove(plan: RemovePlan, actx: ActionContext, dryrun: boolean): string[] {
  const fs = actx.fs()
  const log = actx.log
  const root = actx.folder
  const { kind, name } = plan

  const touched: string[] = []

  const say = (file: string, what: string) => {
    touched.push(file)
    log.info({
      point: 'remove-file', kind, [kind]: name, file, dryrun,
      note: (dryrun ? 'would remove ' : 'removed ') + what
    })
  }

  for (const f of plan.files) {
    say(f, f)
    if (!dryrun) {
      fs.unlinkSync(Path.join(root, ...f.split('/')))
    }
  }

  for (const d of plan.dirs) {
    if (!dryrun) {
      rmEmptyTree(fs, Path.join(root, ...d.split('/')))
    }
  }

  if (plan.indexed) {
    const index = indexPath(root, kind)
    say('model/' + kind + '/' + indexName(kind), 'the index entry for ' + name)
    if (!dryrun) {
      fs.writeFileSync(index,
        removeIndexEntries(String(fs.readFileSync(index, 'utf8')), [name]))
    }
  }

  if (null != plan.output) {
    say(rel(root, plan.output), 'generated output ' + rel(root, plan.output))
    if (!dryrun) {
      fs.rmSync(plan.output, { recursive: true, force: true })
    }
  }

  if (!dryrun) {
    delete kindCollection(actx.model, kind)[name]
  }

  return touched
}


// Drop a tree whose files have gone. Anything still inside (a droppings
// file the walk skipped, say) goes with it: the tree is the item's.
function rmEmptyTree(fs: any, dir: string) {
  if (!fs.existsSync(dir)) {
    return
  }
  fs.rmSync(dir, { recursive: true, force: true })
}


function walk(fs: any, dir: string): string[] {
  const out: string[] = []

  const descend = (r: string) => {
    const abs = '' === r ? dir : Path.join(dir, r)
    for (const entry of fs.readdirSync(abs).sort()) {
      if (isJunk(entry)) {
        continue
      }
      const er = '' === r ? entry : r + '/' + entry
      if (fs.statSync(Path.join(dir, er)).isDirectory()) {
        descend(er)
      }
      else {
        out.push(er)
      }
    }
  }

  descend('')

  return out.sort()
}


function rel(root: string, abs: string): string {
  return Path.relative(root, abs).split(Path.sep).join('/')
}


function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}


function quietLog(log: any): any {
  const noop = () => { }
  const quiet: any = {
    info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  }
  quiet.child = () => quiet
  return quiet
}


export type {
  RemovePlan,
}

export {
  kind_remove,
  planRemove,
}
