
import Path from 'node:path'

import {
  Content,
  cmp,
} from 'jostraca'


import type {
  ActionContext,
} from '../types'


// Append `@"<name>.jsonic"` import lines for each name not already present in
// the index content. Checking against the accumulating result (not the
// original) means duplicate names in the same call are added at most once.
function appendIndexEntries(content: string, names: string[]): string {
  let out = content

  for (const n of names) {
    const entry = `@"${n}.jsonic"`
    if (!out.includes(entry)) {
      out += '\n' + entry
    }
  }

  return out
}


const UpdateIndex = cmp(function UpdateIndex(props: any) {
  Content(appendIndexEntries(props.content, props.names))
})


function loadContent(actx: ActionContext, which: string | string[]) {
  which = Array.isArray(which) ? which : [which]

  const content: any = {}

  const fs = actx.fs()
  const modelfolder = Path.dirname(actx.url)

  which.map((w: string) => {
    const indexfile = Path.join(modelfolder, w, w + '-index.jsonic')
    const indexcontent = fs.readFileSync(indexfile, 'utf8')
    content[`${w}_index`] = indexcontent
  })

  return content
}



export {
  UpdateIndex,
  appendIndexEntries,
  loadContent
}
