import { kindCollection } from '../helpers/kindCollection'

import Path from 'node:path'

import { template } from 'jostraca'

import {
  KIT
} from '../types'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import { templateReplacements, provenanceReplace } from '../helpers/stdrep'

import {
  trimFeatures,
  aliasCmpText,
  aliasCmpName,
} from './target'

import { recordedRef, KINDS, kindDef, kindTrees } from './kind'
import type { TreeDef } from './kind'

import { resolveSource } from './resolve'
import type { Source } from './resolve'

import { definitionPath } from '../helpers/definition'

import { findFeatureSources } from '../helpers/featureSource'

import { isJunk } from '../helpers/junk'


const IGNORED_RE = /(~|-jostraca-off)$/

function ignoredEntry(name: string): boolean {
  return IGNORED_RE.test(name) || isJunk(name)
}

// Extensions jostraca copies byte-for-byte. Comparing them as text would
// report spurious differences, so they are compared by raw bytes.
const BINARY_RE = /\.(png|jpg|jpeg|gif|ico|pdf|zip|gz|woff2?|ttf|eot|wasm)$/i


const ROOT_COMPONENTS: [string, string][] = [
  ['ReadmeTop', 'the assembled root README (quickstart, howto, test, package table)'],
  ['AgentGuideTop', 'the root AGENTS.md / CLAUDE.md agent guides'],
  ['License', 'the root LICENSE'],
  ['Security', 'the root SECURITY.md'],
  ['Changelog', 'the root CHANGELOG.md'],
  ['Deploy', 'the release/publish recipes'],
]


// What the check found, by category. Categories 1-3 are drift; `additive` is
// the project's own work and is reported separately, never as a problem.
type DoctorReport = {
  // `.sdk/src/cmp/**`, or a target's own `.sdk/model/target/<t>.aon`, that
  // differs from the scaffold. `target add` will silently revert every one of
  // these.
  forked: string[]

  // `.sdk/tm/**` that differs from the scaffold AFTER the same substitution
  // `target add` applies.
  edited: string[]

  stale: string[]

  missing: string[]

  additive: string[]

  superseded: string[]

  // Root-level components this sdkgen provides that the project's root
  // wiring never calls. Informational: opting out is legitimate.
  unwired: string[]

  orphanModel: string[]

  // A copy that differs from the scaffold ONLY in its provenance lines —
  // written before `base`/`origname` were stamped, so the project changed
  // nothing and `target add` will bring it up to date. Informational: this
  // exists so the provenance rollout does not read as a fork in every
  // project at once.
  resyncPending: string[]

  // An ALIASED target's model file differs from what its origin would
  // produce. Informational: that file is project-owned, and differentiating
  // it is what an alias is FOR.
  aliasedDiff: string[]

  ok: boolean
}


const CMD_MAP: any = {
  check: cmd_doctor_check,
  prune: cmd_doctor_prune,
}


async function action_doctor(args: string[], actx: ActionContext): Promise<ActionResult> {
  // `doctor` with no subcommand is the check — the command exists to be run
  // in CI without anyone remembering a verb.
  const cmdname = args[1]
  const cmd = null == cmdname ? cmd_doctor_check : CMD_MAP[cmdname]

  if (null == cmd) {
    throw new SdkGenError('Unknown doctor cmd: ' + cmdname)
  }

  return await cmd(args, actx)
}


async function cmd_doctor_check(_args: string[], actx: ActionContext): Promise<ActionResult> {
  return doctor(actx)
}


async function cmd_doctor_prune(_args: string[], actx: ActionContext): Promise<ActionResult> {
  const log = actx.log
  const fs = actx.fs()

  const found = supersededFiles(actx)
  const pruned: string[] = []

  for (const abs of found) {
    fs.unlinkSync(abs)
    pruned.push(abs)
    log.info({ point: 'doctor-prune', file: abs, note: 'pruned superseded: ' + abs })
  }

  log.info({
    point: 'doctor-prune-end', pruned: pruned.length,
    note: 0 === pruned.length ? 'nothing superseded to prune' :
      ('pruned ' + pruned.length + ' superseded file(s)')
  })

  return { report: { pruned, ok: true } }
}


