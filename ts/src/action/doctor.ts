// `voxgig-sdkgen doctor` — does this project's `.sdk/` still match the
// scaffold?
//
// WHY THIS EXISTS
//
// Nothing told a project that its `.sdk/` had drifted. `target add`
// OVERWRITES the vendored components and template masters, so any hand-edit
// there is silently reverted on the next run — and any file the scaffold has
// since stopped shipping just stays, compiling into the output forever. In
// voxgig-solardemo-sdk two such orphans broke the Go build in a single
// session: `utility/make_target.go` (replaced upstream by `make_point.go`,
// leaving a duplicate symbol) and `utility/struct/go.mod` (a nested module
// that made `utility/struct` unimportable).
//
// Every divergence in that repo was found by hand-diffing. Without a check,
// fixing it once guarantees nothing about next month.
//
// WHY A NAIVE `diff -r` DOES NOT WORK
//
// `target add` writes template masters with substitution PARTLY applied, and
// inconsistently: `tm/go/core/error.go` arrives substituted (`SolardemoError`
// where the scaffold says `ProjectNameError`), `tm/ts/test/utility.ts` arrives
// raw (its placeholders are substituted later, at generate time), and
// `tm/go/LICENSE` has the year filled in. A plain `diff -r` against the
// scaffold reported 20 edited files in that repo; 19 were substitution
// artefacts and exactly ONE was a real hand-edit.
//
// Only sdkgen knows which replacements it applied to which files, which is
// why this check belongs here and cannot be scripted downstream. It re-runs
// the same substitution before comparing, so what it reports is real.

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

import { templateReplacements } from '../helpers/stdrep'

import {
  resolveTarget,
  trimFeatures,
} from './target'


// jostraca's Copy walk skips these (IGNORED_RE in CopyOp) — editor backups and
// deliberately-disabled templates never reach a project, so they are not drift.
const IGNORED_RE = /(~|-jostraca-off)$/

// Extensions jostraca copies byte-for-byte. Comparing them as text would
// report spurious differences, so they are compared by raw bytes.
const BINARY_RE = /\.(png|jpg|jpeg|gif|ico|pdf|zip|gz|woff2?|ttf|eot|wasm)$/i


// Root-level components sdkgen provides, and what a project loses by not
// wiring one in. A project's `Root.ts` / `Top.ts` come from create-sdkgen at
// init and are then FROZEN — `target add` never touches them — so a
// capability added to sdkgen afterwards is invisible to every existing
// project. solardemo's `Top.ts`, written before `ReadmeTop` existed, kept
// hand-rolling a 9-line stub root README with an empty mermaid diagram for
// months, and no number of `target add` runs would ever have said so.
//
// Not wiring one in is a legitimate choice, so this is REPORTED, never a
// failure.
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
  // `.sdk/src/cmp/**` that differs from the scaffold. `target add` will
  // silently revert every one of these.
  forked: string[]

  // `.sdk/tm/**` that differs from the scaffold AFTER the same substitution
  // `target add` applies.
  edited: string[]

  // Present in the project, but `target add` would no longer write it. Stale
  // output — the category that broke the Go build twice.
  stale: string[]

  // `target add` would write it and the project does not have it.
  missing: string[]

  // Project-owned components the scaffold never shipped. NOT drift.
  additive: string[]

  // Root-level components this sdkgen provides that the project's root
  // wiring never calls. Informational: opting out is legitimate.
  unwired: string[]

  // True when nothing in the first four categories was found.
  ok: boolean
}


