import { kindCollection } from '../helpers/kindCollection'

import { unknownTags, TAGS } from '../helpers/applicability'
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

import type { CompileResult } from '../helpers/modelcheck'

import {
  definitionNames, definitionPathAny, isLegacyPath, migrateIncludes,
} from '../helpers/definition'

import {
  ANCHOR,
  ANCHOR_RE,
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


const SAME_FILE_LIMIT = 5


const UNRESOLVED_INCLUDE = ['multisource_not_found', 'include_extension']

function unresolvedIncludeOnly(result: CompileResult): boolean {
  return 0 < result.why.length &&
    result.why.every((w: string) => UNRESOLVED_INCLUDE.includes(w))
}


function claims(map: any, key: string): string[] {
  const value = map?.[key]

  return Array.isArray(value) ?
    value.filter((n: any) => 'string' === typeof n && '' !== n) : []
}


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


function checkItems(fs: any, sdk: string, manifest?: Manifest): Finding[] {
  const found: Finding[] = []

  for (const kind of Object.keys(KINDS).sort()) {
    const claimed = claims(manifest?.provides, kind)
    const ondisk = definitionNames(fs, sdk, kind)

    const names = Array.from(new Set([...claimed, ...ondisk])).sort()

    for (const name of names) {
      const file = definitionPathAny(fs, sdk, kind, name)

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
  const raw = String(fs.readFileSync(file, 'utf8'))

  // Checked as a project receives it: `add` renames `.aon` includes.
  const src = migrateIncludes(raw)
  const legacyFile = isLegacyPath(file)
  const legacy = legacyFile || src !== raw

  const at = (level: 'error' | 'warn', point: string, note: string): Finding =>
    ({ level, point, kind, name, file, note: file + ': ' + note })

  if (legacy) {
    const where = [
      ...(legacyFile ? ['its file name'] : []),
      ...(src !== raw ? ['its includes'] : []),
    ].join(' and ')

    found.push(at('warn', 'model-legacy-aon',
      'uses the retired `.aon` extension in ' + where + ' — `add` installs ' +
      'it as `' + name + '.aontu` with every include renamed to `.aontu`, ' +
      'the only extension aontu reads; rename them in the package so it ' +
      'holds what a project is given'))
  }

  // 1. The provenance anchor. Its absence costs nothing at add time and
  //    everything afterwards: the copy records no source, so `doctor` and
  //    `package update` cannot find where it came from.
  if (!ANCHOR_RE.test(src)) {
    found.push(at('error', 'model-anchor-missing',
      'no `' + ANCHOR + '` line — the copy would record no provenance, so ' +
      '`package update` and `doctor` could never locate its source'))
  }

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

  if (0 < slashes.length) {
    return found
  }

  const strict = compileModel(src, file)

  if (legacy && unresolvedIncludeOnly(strict)) {
    found.push(at('warn', 'model-legacy-unresolved',
      strict.errors.join(' | ') + '  (an include renamed to `.aontu` ' +
      'resolves only once what it names ships as `.aontu`; until then a ' +
      'project that installs this cannot compile it)'))

    return found
  }

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

    return found
  }

  const declared = kindCollection(strict.model, kind)?.[name]

  if (null == declared || 'object' !== typeof declared) {
    found.push(at('error', 'model-key-missing',
      'declares no `main: kit: ' + (kind === 'edition' ? 'doc: edition' : kind) + ': ' + name + ':` block — the file ' +
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

  const tagkey = 'feature' === kind ? 'needs' : 'provides'
  const unknown = null == declared ? [] : unknownTags((declared as any)[tagkey])

  if (0 < unknown.length) {
    found.push(at('error', 'model-tag-unknown',
      'declares unknown applicability tag(s) in `' + tagkey + '`: ' +
      unknown.join(', ') + ' — the vocabulary is CLOSED (' + TAGS.join(', ') +
      '), so an unrecognised tag makes this ' + kind +
      ' match nothing rather than failing loudly'))
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
  const bundled = availableFeatures(fs, scaffoldFolder())

  const known = new Set([...bundled, ...availableFeatures(fs, sdk)])

  // Declared coverage. `targetsSupported: { <feature>: [<target>, …] }` is
  // the author's statement about which targets a feature ships source for, so
  // it is checkable — unlike its absence, which means nothing either way.
  const supported: any = manifest?.targetsSupported

  for (const fname of Object.keys(supported ?? {}).sort()) {
    for (const tname of claims(supported, fname)) {
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

  if (0 === bundled.length) {
    return found
  }

  const targets = new Set([
    ...claims(manifest?.provides, 'target'),
    ...definitionNames(fs, sdk, 'target'),
  ])

  for (const tname of Array.from(targets).sort()) {
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
