// `package check` — the AUTHOR-side battery. Design §14.
//
// WHAT IT IS FOR
//
// Every other verb here acts on a project. This one acts on a PACKAGE, before
// anyone installs it, and its whole value is moving a failure from the
// consumer's build back to the author's terminal. The failures worth moving
// are the ones a package cannot detect by using itself:
//
//   - a model file that compiles for the author and not for a consumer (the
//     `//` comment asymmetry — seven shipped targets went out that way);
//   - a key the base schema requires and the file omits, which nothing
//     notices until a consumer unifies the whole model;
//   - a key the PROJECT owns that the package pinned, which fails in the
//     consumer's own file and reads as the consumer's mistake;
//   - a manifest that disagrees with the disk, in either direction;
//   - feature source the trim step will never recognise, so it ships to every
//     project whatever the model selected.
//
// WHY IT REUSES EVERYTHING
//
// The battery asserts nothing of its own. Manifest agreement is
// `validateManifest`, the trees a kind needs are the kind registry's
// `requires`, the feature catalogue is `availableFeatures`, the source walk is
// `findFeatureEntries`, the model rules are `helpers/modelcheck`. A check that
// restated any of those would be a second copy of a rule the installer
// already has — and this workstream's most repeated defect is exactly that,
// two copies of one rule drifting apart. Where the check and the installer
// disagree, the check is wrong by construction.
//
// NO MANIFEST IS NOT A REFUSAL. `package add` requires one; here its absence
// is the first finding and the rest of the battery still runs, because an
// author who has not written it yet is precisely who needs the rest.

import Path from 'node:path'

import { KIT } from '../types'

import type {
  ActionContext,
  ActionResult,
} from '../types'

import { SdkGenError } from '../utility'

import {
  MANIFEST,
  probePackage,
  validateManifest,
} from '../helpers/manifest'

import type { Finding, Manifest } from '../helpers/manifest'

import { definitionPath, definitionNames } from '../helpers/definition'

import {
  ANCHOR,
  compileModel,
  publishOverrideProbe,
  slashComments,
} from '../helpers/modelcheck'

import {
  BASE_FEATURE,
  availableFeatures,
  findFeatureEntries,
  findFeatureSources,
} from '../helpers/featureSource'

import { scaffoldFolder } from '../helpers/shipped'

import { KINDS } from './kind'


// How many lines of one file's worth of the same problem to name before
// saying "and N more". A file with a hundred `//` lines is one mistake, and
// printing a hundred findings buries the other nine checks.
const SAME_FILE_LIMIT = 5


type CheckReport = {
  ok: boolean
  ref: string
  root: string
  errors: number
  warnings: number
  findings: Finding[]
  summary: string
}


async function cmd_package_check(
  args: string[], actx: ActionContext,
): Promise<ActionResult> {
  const refs = args.slice(2).flatMap(
    (a: any) => 'string' === typeof a ? a.split(',') : a)
    .filter((r: any) => null != r && '' !== r)

  // No ref means "the package I am standing in", which is where an author
  // runs it.
  const reports = (0 === refs.length ? ['.'] : refs)
    .map((ref: string) => checkPackage(ref, actx))

  const ok = reports.every((r: CheckReport) => r.ok)

  return {
    report: {
      ok,
      packages: reports,
      // The one line the CLI prints when it exits non-zero. Built here
      // because the counts are here; `bin/voxgig-sdkgen` must not have to
      // know what a check finding is.
      summary: reports.map((r: CheckReport) => r.summary).join('\n'),
    },
  }
}


