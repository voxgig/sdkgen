
import Path from 'node:path'

import {
  Content,
  cmp,
} from 'jostraca'


import type {
  ActionContext,
} from '../types'


// Append `@"<name>.aontu"` import lines for each name not already present in
// the index content. Checking against the accumulating result (not the
// original) means duplicate names in the same call are added at most once.
function appendIndexEntries(content: string, names: string[]): string {
  let out = content

  for (const n of names) {
    const entry = `@"${n}.aontu"`
    if (!out.includes(entry)) {
      out += '\n' + entry
    }
  }

  return out
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
  parseAddNames,
  loadContent
}