function supersededFiles(actx: ActionContext): string[] {
  const fs = actx.fs()
  const model = actx.model
  const root = actx.folder

  const targets = (model as any)?.main?.[KIT]?.target ?? {}

  const found: string[] = []
  for (const tname of Object.keys(targets).sort()) {
    for (const rel of (targets[tname].superseded || [])) {
      const abs = Path.join(root, '..', tname, String(rel))
      if (fs.existsSync(abs)) {
        found.push(abs)
      }
    }
  }
  return found
}


// Narrows the check to particular items — `package update` runs doctor as
// its pre-check and needs the verdict for ONE package's items, not the
// project's. Reusing the real comparison rather than writing a second one is
// the point: a gate that decides whether to overwrite a project's files must
// not have its own idea of what counts as a difference.
type DoctorScope = (kind: string, name: string) => boolean


function orphanModelFiles(actx: ActionContext): string[] {
  const fs = actx.fs()
  const modeldir = Path.join(actx.folder, 'model')

  if (!fs.existsSync(modeldir)) {
    return []
  }

  const all = walk(fs, modeldir)
    .filter((rel) => rel.endsWith('.aon') || rel.endsWith('.aontu'))
    .filter((rel) => !rel.includes('.jostraca/') && !rel.startsWith('guide/'))

  const ENTRY = [
    'sdk.aon', 'sdk.aontu',
    'test/test.aon', 'test/test.aontu',
    '.model-config/model-config.aon', '.model-config/model-config.aontu',
  ]

  const seen = new Set<string>()
  const queue = ENTRY.filter((rel) => all.includes(rel))

  while (0 < queue.length) {
    const rel = queue.shift() as string
    if (seen.has(rel)) {
      continue
    }
    seen.add(rel)

    let src = ''
    try {
      src = fs.readFileSync(Path.join(modeldir, rel), 'utf8')
    }
    catch (e) {
      continue
    }

    for (const m of src.matchAll(/@"([^"]+)"/g)) {
      const ref = m[1]
      if (ref.startsWith('@')) {
        continue
      }
      const from = Path.posix.dirname(rel)
      const next = Path.posix.normalize(
        Path.posix.join('.' === from ? '' : from, ref.replace(/^\.\//, '')))
      if (all.includes(next) && !seen.has(next)) {
        queue.push(next)
      }
    }
  }

  return all.filter((rel) => !seen.has(rel)).sort()
}


async function doctor(
  actx: ActionContext, scope?: DoctorScope, selected?: string[],
): Promise<ActionResult> {
  const log = actx.log
  const fs = actx.fs()
  const model = actx.model
  const root = actx.folder

  const report: DoctorReport = {
    forked: [], edited: [], stale: [], missing: [], additive: [],
    superseded: [], unwired: [], orphanModel: [],
    resyncPending: [], aliasedDiff: [], ok: true,
  }

  report.superseded = supersededFiles(actx)

  report.orphanModel = orphanModelFiles(actx)

  const kinds = Object.keys(KINDS).sort()

  const counts: Record<string, number> = {}
  for (const kind of kinds) {
    counts[kind] = Object.keys(kindCollection(model, kind) ?? {}).length
  }

  log.info({ point: 'doctor-start', targets: counts.target ?? 0, ...counts })

  const targets = new Map<string, Source>()

  for (const tname of
    Object.keys((model as any)?.main?.[KIT]?.target ?? {}).sort()) {
    const source = resolveDeclared('target', tname, actx)

    if (null != source) {
      targets.set(tname, source)
    }
  }

  for (const kind of kinds) {
    const items = Object.keys(kindCollection(model, kind) ?? {}).sort()

    for (const name of items) {
      if (null != scope && !scope(kind, name)) {
        continue
      }

      const source = 'target' === kind ?
        targets.get(name) : resolveDeclared(kind, name, actx)

      if (null == source) {
        continue
      }

      if ('target' === kind) {
        checkTarget(actx, source, report, selected)
      }

      if ('edition' === kind) {
        checkEdition(actx, source, report)
      }

      // Only an ACTIVE feature has source copied out; an inactive one's
      // leftovers are stale. `selected` overrides that for the caller's own.
      if ('feature' === kind &&
        (false !== (model as any)?.main?.[KIT]?.feature?.[name]?.active ||
          true === selected?.includes(name))) {
        checkFeatureSource(actx, source, targets, report)
      }

      checkItemModel(actx, kind, source, report)
    }
  }

  if (null == scope) {
    checkWiring(actx, report)
  }

  // orphanModel counts, and `unwired` does not. Not skipping a root
  // component is a legitimate project choice that doctor only mentions; a
  // model file nothing reads is never a choice - it is either a file that
  // should be included, or one that should be deleted, and it reads as
  // authoritative either way.
  report.ok = 0 === report.forked.length + report.edited.length +
    report.stale.length + report.missing.length + report.superseded.length +
    report.orphanModel.length

  for (const [kind, note] of [
    ['forked', 'FORKED (will be reverted by `target add`)'],
    ['edited', 'EDITED template master'],
    ['stale', 'STALE (no longer written by `target add`)'],
    ['missing', 'MISSING (would be written by `target add`)'],
    ['additive', 'additive (project-owned, not drift)'],
    ['superseded', 'SUPERSEDED generated output (run `doctor prune` to delete)'],
    ['unwired', 'NOT WIRED IN (root capability this project is missing)'],
    ['orphanModel', 'ORPHAN MODEL FILE (on disk, included by nothing, read by nobody)'],
    ['resyncPending', 'RESYNC PENDING (predates provenance; `target add` updates it)'],
    ['aliasedDiff', 'aliased model differs from its origin (project-owned, not drift)'],
  ] as [keyof DoctorReport, string][]) {
    for (const file of (report[kind] as string[])) {
      log.info({ point: 'doctor-finding', kind, file, note: note + ': ' + file })
    }
  }

  log.info({
    point: 'doctor-end',
    ok: report.ok,
    forked: report.forked.length,
    edited: report.edited.length,
    stale: report.stale.length,
    missing: report.missing.length,
    additive: report.additive.length,
    superseded: report.superseded.length,
    unwired: report.unwired.length,
    orphanModel: report.orphanModel.length,
    resyncPending: report.resyncPending.length,
    aliasedDiff: report.aliasedDiff.length,
    note: report.ok ?
      ('.sdk matches the scaffold (' + report.additive.length + ' additive)') :
      ('.sdk has drifted: ' + report.forked.length + ' forked, ' +
        report.edited.length + ' edited, ' + report.stale.length + ' stale, ' +
        report.missing.length + ' missing')
  })

  return { report }
}


// Which root-level components the project's own wiring calls. The wiring is
// hand-written TypeScript (Root.ts / Top.ts / BuildSDK.ts), so this is a
// reference check, not a diff: sdkgen has no reference copy of a file it does
// not ship.
function checkWiring(actx: ActionContext, report: DoctorReport) {
  const fs = actx.fs()
  const src = Path.join(actx.folder, 'src')

  if (!fs.existsSync(src)) {
    return
  }

  // Everything except cmp/, which is the per-target layer target add owns.
  const wiring = walk(fs, src)
    .filter((rel) => !rel.startsWith('cmp/') && rel.endsWith('.ts'))
    .map((rel) => fs.readFileSync(Path.join(src, rel), 'utf8'))
    .join('\n')

  if ('' === wiring) {
    return
  }

  for (const [name, what] of ROOT_COMPONENTS) {
    // A bare identifier reference: imported and called, or at least named.
    if (!new RegExp('\\b' + name + '\\b').test(wiring)) {
      report.unwired.push(name + ' — ' + what)
    }
  }
}


function resolveDeclared(
  kind: string, name: string, actx: ActionContext,
): Source | undefined {
  const declared: any = kindCollection(actx.model, kind)?.[name]
  const ref = recordedRef(declared, name) || name

  try {
    return resolveSource(
      ref, kind, { folder: actx.folder, fs: actx.fs, log: actx.log })
  }
  catch (err: any) {
    actx.log.warn({
      point: 'doctor-source-unresolved', kind, [kind]: name, err: err.message,
      note: name + ': cannot find its ' + kind + ' source (' +
        err.message + ')'
    })
    return undefined
  }
}


function checkTarget(
  actx: ActionContext, resolved: Source, report: DoctorReport,
  selected?: string[],
) {
  const tname = resolved.name
  const tfolder = resolved.folder
  const torigname = resolved.origname
  const fs = actx.fs()
  const model = actx.model
  const root = actx.folder

  const aliased = tname !== torigname

  const renameCmp = aliased ?
    (rel: string) => aliasCmpName(rel, torigname, tname) : undefined

  const rewriteCmp = aliased ?
    (src: string) => aliasCmpText(src, torigname, tname) : undefined

  const trees: TreeCompare[] = [
      {
        project: Path.join(root, 'src', 'cmp', tname),
        scaffold: Path.join(tfolder, 'src', 'cmp', torigname),
        replace: {},
        kind: 'forked',
        rename: renameCmp,
        rewrite: rewriteCmp,
      },
      {
        project: Path.join(root, 'tm', tname),
        scaffold: Path.join(tfolder, 'tm', torigname),
        replace: templateReplacements(model, tname),
        kind: 'edited',
      },
    ]

  // The feature set `target add` would select right now, plus any the CALLER
  // is acting on (`selected`, see COMMENT-NOTES.md). A project that added its
  // targets before feature trimming existed carries source for features its
  // model never declared — expected here as STALE, which is what it is.
  const featuremodel: any = model?.main?.[KIT]?.feature ?? {}
  const features = Array.from(new Set([
    'test',
    ...Object.keys(featuremodel).filter((n: string) => false !== featuremodel[n]?.active),
    ...(selected ?? []),
  ]))

  // `folder` and `model` matter: the trim catalogue is resolved consumer-side
  // (see featureCatalogue), so a doctor that withheld them would compute a
  // different trim from the one `target add` applied and report correctly
  // trimmed files as missing.
  const excludes: RegExp[] = trimFeatures(
    { log: quietLog(actx.log), fs: () => fs, folder: root, model },
    tfolder, torigname, tname, features)

  compareTrees(actx, report, trees, {
    excludes,
    foreign: (kind: string) => 'edited' === kind ?
      foreignFeatureSource(actx, resolved) : [],
  })
}


function compareTrees(
  actx: ActionContext,
  report: DoctorReport,
  trees: TreeCompare[],
  opts?: {
    excludes?: RegExp[],
    foreign?: (kind: string) => Iterable<[string, string]>,
  },
) {
  const fs = actx.fs()
  const model = actx.model
  const root = actx.folder
  const excludes = opts?.excludes ?? []

  for (const tree of trees) {
    // Findings are reported at project-relative paths, the way a maintainer
    // would type them.
    const label = Path.relative(root, tree.project).split(Path.sep).join('/') + '/'

    const scaffoldFiles = 'edited' === tree.kind ?
      walk(fs, tree.scaffold).filter((rel) => !excluded(rel, excludes)) :
      walk(fs, tree.scaffold)

    const landed = new Map<string, string>(scaffoldFiles.map(
      (rel: string) => [
        null == tree.rename ? rel : tree.rename(rel),
        Path.join(tree.scaffold, rel),
      ]))

    const foreign = new Set<string>()

    for (const [rel, from] of (opts?.foreign?.(tree.kind) ?? [])) {
      landed.set(rel, from)
      foreign.add(rel)
    }

    const expected = Array.from(landed.keys()).sort()
    const actual = walk(fs, tree.project)

    const expectedSet = new Set(expected)
    const actualSet = new Set(actual)

    for (const rel of expected) {
      if (!actualSet.has(rel)) {
        report.missing.push(label + rel)
        continue
      }

      // A foreign feature's file is EXPECTED here (so it is not stale) but
      // compared by `checkFeatureSource`, from the feature's side. Comparing
      // it here too would report it twice on a full run — and, worse, would
      // leave it uncompared on a run scoped to the feature alone, which is
      // exactly when `feature add` is about to rewrite it.
      if (foreign.has(rel)) {
        continue
      }

      const from = landed.get(rel) as string

      if (differs(fs, from, Path.join(tree.project, rel),
        model, tree.replace, undefined, tree.rewrite)) {
        report[tree.kind].push(label + rel)
      }
    }

    for (const rel of actual) {
      if (expectedSet.has(rel)) {
        continue
      }

      // A component the scaffold has NEVER shipped is the project's own —
      // the supported way to add a per-target component. Anything else under
      // a tree `target add` owns is stale output.
      const known = fs.existsSync(Path.join(tree.scaffold, rel)) ||
        landed.has(rel)
      if ('forked' === tree.kind && !known) {
        report.additive.push(label + rel)
      }
      else {
        report.stale.push(label + rel)
      }
    }
  }
}


function checkEdition(
  actx: ActionContext, resolved: Source, report: DoctorReport,
) {
  const fs = actx.fs()
  const root = actx.folder
  const name = resolved.name
  const origname = resolved.origname
  const aliased = name !== origname

  const dest = kindTrees('edition', name)
  const from = kindTrees('edition', origname)

  const trees: TreeCompare[] = dest.flatMap((tree: TreeDef, i: number) => {
    const scaffold = Path.join(resolved.folder, ...from[i].path.split('/'))

    if (!fs.existsSync(scaffold)) {
      return []
    }

    const templated = 'template' === tree.replace

    return [{
      project: Path.join(root, ...tree.path.split('/')),
      scaffold,
      replace: templated ? templateReplacements(actx.model, name) : {},
      kind: templated ? 'edited' : 'forked',
      rename: aliased && !templated ?
        (rel: string) => aliasCmpName(rel, origname, name) : undefined,
      rewrite: aliased && !templated ?
        (src: string) => aliasCmpText(src, origname, name) : undefined,
    } as TreeCompare]
  })

  compareTrees(actx, report, trees)
}


// One tree to compare: where it landed, where it came from, what the copy
// substituted, and how a finding about it is categorised.
//
//   forked — a verbatim copy, so any difference is a fork of the source
//   edited — a templated copy, so a difference is an edit to the master
type TreeCompare = {
  project: string
  scaffold: string
  replace: any
  kind: 'forked' | 'edited'
  rename?: (rel: string) => string
  rewrite?: (src: string) => string
}


function foreignFeatureSource(
  actx: ActionContext, target: Source,
): Map<string, string> {
  const out = new Map<string, string>()

  const features: any = (actx.model as any)?.main?.[KIT]?.feature ?? {}

  for (const fname of Object.keys(features).sort()) {
    if (false === features[fname]?.active) {
      continue
    }

    const source = resolveDeclared('feature', fname, actx)

    if (null == source) {
      continue
    }

    for (const [rel, from] of overlayFiles(actx, source, target)) {
      out.set(rel, from)
    }
  }

  return out
}


function overlayFiles(
  actx: ActionContext, feature: Source, target: Source,
): Map<string, string> {
  const fs = actx.fs()
  const out = new Map<string, string>()

  if (feature.folder === target.folder) {
    return out
  }

  // The feature package's overlay for THIS target, under the name the target
  // has in its own source — an aliased target's templates live at
  // `tm/<origname>`.
  const overlay = Path.join(feature.folder, 'tm', target.origname)

  for (const found of findFeatureSources(fs, overlay, [feature.name])) {
    const from = Path.join(overlay, found.path)

    // A folder source is the whole feature directory; expand it, because the
    // comparison is per file.
    if (found.folder) {
      for (const rel of walk(fs, from)) {
        out.set(found.path + '/' + rel, Path.join(from, rel))
      }
    }
    else {
      out.set(found.path, from)
    }
  }

  return out
}


function checkFeatureSource(
  actx: ActionContext,
  feature: Source,
  targets: Map<string, Source>,
  report: DoctorReport,
) {
  const fs = actx.fs()
  const root = actx.folder
  const model = actx.model

  for (const [tname, target] of targets) {
    for (const [rel, from] of overlayFiles(actx, feature, target)) {
      const project = Path.join(root, 'tm', tname, rel)
      const label = 'tm/' + tname + '/' + rel

      if (!fs.existsSync(project)) {
        report.missing.push(label)
        continue
      }

      // The same map `feature add` copies with — see helpers/stdrep. A
      // different one here would report every substituted file as edited.
      if (differs(fs, from, project, model, templateReplacements(model, tname))) {
        report.edited.push(label)
      }
    }
  }
}


function checkItemModel(
  actx: ActionContext, kind: string, source: Source, report: DoctorReport,
) {
  const name = source.name
  const origname = source.origname
  const base = source.base
  const fs = actx.fs()

  const scaffold = definitionPath(source.folder, kind, origname)

  if (!fs.existsSync(scaffold)) {
    return
  }

  const aliased = kindDef(kind).alias && name !== origname

  const project = definitionPath(actx.folder, kind, name)
  const label = 'model/' + kind + '/' + name + '.aon'

  if (!fs.existsSync(project)) {
    report.missing.push(label)
    return
  }

  const provenance = provenanceReplace(
    { base, origname, name, package: source.package })

  const rename = kindDef(kind).rename

  const rewrite = (aliased && null != rename) ?
    (src: string) => rename(src, origname, name) : undefined

  if (!differs(fs, scaffold, project, actx.model, provenance, undefined, rewrite)) {
    return
  }

  if (aliased) {
    report.aliasedDiff.push(label)
    return
  }

  if (stampOnly(fs, scaffold, project, actx.model, provenance, rewrite)) {
    report.resyncPending.push(label)
    return
  }

  report.forked.push(label)
}


function stampOnly(
  fs: any, scaffoldPath: string, projectPath: string, model: any,
  provenance: Record<string, string>,
  rewrite?: (src: string) => string,
): boolean {
  const { expected, actual } = renderPair(
    fs, scaffoldPath, projectPath, model, provenance, rewrite)

  // The rendered block, as lines: `base: '...'` plus whichever of
  // `origname:` / `package:` applied. Trimmed on both sides of the
  // comparison, because the anchor's own indentation belongs to the scaffold.
  const stamp = new Set(
    Object.values(provenance).join('\n').split('\n')
      .map((s: string) => s.trim()))

  const onlyExpected = lineDiff(expected, actual)
  const onlyActual = lineDiff(actual, expected)

  return 0 === onlyActual.length &&
    0 < onlyExpected.length &&
    onlyExpected.every((line: string) => stamp.has(line.trim()))
}


function lineDiff(a: string, b: string): string[] {
  const pool = new Map<string, number>()

  for (const line of b.split('\n')) {
    pool.set(line, (pool.get(line) ?? 0) + 1)
  }

  const out: string[] = []

  for (const line of a.split('\n')) {
    const n = pool.get(line) ?? 0
    if (0 < n) {
      pool.set(line, n - 1)
    }
    else {
      out.push(line)
    }
  }

  return out
}


// Every file under `dir`, as forward-slash paths relative to it, sorted.
// Missing directory -> no files (a target that was never added).
function walk(fs: any, dir: string): string[] {
  const out: string[] = []

  if (!fs.existsSync(dir)) {
    return out
  }

  const descend = (rel: string) => {
    const abs = '' === rel ? dir : Path.join(dir, rel)
    for (const entry of fs.readdirSync(abs).sort()) {
      if (ignoredEntry(entry)) {
        continue
      }
      const entryrel = '' === rel ? entry : rel + '/' + entry
      if (fs.statSync(Path.join(dir, entryrel)).isDirectory()) {
        descend(entryrel)
      }
      else {
        out.push(entryrel)
      }
    }
  }

  descend('')

  return out.sort()
}


function excluded(rel: string, excludes: RegExp[]): boolean {
  for (const re of excludes) {
    if (re.test(rel)) {
      return true
    }
  }
  return false
}


function differs(
  fs: any, scaffoldPath: string, projectPath: string, model: any, replace: any,
  ignore?: (line: string) => boolean,
  rewrite?: (src: string) => string,
): boolean {
  if (BINARY_RE.test(scaffoldPath)) {
    return !fs.readFileSync(scaffoldPath).equals(fs.readFileSync(projectPath))
  }

  const { expected, actual } = renderPair(
    fs, scaffoldPath, projectPath, model, replace, rewrite)

  if (null == ignore) {
    return expected !== actual
  }

  const strip = (s: string) =>
    s.split('\n').filter((line: string) => !ignore(line)).join('\n')

  return strip(expected) !== strip(actual)
}


function renderPair(
  fs: any, scaffoldPath: string, projectPath: string, model: any, replace: any,
  rewrite?: (src: string) => string,
): { expected: string, actual: string } {
  const rawsrc = fs.readFileSync(scaffoldPath, 'utf8')
  const src = null == rewrite ? rawsrc : rewrite(rawsrc)

  return {
    expected: template(src, model, { replace }),
    actual: fs.readFileSync(projectPath, 'utf8'),
  }
}


function quietLog(log: any): any {
  const noop = () => { }
  const quiet: any = { info: noop, debug: noop, warn: log.warn.bind(log), error: noop, trace: noop, fatal: noop }
  quiet.child = () => quiet
  return quiet
}


export type {
  DoctorReport,
  DoctorScope,
}

export {
  action_doctor,
  doctor,
}
