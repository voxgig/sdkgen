
import Path from 'node:path'

import { definitionNames } from './definition'


const MANIFEST = 'sdkgen-package.json'

// The manifest schema version this generator understands. Bumped only for a
// BREAKING change to the manifest's own shape; new optional fields do not
// need it. Read from `sdkgen.package` so the gate is the very first thing in
// the file, before anything version-specific is interpreted.
const SCHEMA = 1


type Manifest = {
  sdkgen: { package: number }
  name: string
  version?: string

  engines?: { sdkgen?: string }

  provides: Record<string, string[]>

  // Optional: which targets a feature ships source for, so a missing overlay
  // is reported as out-of-declared-coverage rather than broken.
  targetsSupported?: Record<string, string[]>

  parity?: Record<string, string>
}


const PARITY = ['FULL', 'MIRRORED', 'UNCOVERED', 'CONSUMER']


type ManifestRead = {
  file: string

  manifest?: Manifest

  err?: string
}


type Finding = {
  level: 'error' | 'warn' | 'info'
  point: string
  note: string
  kind?: string
  name?: string
  file?: string
}


// The manifest path for a `.sdk` folder: its SIBLING, not its child.
//
// The package root is the parent of `.sdk` — which is what `resolveSource`
// already assumes when it probes `<ref-dir>/.sdk`, so the manifest sits where
// the ref already pointed.
function manifestPath(sdkfolder: string): string {
  return Path.join(sdkfolder, '..', MANIFEST)
}


function readManifest(fs: any, sdkfolder: string): ManifestRead {
  const file = manifestPath(sdkfolder)

  if (!fs.existsSync(file)) {
    return { file }
  }

  let manifest: any
  try {
    manifest = JSON.parse(String(fs.readFileSync(file, 'utf8')))
  }
  catch (err: any) {
    return { file, err: err.message }
  }

  // A JSON scalar or array parses fine and then fails much later, on a
  // property access that reads `undefined`. Reject it here, where the file
  // that caused it is still in hand.
  if (null == manifest || 'object' !== typeof manifest ||
    Array.isArray(manifest)) {
    return { file, err: 'not a JSON object' }
  }

  return { file, manifest }
}


// Is the manifest itself well-formed? Checked before anything reads its
// contents, so a malformed file produces one clear finding rather than a
// cascade of consequences.
function checkShape(manifest: Manifest, file: string): Finding[] {
  const found: Finding[] = []

  const version = manifest?.sdkgen?.package

  if (null == version) {
    found.push({
      level: 'error', point: 'manifest-unversioned', file,
      note: file + ': no `sdkgen.package` schema version — this is the gate ' +
        'that says the file is an sdkgen package manifest at all'
    })
  }
  else if (!Number.isInteger(version) || version < 1) {
    // A NON-NUMBER passes `version > SCHEMA` silently — `'banana' > 1` and
    // `({}) > 1` are both false — so the gate that decides whether this
    // generator may interpret the rest of the file would have been skipped by
    // anything that is not a number at all. The version is the one field that
    // must be checked before anything version-specific is read.
    found.push({
      level: 'error', point: 'manifest-schema-invalid', file,
      note: file + ': `sdkgen.package` must be a positive integer schema ' +
        'version, not ' + JSON.stringify(version)
    })
  }
  else if (version > SCHEMA) {
    // FORWARD, not backward: a manifest written for a later schema may use
    // fields this generator would misread. Say both numbers — "too new" is
    // actionable (upgrade sdkgen), "invalid" is not.
    found.push({
      level: 'error', point: 'manifest-schema-too-new', file,
      note: file + ': manifest schema version ' + version +
        ' is newer than this generator understands (' + SCHEMA +
        ') — upgrade @voxgig/sdkgen'
    })
  }

  if ('string' !== typeof manifest?.name || '' === manifest.name) {
    found.push({
      level: 'error', point: 'manifest-unnamed', file,
      note: file + ': no `name` — the name is what an item records as its ' +
        '`package` provenance and what `package update` is given'
    })
  }

  const provides = manifest?.provides

  if (null == provides || 'object' !== typeof provides ||
    Array.isArray(provides)) {
    found.push({
      level: 'error', point: 'manifest-provides-missing', file,
      note: file + ': no `provides` map — a package that provides nothing ' +
        'has nothing to add (use `{}` to say so deliberately)'
    })
  }
  else {
    for (const [kind, names] of Object.entries(provides)) {
      if (!Array.isArray(names) ||
        names.some((n: any) => 'string' !== typeof n || '' === n)) {
        found.push({
          level: 'error', point: 'manifest-provides-malformed', file, kind,
          note: file + ': `provides.' + kind +
            '` is not a list of names'
        })
        continue
      }

      for (const name of names as string[]) {
        if (!ITEM_NAME_RE.test(name)) {
          found.push({
            level: 'error', point: 'manifest-item-name-invalid', file, kind,
            name,
            note: file + ': `provides.' + kind + '` lists ' +
              JSON.stringify(name) + ' — an item name must match ' +
              ITEM_NAME_RE.source + ' (a name, not a path)'
          })
        }
      }

      const seen = new Set<string>()
      for (const name of names as string[]) {
        if (seen.has(name)) {
          found.push({
            level: 'error', point: 'manifest-item-duplicated', file, kind,
            name,
            note: file + ': `provides.' + kind + '` lists ' +
              JSON.stringify(name) + ' more than once'
          })
        }
        seen.add(name)
      }
    }
  }

  return found
}


