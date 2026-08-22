
import Path from 'node:path'

import {
  Content,
  cmp,
} from 'jostraca'


import type {
  ActionContext,
} from '../types'


const indexEntry = (name: string) => `@"${name}.aon"`


// An index line that is an ACTIVE include, and the name it includes — or
// undefined for a blank line, a comment, or anything else.
//
// Parsed rather than compared as a string, because both spellings around an
// include are legal aontu and mean opposite things:
//
//   @"go.aon"                 -> active, name 'go'
//   @"go.aon"  # pinned       -> active, name 'go'  (trailing comment)
//     @"go.aon"               -> active, name 'go'  (indented)
//   # @"go.aon"               -> NOT active
//
// A substring test (what this used to be) reads the commented-out form as
// present, so `target add go` on a project that had switched the target off
// by hand appended nothing and reported success while the target stayed
// absent from the model. A whole-line equality test fixes that but then
// misses the trailing-comment form, and appends a SECOND active include.
const INDEX_ENTRY_RE = /^\s*@"([^"]+)\.aon"\s*(?:#.*)?$/

function indexEntryName(line: string): string | undefined {
  const m = line.match(INDEX_ENTRY_RE)
  return null == m ? undefined : m[1]
}


// Is this name already included by the index?
function hasIndexEntry(content: string, name: string): boolean {
  return content.split('\n')
    .some((line: string) => indexEntryName(line) === name)
}


// Append `@"<name>.aon"` import lines for each name not already present in
// the index content. Checking against the accumulating result (not the
// original) means duplicate names in the same call are added at most once.
function appendIndexEntries(content: string, names: string[]): string {
  let out = content

  for (const n of names) {
    if (!hasIndexEntry(out, n)) {
      out += '\n' + indexEntry(n)
    }
  }

  return out
}


// Drop the `@"<name>.aon"` line for each name — the inverse of
// appendIndexEntries, matching line-exact for the same reasons.
//
// Nothing calls this yet: a `remove` action is the fast-follow this exists
// for (see docs/design/sdkgen-packages.md), and it is written here beside its
// inverse so the two cannot drift on how an entry is recognised.
function removeIndexEntries(content: string, names: string[]): string {
  const drop = new Set(names)

  return content
    .split('\n')
    .filter((line: string) => {
      const name = indexEntryName(line)
      return undefined === name || !drop.has(name)
    })
    .join('\n')
}


const UpdateIndex = cmp(function UpdateIndex(props: any) {
  Content(appendIndexEntries(props.content, props.names))
})


// Names given to an `add` action: every positional after the subcommand is
// a name, each possibly comma-separated — `target add ts,py,go` and
// `target add ts py go` are equivalent (space-separated extras used to be
// silently dropped).
function parseAddNames(args: any[]): string[] {
  return args.slice(2)
    .flatMap((a: any) => 'string' === typeof a ? a.split(',') : a)
    .filter((n: any) => null != n && '' !== n)
}


// The current index file for each kind, which `UpdateIndex` appends to.
//
// `seed` IS THE UPGRADE PATH. A project scaffolded before a kind existed has
// no `model/<kind>/<kind>-index.aon` — every project alive today is in
// exactly that position for `docs` — and reading it unguarded made the FIRST
// `docs add` in any existing project fail on ENOENT before it wrote anything.
//
// Seeded per call rather than defaulted for every kind: a missing
// `target-index.aon` in a scaffolded project is a broken project, and
// quietly recreating it would hide that. A kind the project has never used is
// a different thing, and only its own action knows which case it is in.
function loadContent(
  actx: ActionContext, which: string | string[], seed?: Record<string, string>,
) {
  which = Array.isArray(which) ? which : [which]

  const content: any = {}

  const fs = actx.fs()
  const modelfolder = Path.dirname(actx.url)

  which.map((w: string) => {
    const indexfile = Path.join(modelfolder, w, w + '-index.aon')

    content[`${w}_index`] = (null != seed?.[w] && !fs.existsSync(indexfile)) ?
      seed[w] : fs.readFileSync(indexfile, 'utf8')
  })

  return content
}



// ENSURE THE PROJECT'S OWN MODEL INCLUDES A KIND'S INDEX.
//
// `model/sdk.aontu` is written once, by create-sdkgen, and includes the
// indexes of the kinds that existed then. So a project scaffolded before a
// kind existed — which is every project alive today, for `docs` — never
// includes its index, and the item's model file is an orphan: it is on disk,
// `<kind>-index.aon` includes it, and NOTHING includes that. `main.kit.docs`
// is then absent from the compiled model, so `package list`, `package update`
// and `doctor` cannot see the item at all.
//
// Appending one include line is additive and idempotent, and it is the only
// way an existing project can adopt a new kind without hand-editing. The
// entry is parsed, not substring-matched, for the reason `hasIndexEntry`
// documents: a commented-out include means the project switched it OFF, and
// re-adding it would override that.
function ensureModelInclude(actx: ActionContext, kind: string): boolean {
  const fs = actx.fs()
  const url = actx.url

  if (!fs.existsSync(url)) {
    // Said out loud rather than skipped silently: without the include the
    // item is invisible to the next model compile, and a quiet no-op here
    // would look exactly like success.
    actx.log.warn({
      point: 'model-include-absent', kind, file: url,
      note: url + ' not found, so ' + indexEntry(kind + '/' + kind + '-index') +
        ' could not be added — add it by hand, or nothing will see any ' +
        kind + ' item'
    })
    return false
  }

  const name = kind + '/' + kind + '-index'
  const content = String(fs.readFileSync(url, 'utf8'))

  if (hasIndexEntry(content, name)) {
    return false
  }

  if (actx.opts?.dryrun) {
    actx.log.info({
      point: 'model-include-dryrun', kind, file: url, entry: indexEntry(name),
      note: '** DRY RUN ** would add ' + indexEntry(name) + ' to ' + url
    })
    return false
  }

  fs.writeFileSync(url,
    content + (content.endsWith('\n') ? '' : '\n') +
    indexEntry(name) + '\n')

  actx.log.info({
    point: 'model-include-added', kind, file: url, entry: indexEntry(name),
    note: url + ': added ' + indexEntry(name) +
      ' — without it the project model never sees any ' + kind + ' item'
  })

  return true
}


export {
  UpdateIndex,
  ensureModelInclude,
  appendIndexEntries,
  removeIndexEntries,
  hasIndexEntry,
  parseAddNames,
  loadContent
}