// The battery, for one package. Logs as it goes and returns what it found, so
// a caller in a test can assert on findings without parsing log lines.
function checkPackage(ref: string, actx: ActionContext): CheckReport {
  const fs = actx.fs()
  const log = actx.log

  const { found, search } = probePackage(fs, actx.folder ?? '.', ref)

  // Nothing to check is not a finding — it is a wrong invocation, and the
  // caller needs to know which paths were tried.
  if (null == found) {
    throw new SdkGenError(
      'Package not found: ' + ref + '\n  looked for a `.sdk` folder in:\n    ' +
      search.join('\n    '))
  }

  const { root, sdk, read } = found

  log.info({
    point: 'package-check-start', package: ref, root,
    note: ref + ': checking ' + root
  })

  const findings: Finding[] = [
    ...checkManifest(fs, sdk, read),
    ...checkItems(fs, sdk, read.manifest),
    ...checkFeatureSource(fs, sdk, read.manifest),
  ]

  for (const f of findings) {
    const level = 'error' === f.level ? 'error' : f.level
    log[level](f)
  }

  const errors = findings.filter((f: Finding) => 'error' === f.level).length
  const warnings = findings.filter((f: Finding) => 'warn' === f.level).length

  const summary = ref + ': ' + (0 === errors ?
    (0 === warnings ? 'no findings' : warnings + ' warning(s)') :
    errors + ' error(s), ' + warnings + ' warning(s)')

  log.info({
    point: 'package-check-end', package: ref, root, errors, warnings,
    note: summary
  })

  return { ok: 0 === errors, ref, root, errors, warnings, findings, summary }
}


// The manifest, and its agreement with the disk in both directions.
function checkManifest(fs: any, sdk: string, read: any): Finding[] {
  if (null != read.err) {
    return [{
      level: 'error', point: 'manifest-unreadable', file: read.file,
      note: read.file + ': ' + read.err
    }]
  }

  if (null == read.manifest) {
    // A WARNING, not an error: the `.sdk` may be perfectly good, and a direct
    // `target add <path>/<name>` installs from it today. What it cannot do is
    // be installed as a package, which is what the manifest is for.
    return [{
      level: 'warn', point: 'manifest-absent', file: read.file,
      note: read.file + ': no manifest, so `package add` cannot install this' +
        ' — its items can still be added directly by path'
    }]
  }

  return validateManifest(fs, sdk, read.manifest, KINDS)
}


// Every item's definition file: the anchor, the comment dialect, the parse,
// the schema, and the kind-specific probes.
//
// The items are the manifest's claims UNION what is on disk, so a definition
// nobody claims is still checked (its being unclaimed is `validateManifest`'s
// finding, not a reason to skip it) and a claim with no file is skipped here
// (its absence is also already reported, and there is nothing to compile).
function checkItems(fs: any, sdk: string, manifest?: Manifest): Finding[] {
  const found: Finding[] = []

  for (const kind of Object.keys(KINDS).sort()) {
    const claimed = manifest?.provides?.[kind] ?? []
    const ondisk = definitionNames(fs, sdk, kind)

    const names = Array.from(new Set([...claimed, ...ondisk])).sort()

    for (const name of names) {
      const file = definitionPath(sdk, kind, name)

      if (!fs.existsSync(file)) {
        continue
      }

      found.push(...checkDefinition(fs, kind, name, file))
    }
  }

  return found
}


