// `voxgig-sdkgen doctor` — does this project's `.sdk/` still match the
// scaffold?
//
// WHY THIS EXISTS
//
// Nothing told a project that its `.sdk/` had drifted. `target add`
// OVERWRITES the vendored components, the template masters AND the per-target
// model file, so any hand-edit there is silently reverted on the next run —
// and any file the scaffold has since stopped shipping just stays, compiling
// into the output forever. In voxgig-solardemo-sdk two such orphans broke the
// Go build in a single session: `utility/make_target.go` (replaced upstream by
// `make_point.go`, leaving a duplicate symbol) and `utility/struct/go.mod` (a
// nested module that made `utility/struct` unimportable).
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

import { templateReplacements, provenanceReplace } from '../helpers/stdrep'

import {
  trimFeatures,
  aliasCmpText,
  aliasCmpName,
} from './target'

// `aliasModelText` is no longer named here: the model-file comparison asks
// the registry for the kind's own `rename`, so a kind that renames
// differently is handled without this file knowing how.
import { recordedRef, KINDS, kindDef } from './kind'

import { resolveSource } from './resolve'
import type { Source } from './resolve'

import { definitionPath } from '../helpers/definition'


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
  // `.sdk/src/cmp/**`, or a target's own `.sdk/model/target/<t>.aontu`, that
  // differs from the scaffold. `target add` will silently revert every one of
  // these.
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


// Narrows the check to particular items — `package update` runs doctor as
// its pre-check and needs the verdict for ONE package's items, not the
// project's. Reusing the real comparison rather than writing a second one is
// the point: a gate that decides whether to overwrite a project's files must
// not have its own idea of what counts as a difference.
type DoctorScope = (kind: string, name: string) => boolean


