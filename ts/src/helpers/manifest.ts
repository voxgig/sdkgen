// THE PACKAGE MANIFEST: `sdkgen-package.json`, beside the package's `.sdk`.
//
// See docs/design/sdkgen-packages.md §2.
//
//   <package-root>/
//   ├── sdkgen-package.json      <- this
//   └── .sdk/                    <- shaped exactly like ts/project/.sdk
//
// WHY JSON RATHER THAN AONTU
//
// Consumer models compile under `@voxgig/model`'s strictly-configured parser,
// which accepts `#` comments only — a `//` line is a parse error, and seven
// shipped targets once broke on exactly that (ts/test/model-compile.test.ts
// exists because of it). The manifest is read by the CLI and never unified
// into the model, so JSON keeps it outside that trap entirely.
//
// WHAT IT IS FOR
//
// A package's CLAIM about what it provides, so that:
//
//   - `package add <pkg>` knows what to install without guessing from
//     directory listings;
//   - a typo'd ref fails naming what the package actually provides, rather
//     than resolving to a folder that exists and failing later on a missing
//     file;
//   - an item records WHICH PACKAGE supplied it (`package:` provenance), so a
//     project can be resynced against a newer version of that package.
//
// A claim is worth nothing unless it is checked, so `validateManifest`
// compares it against the trees actually on disk, in both directions: a
// manifest that lies is an error, on-disk extras are a warning.
//
// THE MANIFEST IS OPTIONAL FOR A DIRECT REF. `target add ../pkg/iot-go`
// against a bare `.sdk`-shaped folder keeps working exactly as it does today
// — that is what every existing consumer fixture is — and simply records no
// `package` provenance. Requiring one is `package add`'s business.

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

  // DECLARATIVE ONLY, so far. Nothing reads this range yet: the engine gate
  // belongs with `package add` (design §9), which is the next phase, and
  // there is no semver implementation here to compare with — this package has
  // no runtime dependencies. Until then a package declaring an incompatible
  // range installs anyway. Stated here rather than left to be discovered,
  // because a field that looks enforced and is not is worse than an absent
  // one.
  engines?: { sdkgen?: string }

  // Keyed BY KIND, so a new kind (docs, …) needs no schema change.
  provides: Record<string, string[]>

  // Optional: which targets a feature ships source for, so a missing overlay
  // is reported as out-of-declared-coverage rather than broken.
  targetsSupported?: Record<string, string[]>

  // Optional: the author's declared parity tier per target, in
  // ts/test/parity.test.ts's vocabulary.
  parity?: Record<string, string>
}


// What `readManifest` found. THREE outcomes, deliberately distinct: a
// manifest, no manifest, or a manifest that could not be read. Collapsing the
// last two into "no manifest" is what would let a typo in a package's own
// JSON silently downgrade `package add` into a no-op.
type ManifestRead = {
  // Where it was looked for, always — the value an error message needs.
  file: string

  // Present only when one was found AND parsed.
  manifest?: Manifest

  // Present only when one was found and could NOT be parsed.
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

      // A NAME, not a path. `missingPaths` joins these onto the package root,
      // so `../../outside` would send every existence check out of the
      // package entirely and let a manifest validate clean against unrelated
      // files. `~` is excluded for a different reason: it is the alias
      // separator, so a name containing one could never be resolved back to
      // this item.
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


// What may name a target, feature, or any other item.
//
// Deliberately narrow: these become directory names, aontu model keys,
// generated config keys (`options.feature.<name>`) and component filename
// suffixes, so the intersection of what all of those accept is the real
// constraint. The shipped names — `go-cli`, `py-data`, `seneca-provider`,
// `clienttrack` — all fit.
const ITEM_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/


// Does the package's disk match its claim?
//
// BOTH DIRECTIONS, because they fail differently and neither implies the
// other:
//
//   claim without disk  -> ERROR. `package add` would try to install it and
//                          break partway through, having already written the
//                          items listed before it.
//   disk without claim  -> WARN. Everything works; the author has shipped
//                          something nobody can discover, which is nearly
//                          always a forgotten manifest edit.
//
// `kindRequires` is supplied by the caller rather than imported, because the
// kind registry lives in `action/` and this is a helper — the dependency has
// to point that way, not this way.
function validateManifest(
  fs: any,
  sdkfolder: string,
  manifest: Manifest,
  kinds: Record<string, { requires?: string[] }>,
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

    // ONE ORACLE FOR BOTH DIRECTIONS. The unclaimed-extras loop below reads
    // the directory listing; if this loop asked the filesystem instead
    // (`existsSync`/`statSync`), the two would disagree on a case-insensitive
    // filesystem — APFS and NTFS by default, which is most package authors'
    // machines. A manifest claiming `IoTGo` beside a `model/target/iotgo.aontu`
    // then validated CLEAN for the author and failed for every Linux consumer,
    // which is precisely the "validated package that cannot install" this
    // function exists to prevent. It also makes the duplicate check above
    // meaningful: `['retry','Retry']` are two names to a Set and one file to
    // the filesystem.
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

  // The other direction. Only for kinds the manifest MENTIONS plus the ones
  // this generator knows — a directory named after a kind nobody registered
  // is already reported above if claimed, and is not this check's business if
  // not.
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


// Every path an item of this kind needs, that is not there AS THE RIGHT KIND
// OF THING.
//
// The definition file is implied for every kind; `requires` adds whatever
// else the kind needs (a target's component and template trees).
//
// FILE vs DIRECTORY is checked, not merely existence. A regular file at
// `src/cmp/<t>` satisfies `existsSync` and satisfies nothing else: `target
// add` walks both of those paths as trees, so a package validated on
// existence alone could still be incapable of installing a usable target —
// which is the one thing validation is supposed to rule out.
//
// Returned as package-relative strings, because that is what an error message
// should say: the absolute path is this machine's business, not the author's.
function missingPaths(
  fs: any,
  sdkfolder: string,
  kind: string,
  name: string,
  def: { requires?: string[] },
  defined: Set<string>,
): string[] {
  const missing: string[] = []

  // The definition, by EXACT NAME from the directory listing — see the note
  // at the call site about the two directions needing one oracle.
  if (!defined.has(name)) {
    missing.push('model/' + kind + '/' + name + '.aontu')
  }

  for (const req of def.requires ?? []) {
    const rel = req.split('{name}').join(name)
    const got = entryKind(fs, Path.join(sdkfolder, ...rel.split('/')))

    if ('dir' !== got) {
      missing.push(rel +
        ('none' === got ? '' : ' (a file where a directory is required)'))
    }
  }

  return missing
}


// What is at a path: a file, a directory, or nothing. `statSync` FOLLOWS
// symlinks, deliberately — a package may legitimately symlink a shared tree,
// and what matters is what `target add` will find when it walks it.
function entryKind(fs: any, path: string): 'file' | 'dir' | 'none' {
  try {
    const stat = fs.statSync(path)
    return stat.isDirectory() ? 'dir' : 'file'
  }
  catch (err: any) {
    return 'none'
  }
}


export type {
  Manifest,
  ManifestRead,
  Finding,
}

export {
  MANIFEST,
  SCHEMA,
  ITEM_NAME_RE,
  manifestPath,
  readManifest,
  validateManifest,
  checkShape,
}