function checkDefinition(
  fs: any, kind: string, name: string, file: string,
): Finding[] {
  const found: Finding[] = []
  const src = String(fs.readFileSync(file, 'utf8'))

  const at = (level: 'error' | 'warn', point: string, note: string): Finding =>
    ({ level, point, kind, name, file, note: file + ': ' + note })

  // 1. The provenance anchor. Its absence costs nothing at add time and
  //    everything afterwards: the copy records no source, so `doctor` and
  //    `package update` cannot find where it came from.
  if (!src.includes(ANCHOR)) {
    found.push(at('error', 'model-anchor-missing',
      'no `' + ANCHOR + '` line — the copy would record no provenance, so ' +
      '`package update` and `doctor` could never locate its source'))
  }

  // 2. The comment dialect. Reported before the parse so the finding names
  //    the LINE rather than aontu's view of where the parse gave up.
  const slashes = slashComments(src)

  for (const s of slashes.slice(0, SAME_FILE_LIMIT)) {
    found.push(at('error', 'model-slash-comment',
      s.line + ': `' + s.text + '` — aontu takes `#` comments only; a `//` ' +
      'or `/* */` line is a parse error in a consumer, which configures the ' +
      'parser strictly even though a bare Aontu() accepts it'))
  }

  if (SAME_FILE_LIMIT < slashes.length) {
    found.push(at('error', 'model-slash-comment',
      'and ' + (slashes.length - SAME_FILE_LIMIT) + ' more slash-comment line(s)'))
  }

  // A slash comment IS the parse failure below, and saying it twice — once
  // with the line, once as aontu's `unexpected character(s): //` — reads as
  // two problems. Everything after it would be reporting on a file the author
  // is about to change anyway.
  if (0 < slashes.length) {
    return found
  }

  // 3. The parse, as a CONSUMER's parser sees it.
  const strict = compileModel(src, file)

  if (0 < strict.errors.length) {
    // Which parser rejected it changes what the author must do, so say. A
    // file that a bare Aontu() accepts and the strict one rejects is almost
    // always the comment dialect above.
    const bare = compileModel(src, file, { strict: false })

    found.push(at('error', 'model-parse',
      strict.errors.join(' | ') +
      (0 === bare.errors.length ?
        '  (it DOES compile under a bare Aontu() — the difference is the ' +
        'comment dialect a consumer configures)' : '')))

    // Nothing below can run on a file that does not compile.
    return found
  }

  // 4. Does it declare the key its FILENAME promises? `model/target/iot-go.aontu`
  //    is copied to that name and included by it, so a file still declaring
  //    `main: kit: target: go:` installs an item the consumer's model never
  //    sees — the exact mistake a package author makes copying a bundled
  //    target as a starting point.
  const declared = strict.model?.main?.[KIT]?.[kind]?.[name]

  if (null == declared || 'object' !== typeof declared) {
    found.push(at('error', 'model-key-missing',
      'declares no `main: kit: ' + kind + ': ' + name + ':` block — the file ' +
      'is installed and included under its own name, so nothing it declares ' +
      'under another name is reachable'))
  }

  // 5. The base schema. A non-defaulted key the file omits (`ext`,
  //    `comment.line`, `module.name`, a feature's `title`) compiles fine
  //    alone and fails the consumer's whole model.
  const unified = compileModel(src, file, { schema: true })

  for (const err of unified.errors.slice(0, SAME_FILE_LIMIT)) {
    found.push(at('error', 'model-schema',
      err + '  (unified with the base schema — this is what a consumer compiles)'))
  }

  if ('target' === kind) {
    found.push(...checkTargetModel(src, name, file, at))
  }

  if ('feature' === kind) {
    found.push(...checkFeatureModel(strict.model, name, at))
  }

  return found
}


type At = (level: 'error' | 'warn', point: string, note: string) => Finding


// The publish-override probe: unify the target model with a project that sets
// the keys a project owns. Concrete-vs-concrete is a conflict in aontu, so a
// package that pins one makes it impossible for the consumer to set it — and
// the consumer's error names the CONSUMER's file.
function checkTargetModel(
  src: string, name: string, file: string, at: At,
): Finding[] {
  const probe = publishOverrideProbe(src, file, name)

  if (0 === probe.errors.length) {
    return []
  }

  return [at('error', 'target-publish-pinned',
    'a project cannot override its publication values: ' +
    probe.errors.join(' | ') +
    '  (the target model sets a key the schema already defaults — leave ' +
    '`publish.version`, `publish.registry.package`, `state` and `active` ' +
    'unset; registry identity is yours, versions and names are the ' +
    "project's)")]
}


