
import Path from 'node:path'

import {
  Content,
  cmp,
} from 'jostraca'


import type {
  ActionContext,
} from '../types'


const indexEntry = (name: string) => `@"${name}.aontu"`


// An index line that is an ACTIVE include, and the name it includes — or
// undefined for a blank line, a comment, or anything else.
//
// Parsed rather than compared as a string, because both spellings around an
// include are legal aontu and mean opposite things:
//
//   @"go.aontu"                 -> active, name 'go'
//   @"go.aontu"  # pinned       -> active, name 'go'  (trailing comment)
//     @"go.aontu"               -> active, name 'go'  (indented)
//   # @"go.aontu"               -> NOT active
//
// A substring test (what this used to be) reads the commented-out form as
// present, so `target add go` on a project that had switched the target off
// by hand appended nothing and reported success while the target stayed
// absent from the model. A whole-line equality test fixes that but then
// misses the trailing-comment form, and appends a SECOND active include.
const INDEX_ENTRY_RE = /^\s*@"([^"]+)\.aontu"\s*(?:#.*)?$/

function indexEntryName(line: string): string | undefined {
  const m = line.match(INDEX_ENTRY_RE)
  return null == m ? undefined : m[1]
}


// Is this name already included by the index?
function hasIndexEntry(content: string, name: string): boolean {
  return content.split('\n')
    .some((line: string) => indexEntryName(line) === name)
}


// Append `@"<name>.aontu"` import lines for each name not already present in
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


// Drop the `@"<name>.aontu"` line for each name — the inverse of
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


function loadContent(actx: ActionContext, which: string | string[]) {
  which = Array.isArray(which) ? which : [which]

  const content: any = {}

  const fs = actx.fs()
  const modelfolder = Path.dirname(actx.url)

  which.map((w: string) => {
    const indexfile = Path.join(modelfolder, w, w + '-index.aontu')
    const indexcontent = fs.readFileSync(indexfile, 'utf8')
    content[`${w}_index`] = indexcontent
  })

  return content
}



export {
  UpdateIndex,
  appendIndexEntries,
  removeIndexEntries,
  hasIndexEntry,
  parseAddNames,
  loadContent
}