const CMD_MAP: any = {
  check: cmd_doctor_check,
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


// Code API. Returns the report; the CLI turns a non-ok report into a
// non-zero exit so this can gate CI.
async function doctor(actx: ActionContext): Promise<ActionResult> {
  const log = actx.log
  const fs = actx.fs()
  const model = actx.model
  const root = actx.folder

  const report: DoctorReport = {
    forked: [], edited: [], stale: [], missing: [], additive: [],
    unwired: [], ok: true,
  }

  const targets = Object.keys(model?.main?.[KIT]?.target ?? {})

  log.info({ point: 'doctor-start', targets: targets.length })

  for (const tname of targets) {
    const declared = (model as any)?.main?.[KIT]?.target?.[tname]

    // The target model records where it came from (`base`, written by
    // `target add`). Fall back to the bundled scaffold.
    const tref = (declared && declared.base) ?
      Path.join(declared.base, '..', tname) : tname

    let resolved: any
    try {
      resolved = resolveTarget(tref, { folder: root, fs: () => fs })
    }
    catch (err: any) {
      log.warn({
        point: 'doctor-target-unresolved', target: tname, err: err.message,
        note: tname + ': cannot find its scaffold (' + err.message + ')'
      })
      continue
    }

    if (null != resolved) {
      checkTarget(actx, resolved, report)
    }
  }

  checkWiring(actx, report)

  report.ok = 0 === report.forked.length + report.edited.length +
    report.stale.length + report.missing.length

  for (const [kind, note] of [
    ['forked', 'FORKED (will be reverted by `target add`)'],
    ['edited', 'EDITED template master'],
    ['stale', 'STALE (no longer written by `target add`)'],
    ['missing', 'MISSING (would be written by `target add`)'],
    ['additive', 'additive (project-owned, not drift)'],
    ['unwired', 'NOT WIRED IN (root capability this project is missing)'],
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
    unwired: report.unwired.length,
    note: report.ok ?
      ('.sdk matches the scaffold (' + report.additive.length + ' additive)') :
      ('.sdk has drifted: ' + report.forked.length + ' forked, ' +
        report.edited.length + ' edited, ' + report.stale.length + ' stale, ' +
        report.missing.length + ' missing')
  })

  return { report } as any
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


function checkTarget(actx: ActionContext, resolved: any, report: DoctorReport) {
  const { tname, tfolder, torigname } = resolved
  const fs = actx.fs()
  const model = actx.model
  const root = actx.folder

  // The two trees `target add` owns, and the substitution it applies to each.
  //
  //   src/cmp — copied verbatim, so a byte compare is the truth.
  //   tm      — copied through jostraca's template(), with ProjectName.
  const trees: {
    project: string, scaffold: string, replace: any, kind: 'forked' | 'edited',
  }[] = [
      {
        project: Path.join(root, 'src', 'cmp', tname),
        scaffold: Path.join(tfolder, 'src', 'cmp', torigname),
        replace: {},
        kind: 'forked',
      },
      {
        project: Path.join(root, 'tm', tname),
        scaffold: Path.join(tfolder, 'tm', torigname),
        replace: templateReplacements(model, tname),
        kind: 'edited',
      },
    ]

  // The feature set `target add` would select right now. A project that
  // added its targets before feature trimming existed carries source for
  // features its model never declared — expected here as STALE, which is
  // exactly what it is.
  const featuremodel: any = model?.main?.[KIT]?.feature ?? {}
  const features = Array.from(new Set([
    'test',
    ...Object.keys(featuremodel).filter((n: string) => false !== featuremodel[n]?.active),
  ]))

  const excludes: RegExp[] = trimFeatures(
    { log: quietLog(actx.log), fs: () => fs }, tfolder, torigname, tname, features)

  for (const tree of trees) {
    // Findings are reported at project-relative paths, the way a maintainer
    // would type them.
    const label = Path.relative(root, tree.project).split(Path.sep).join('/') + '/'

    const expected = 'edited' === tree.kind ?
      walk(fs, tree.scaffold).filter((rel) => !excluded(rel, excludes)) :
      walk(fs, tree.scaffold)

    const actual = walk(fs, tree.project)

    const expectedSet = new Set(expected)
    const actualSet = new Set(actual)

    for (const rel of expected) {
      if (!actualSet.has(rel)) {
        report.missing.push(label + rel)
        continue
      }

      if (differs(fs, Path.join(tree.scaffold, rel), Path.join(tree.project, rel),
        model, tree.replace)) {
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
      const known = fs.existsSync(Path.join(tree.scaffold, rel))
      if ('forked' === tree.kind && !known) {
        report.additive.push(label + rel)
      }
      else {
        report.stale.push(label + rel)
      }
    }
  }
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
      if (IGNORED_RE.test(entry)) {
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


// Compare a scaffold file with a project file, applying the SAME substitution
// `target add` applied on the way in. Without this the comparison reports
// every substituted placeholder as an edit.
function differs(
  fs: any, scaffoldPath: string, projectPath: string, model: any, replace: any,
): boolean {
  if (BINARY_RE.test(scaffoldPath)) {
    return !fs.readFileSync(scaffoldPath).equals(fs.readFileSync(projectPath))
  }

  const src = fs.readFileSync(scaffoldPath, 'utf8')
  const expected = 0 === Object.keys(replace).length ? src :
    template(src, model, { replace })

  return expected !== fs.readFileSync(projectPath, 'utf8')
}


// trimFeatures logs its decisions; doctor is a report, not a run.
function quietLog(log: any): any {
  const noop = () => { }
  const quiet: any = { info: noop, debug: noop, warn: log.warn.bind(log), error: noop, trace: noop, fatal: noop }
  quiet.child = () => quiet
  return quiet
}


export type {
  DoctorReport,
}

export {
  action_doctor,
  doctor,
}