// Per-target dependencies belong DIRECTLY under the feature
// (`deps: <target>: {…}`), which is the only path `collectDeps` reads. The
// other spelling — `feature.<f>.target.<t>.deps` — is schema-legal, because
// every target model declares that slot, so nothing errors and the
// dependency simply never reaches the generated manifest.
function checkFeatureModel(model: any, name: string, at: At): Finding[] {
  const targets = model?.main?.[KIT]?.feature?.[name]?.target

  if (null == targets || 'object' !== typeof targets) {
    return []
  }

  const found: Finding[] = []

  for (const tname of Object.keys(targets).sort()) {
    const deps = targets[tname]?.deps

    if (null == deps || 'object' !== typeof deps) {
      continue
    }

    // The SLOT itself is legal and empty; only concrete entries are the
    // mistake. An entry is concrete when it declares anything of its own.
    const named = Object.keys(deps).filter((d: string) =>
      null != deps[d] && 'object' === typeof deps[d] &&
      0 < Object.keys(deps[d]).length)

    if (0 === named.length) {
      continue
    }

    found.push(at('warn', 'feature-deps-misplaced',
      'declares ' + named.join(', ') + ' under `feature: ' + name +
      ': target: ' + tname + ': deps:` — nothing reads that path. ' +
      'Per-target dependencies go directly under the feature: `deps: ' +
      tname + ': { ' + named[0] + ': {…} }`'))
  }

  return found
}


// The template trees: does a feature's declared coverage exist, and is
// anything in a target's tree feature-shaped but invisible to the trim?
function checkFeatureSource(
  fs: any, sdk: string, manifest?: Manifest,
): Finding[] {
  const found: Finding[] = []
  const file = Path.join(sdk, '..', MANIFEST)

  // The catalogue a CONSUMER will have: this generator's own features, plus
  // the package's. A package shipping a copy of a bundled target ships source
  // for features it does not provide, and those are not strays.
  const known = new Set([
    ...availableFeatures(fs, scaffoldFolder()),
    ...availableFeatures(fs, sdk),
  ])

  // Declared coverage. `targetsSupported: { <feature>: [<target>, …] }` is
  // the author's statement about which targets a feature ships source for, so
  // it is checkable — unlike its absence, which means nothing either way.
  const supported = manifest?.targetsSupported ?? {}

  for (const fname of Object.keys(supported).sort()) {
    for (const tname of (supported[fname] ?? [])) {
      const tm = Path.join(sdk, 'tm', tname)

      if (0 === findFeatureSources(fs, tm, [fname.toLowerCase()]).length) {
        found.push({
          level: 'warn', point: 'feature-source-undelivered', file,
          kind: 'feature', name: fname,
          note: file + ': `targetsSupported.' + fname + '` claims ' + tname +
            ', but tm/' + tname + ' holds no source this generator can find ' +
            'for it — see the naming conventions in ' +
            'docs/how-to/add-a-feature.md'
        })
      }
    }
  }

  // Strays: feature-shaped entries in a provided TARGET's tree whose name is
  // in no catalogue. They are copied into every project regardless of what
  // its model selects, because trim only drops what it can recognise.
  for (const tname of (manifest?.provides?.target ?? [])) {
    const tm = Path.join(sdk, 'tm', tname)

    const strays = findFeatureEntries(fs, tm, known)
      .filter((e) => e.shaped && !known.has(e.name) && BASE_FEATURE !== e.name)

    if (0 === strays.length) {
      continue
    }

    found.push({
      level: 'warn', point: 'feature-source-unrecognised', file,
      kind: 'target', name: tname,
      note: 'tm/' + tname + ': ' + strays.map((e) => e.path).join(', ') +
        ' — named like feature source, but no `model/feature/<name>.aontu` ' +
        'declares ' + strays.map((e) => e.name).join(', ') +
        ', so the trim cannot recognise them and every project gets them ' +
        'whatever its model selects'
    })
  }

  return found
}


export type {
  CheckReport,
}

export {
  cmd_package_check,
  checkPackage,
}