// Code API. Returns the report; the CLI turns a non-ok report into a
// non-zero exit so this can gate CI.
async function doctor(
  actx: ActionContext, scope?: DoctorScope,
): Promise<ActionResult> {
  const log = actx.log
  const fs = actx.fs()
  const model = actx.model
  const root = actx.folder

  const report: DoctorReport = {
    forked: [], edited: [], stale: [], missing: [], additive: [],
    unwired: [], resyncPending: [], aliasedDiff: [], ok: true,
  }

  // EVERY KIND, not just targets.
  //
  // `add` writes a copied model file for each kind — `model/target/<t>.aontu`
  // and `model/feature/<f>.aontu` alike — and overwrites it on every resync.
  // Only the target one was ever compared, so a hand-edit to an installed
  // FEATURE definition read as perfectly in sync and was silently reverted by
  // the next `target add` (which re-runs `feature add` for every active
  // feature). That is exactly the failure `checkTargetModel` was added for,
  // left open for the other half of what add owns.
  //
  // Driven off the registry, so a kind added later is checked without
  // anything here changing. The per-kind EXTRAS — a target's `src/cmp` and
  // `tm` trees — stay in that kind's own check, because they are genuinely
  // different work rather than the same work with different strings.
  const kinds = Object.keys(KINDS).sort()

  const counts: Record<string, number> = {}
  for (const kind of kinds) {
    counts[kind] = Object.keys((model as any)?.main?.[KIT]?.[kind] ?? {}).length
  }

  log.info({ point: 'doctor-start', targets: counts.target ?? 0, ...counts })

  for (const kind of kinds) {
    const items = Object.keys((model as any)?.main?.[KIT]?.[kind] ?? {}).sort()

    for (const name of items) {
      if (null != scope && !scope(kind, name)) {
        continue
      }

      const source = resolveDeclared(kind, name, actx)

      if (null == source) {
        continue
      }

      if ('target' === kind) {
        checkTarget(actx, {
          tname: source.name,
          tfolder: source.folder,
          torigname: source.origname,
        }, report)
      }

      checkItemModel(actx, kind, source, report)
    }
  }

  // Root-component wiring is a property of the PROJECT, not of any item, so a
  // scoped run has no business reporting on it — `package update` asking "is
  // this package's copy clean" should not also say the project never wired in
  // `ReadmeTop`.
  if (null == scope) {
    checkWiring(actx, report)
  }

  report.ok = 0 === report.forked.length + report.edited.length +
    report.stale.length + report.missing.length

  for (const [kind, note] of [
    ['forked', 'FORKED (will be reverted by `target add`)'],
    ['edited', 'EDITED template master'],
    ['stale', 'STALE (no longer written by `target add`)'],
    ['missing', 'MISSING (would be written by `target add`)'],
    ['additive', 'additive (project-owned, not drift)'],
    ['unwired', 'NOT WIRED IN (root capability this project is missing)'],
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
    unwired: report.unwired.length,
    resyncPending: report.resyncPending.length,
    aliasedDiff: report.aliasedDiff.length,
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


// Where one declared item came from, or undefined with the reason said out
// loud.
//
// The model records `base` and `origname` (written by add), and `origname` is
// what makes an ALIAS checkable: the ref used to be rebuilt as
// `<base>/../<name>`, which names the INSTALLED item — so `target add ts~ts2`
// sent doctor looking for a `ts2` scaffold that does not exist, both trees
// walked empty, and every component read as `additive` while every template
// read as `stale` (a FAILING category). Real edits were undetectable and
// doctor went red on noise.
//
// A bare name falls back to the bundled scaffold, for a copy predating
// provenance.
function resolveDeclared(
  kind: string, name: string, actx: ActionContext,
): Source | undefined {
  const declared: any = (actx.model as any)?.main?.[KIT]?.[kind]?.[name]
  const ref = recordedRef(declared, name) || name

  try {
    // WITH THE LOG. Resolution reads the source's package manifest, and an
    // unusable one is reported only through `ctx$.log`. Without it doctor
    // silently lost the package name — and then reported every item from that
    // package as FORKED, because the expected text no longer carries the
    // `package:` line the copy has, with nothing anywhere saying why. That is
    // accurate (the next add really would strip the line) but unactionable,
    // which is the same defect as being wrong.
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


function checkTarget(actx: ActionContext, resolved: any, report: DoctorReport) {
  const { tname, tfolder, torigname } = resolved
  const fs = actx.fs()
  const model = actx.model
  const root = actx.folder

  // The two TREES `target add` owns, and the substitution it applies to each.
  // (It owns one FILE as well — see checkTargetModel, below.)
  //
  //   src/cmp — copied verbatim, so a byte compare is the truth.
  //   tm      — copied through jostraca's template(), with ProjectName.
  // An ALIASED install renames every `<Cmp>_<origname>` component to
  // `<Cmp>_<alias>` and rewrites the origin name inside the file (sibling
  // imports, the __dirname-relative fragment path), because components are
  // dispatched by the convention `cmp/<t>/Main_<t>`. doctor has to apply the
  // same two transforms or it expects the ORIGIN names in the alias's folder
  // and reports the entire tree as missing — 25 files for `go~go2`, none of
  // them a real finding.
  const aliased = tname !== torigname

  const renameCmp = aliased ?
    (rel: string) => aliasCmpName(rel, torigname, tname) : undefined

  const rewriteCmp = aliased ?
    (src: string) => aliasCmpText(src, torigname, tname) : undefined

  const trees: {
    project: string, scaffold: string, replace: any, kind: 'forked' | 'edited',
    rename?: (rel: string) => string,
    rewrite?: (src: string) => string,
  }[] = [
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

  // The feature set `target add` would select right now. A project that
  // added its targets before feature trimming existed carries source for
  // features its model never declared — expected here as STALE, which is
  // exactly what it is.
  const featuremodel: any = model?.main?.[KIT]?.feature ?? {}
  const features = Array.from(new Set([
    'test',
    ...Object.keys(featuremodel).filter((n: string) => false !== featuremodel[n]?.active),
  ]))

  // `folder` and `model` matter: the trim catalogue is resolved consumer-side
  // (see featureCatalogue), so a doctor that withheld them would compute a
  // different trim from the one `target add` applied and report correctly
  // trimmed files as missing.
  const excludes: RegExp[] = trimFeatures(
    { log: quietLog(actx.log), fs: () => fs, folder: root, model },
    tfolder, torigname, tname, features)

  for (const tree of trees) {
    // Findings are reported at project-relative paths, the way a maintainer
    // would type them.
    const label = Path.relative(root, tree.project).split(Path.sep).join('/') + '/'

    const scaffoldFiles = 'edited' === tree.kind ?
      walk(fs, tree.scaffold).filter((rel) => !excluded(rel, excludes)) :
      walk(fs, tree.scaffold)

    // Scaffold path -> the name it lands under in the project.
    const landed = new Map<string, string>(scaffoldFiles.map(
      (rel: string) => [null == tree.rename ? rel : tree.rename(rel), rel]))

    const expected = Array.from(landed.keys()).sort()
    const actual = walk(fs, tree.project)

    const expectedSet = new Set(expected)
    const actualSet = new Set(actual)

    for (const rel of expected) {
      if (!actualSet.has(rel)) {
        report.missing.push(label + rel)
        continue
      }

      const from = landed.get(rel) as string

      if (differs(fs, Path.join(tree.scaffold, from), Path.join(tree.project, rel),
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


// The copied MODEL FILE — `model/<kind>/<name>.aontu`, written by add with
// the `'BASE'` replacement, and overwritten on every resync exactly as
// `src/cmp` and `tm` are.
//
// It is not scaffolding trivia. A target's carries its dependency set, its
// `phase` gates, `srcfeature`, `feature.trim` / `feature.fullset` and its
// publish-registry identity; a feature's carries its version, `active`
// default, `config` defaults and hook wiring. So a maintainer who fixes a dep
// version there loses the fix on the next resync with nothing said (the SDK
// regresses with nobody touching it, which is the failure the "a project
// decision belongs in the MODEL" rule exists to prevent), and a project whose
// copy predates a scaffold change carries the old declaration forever while
// doctor reports it in sync.
//
// KIND-NEUTRAL, because the file is the same kind of thing for every kind:
// one definition, copied, stamped with provenance, optionally renamed for an
// alias. Only the alias rewrite is kind-specific, and the registry already
// says which kinds can be aliased at all.
function checkItemModel(
  actx: ActionContext, kind: string, source: Source, report: DoctorReport,
) {
  const name = source.name
  const origname = source.origname
  const base = source.base
  const fs = actx.fs()

  const scaffold = definitionPath(source.folder, kind, origname)

  // Nothing to compare against — a source that no longer ships this item.
  if (!fs.existsSync(scaffold)) {
    return
  }

  // An ALIAS's model file is PROJECT-OWNED: `target add go~go2` creates it and
  // never overwrites it again, because differentiating it is the whole point
  // of an alias (a second Go module needs its own module name and deps), and
  // add-a-target tells the project to edit it. So a difference here is not a
  // fork — `target add` will not revert it — and must not fail the check.
  //
  // It is still worth REPORTING, which it never was before: the origin was
  // unrecoverable, so doctor skipped the file entirely and an alias that had
  // drifted far from a moved-on upstream said nothing. With `origname`
  // recorded the comparison is possible, so it runs, with the same key
  // rewrite the add applied — and anything left over is the project's own
  // differentiation, reported as informational.
  //
  // Only for a kind that CAN be aliased. A feature cannot, so for features
  // this is always false and the ownership argument never applies — the
  // registry says which, rather than this inferring it from the names
  // happening to match.
  const aliased = kindDef(kind).alias && name !== origname

  const project = definitionPath(actx.folder, kind, name)
  const label = 'model/' + kind + '/' + name + '.aontu'

  if (!fs.existsSync(project)) {
    report.missing.push(label)
    return
  }

  // The substitution the add applied on the way in: jostraca's template()
  // against the model (so `module: name: '$$name$$'` arrives as the project
  // slug) plus the provenance block recording where the scaffold was.
  //
  // NOT templateReplacements() — that is the tm/ tree's map. The two writers
  // pass different maps, so doctor has to as well, or every project reads as
  // forked on the `base:` line alone. The map itself is shared with the
  // writer (helpers/stdrep) so the two cannot drift.
  //
  // `package` comes from the SOURCE's manifest, not from what the copy
  // records, for the same reason `base` does: what this compares is what the
  // add would write NOW. A package that renamed itself therefore reads as
  // forked, which is accurate — the next add would rewrite the line.
  const provenance = provenanceReplace(
    { base, origname, name, package: source.package })

  // For an alias, compare against what the origin WOULD produce under the new
  // name, so the rename itself is not the difference.
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

  // A copy written before the toolchain stamped some provenance key differs
  // from the scaffold by exactly the lines carrying that key. That is not a
  // fork — the project changed nothing — and reporting it as one would turn
  // every existing consumer's CI red on upgrade.
  //
  // PER KEY, not all-or-nothing. The keys arrived in stages — `base` and
  // `origname` first, `package` with the manifest — so a project that
  // resynced between two of them holds a copy that IS stamped (it has `base`)
  // and is still missing a later key. An all-or-nothing "is it stamped at
  // all" test called every one of those a fork: on the released 3.4.8
  // scaffold only ts, csharp and swift carried the anchor, and `ts` is in
  // essentially every consumer SDK, so that was close to the whole installed
  // base going red on a file nobody touched.
  if (stampOnly(fs, scaffold, project, actx.model, provenance, rewrite)) {
    report.resyncPending.push(label)
    return
  }

  report.forked.push(label)
}


// Is the ONLY difference a provenance line the copy has not been given yet?
//
// MATCHED AGAINST THE EXACT LINES THE STAMP PRODUCES, never against a pattern
// for "a line that looks like provenance". `base`, `origname` and `package`
// are not reserved words: `main: kit: target: <t>: module: package` (the Go
// root package identifier) and `publish: registry: package` (the published
// package name) are declared model slots that a target model may write in
// block form, on their own line, looking exactly like a provenance line to
// any regex. A generic pattern got BOTH directions wrong on such a model —
// it read the copy's `module: package:` as proof the copy was already
// stamped, so an untouched pre-manifest file was reported as forked; and it
// stripped that same real line from the comparison, so DELETING it — an
// actual fork, silently reverted by the next `target add` — was reported as
// a pending resync and passed the check.
//
// Comparing against `provenanceReplace`'s own output has no such ambiguity,
// and keeps the reader tied to the writer, which is the whole point of
// helpers/stdrep.
//
// The rule, once the two are known to differ:
//
//   - every line the EXPECTED has and the copy lacks must be a stamp line;
//   - the copy must have NO line the expected lacks.
//
// The second half is what keeps the tolerance narrow, as the previous
// rollout's review required: a changed `package:` value leaves the old line
// in the copy and unmatched, so it is a fork and is reported as one.
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


// Lines of `a` that `b` does not have, counting duplicates.
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
// `ignore` drops matching lines from BOTH sides before comparing, for a
// difference that is known not to be a fork (see the provenance rollout in
// checkTargetModel). It is deliberately a second, narrower question asked
// only after a plain comparison has already found a difference — so a file
// that matches exactly never depends on it.
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


// What `target add` WOULD write, beside what the project actually has.
//
// One definition, shared by the byte comparison and the stamp-only tolerance,
// so the two can never disagree about what the expected text is.
//
// template() runs even when there is nothing to REPLACE, because jostraca's
// Copy always interpolates `$$ref$$` against the model as well — the replace
// map is an extra, not the whole substitution. Skipping it for the src/cmp
// tree (whose Copy passes no replace map) meant the three Config fragments
// that carry `$$const.Name$$` / `$$main.kit.info.servers.0.url$$` arrived
// substituted and compared as bytes: every project with ts, js or dart
// reported `src/cmp/<t>/fragment/Config.fragment.<ext>` as FORKED straight
// out of `target add`, which is precisely the noise this exists to remove.
// With no `$$` refs and no replace keys, template() is the identity.
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


// trimFeatures logs its decisions; doctor is a report, not a run.
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