const ITEM_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/


function validateManifest(
  fs: any,
  sdkfolder: string,
  manifest: Manifest,
  kinds: Record<string, { trees?: { path: string, required: boolean }[] }>,
): Finding[] {
  const file = manifestPath(sdkfolder)

  const shape = checkShape(manifest, file)

  // A malformed manifest cannot be compared against anything — the checks
  // below would read `undefined` and invent findings about it.
  if (0 < shape.length) {
    return shape
  }

  const found: Finding[] = []
  const provides = manifest.provides

  for (const [kind, names] of Object.entries(provides)) {
    const def = kinds[kind]

    if (null == def) {
      found.push({
        level: 'error', point: 'manifest-unknown-kind', file, kind,
        note: file + ': `provides.' + kind + '` — unknown kind; this ' +
          'generator knows: ' + Object.keys(kinds).sort().join(', ')
      })
      continue
    }

    const defined = new Set(definitionNames(fs, sdkfolder, kind))

    for (const name of names) {
      for (const missing of
        missingPaths(fs, sdkfolder, kind, name, def, defined)) {
        found.push({
          level: 'error', point: 'manifest-item-missing', file, kind, name,
          note: file + ': claims ' + kind + ' `' + name +
            '` but ' + missing + ' is not in the package'
        })
      }
    }
  }

  // The parity declaration, checked in both directions like everything else
  // here: the VALUE against the closed vocabulary, and the KEY against what
  // the package actually provides. A tier declared for a target the package
  // does not ship is a leftover from a rename — harmless in itself, and
  // exactly the kind of leftover that later reads as coverage.
  const targets = new Set(provides.target ?? [])
  const graded = new Set(Object.keys(manifest.parity ?? {}))

  for (const name of (0 === graded.size ? [] : [...targets].sort())) {
    if (!graded.has(name as string)) {
      found.push({
        level: 'warn', point: 'manifest-parity-missing', file, name: name as string,
        note: file + ': target `' + name + '` has no `parity` entry — its ' +
          'coverage is undeclared, which reads the same as having none. One ' +
          'of: ' + PARITY.join(', ')
      })
    }
  }

  for (const [name, tier] of Object.entries(manifest.parity ?? {})) {
    if (!PARITY.includes(tier)) {
      found.push({
        level: 'error', point: 'manifest-parity-unknown', file, name,
        note: file + ': `parity.' + name + '` is "' + tier +
          '" — must be one of: ' + PARITY.join(', ')
      })
    }

    if (!targets.has(name)) {
      found.push({
        level: 'warn', point: 'manifest-parity-unprovided', file, name,
        note: file + ': `parity.' + name + '` names a target this package ' +
          'does not provide — nothing declares its coverage'
      })
    }
  }

  for (const kind of Object.keys(kinds)) {
    const claimed = new Set(provides[kind] ?? [])

    for (const name of definitionNames(fs, sdkfolder, kind)) {
      if (!claimed.has(name)) {
        found.push({
          level: 'warn', point: 'manifest-item-unclaimed', file, kind, name,
          note: file + ': model/' + kind + '/' + name +
            '.aontu is in the package but not listed in `provides.' + kind +
            '` — nothing will install it'
        })
      }
    }
  }

  return found
}


function missingPaths(
  fs: any,
  sdkfolder: string,
  kind: string,
  name: string,
  def: { trees?: { path: string, required: boolean }[] },
  defined: Set<string>,
): string[] {
  const missing: string[] = []

  if (!defined.has(name)) {
    missing.push('model/' + kind + '/' + name + '.aontu')
  }

  for (const tree of (def.trees ?? []).filter((t) => t.required)) {
    const rel = tree.path.split('{name}').join(name)
    const got = entryKind(fs, Path.join(sdkfolder, ...rel.split('/')))

    if ('dir' !== got) {
      missing.push(rel +
        ('none' === got ? '' : ' (a file where a directory is required)'))
    }
  }

  return missing
}


function entryKind(fs: any, path: string): 'file' | 'dir' | 'none' {
  try {
    const stat = fs.statSync(path)
    return stat.isDirectory() ? 'dir' : 'file'
  }
  catch (err: any) {
    return 'none'
  }
}


type PackageProbe = {
  ref: string
  root: string
  sdk: string
  read: ManifestRead
}


function probePackage(
  fs: any, project: string, ref: string,
): { found?: PackageProbe, search: string[] } {
  const search: string[] = []

  const candidates = Path.isAbsolute(ref) ? [ref] : [
    Path.join(project, 'node_modules', ref),
    Path.join(project, ref),
  ]

  for (const root of candidates) {
    const sdk = Path.normalize(Path.join(root, '.sdk'))
    search.push(sdk)

    if (!fs.existsSync(sdk)) {
      continue
    }

    return { found: { ref, root, sdk, read: readManifest(fs, sdk) }, search }
  }

  return { search }
}


export type {
  Manifest,
  ManifestRead,
  PackageProbe,
  Finding,
}

export {
  MANIFEST,
  SCHEMA,
  PARITY,
  ITEM_NAME_RE,
  manifestPath,
  probePackage,
  readManifest,
  validateManifest,
  checkShape,
}
