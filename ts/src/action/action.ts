
import Path from 'node:path'

import {
  Content,
  cmp,
} from 'jostraca'


import type {
  ActionContext,
} from '../types'


const indexEntry = (name: string) => `@"${name}.aontu"`


// Is this name already included by the index?
//
// LINE-EXACT, not substring. A substring test reads a COMMENTED-OUT entry as
// present — `# @"go.aontu"` contains `@"go.aontu"` — so `target add go` on a
// project that had commented the include out silently appended nothing, and
// the target stayed absent from the model with no error anywhere. Aontu's
// comment marker is `#`, and commenting an include out is the obvious way to
// switch a target off by hand, so this is a state projects really reach.
//
// The line is trimmed first: the indexes are written with no indentation, but
// a hand-edited one may carry some, and indentation does not change what
// aontu includes.
function hasIndexEntry(content: string, name: string): boolean {
  const entry = indexEntry(name)
  return content.split('\n').some((line: string) => line.trim() === entry)
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
  const drop = new Set(names.map(indexEntry))

  return content
    .split('\n')
    .filter((line: string) => !drop.has(line.trim()))
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
