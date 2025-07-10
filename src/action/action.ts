
import Path from 'node:path'

import {
  Content,
  cmp,
} from 'jostraca'


import type {
  ActionContext,
} from '../types'


const UpdateIndex = cmp(function UpdateIndex(props: any) {
  const names = props.names

  let oldcontent = props.content
  let newcontent = oldcontent

  names.map((n: string) => {
    if (!oldcontent.includes(`@"${n}.jsonic"`)) {
      newcontent += `\n@"${n}.jsonic"`
    }
  })

  Content(newcontent)
})


function loadContent(actx: ActionContext, which: string | string[]) {
  which = Array.isArray(which) ? which : [which]

  const content: any = {}

  const fs = actx.fs()
  const tree = actx.tree
  const modelfolder = Path.dirname(tree.url)

  which.map((w: string) => {
    const indexfile = Path.join(modelfolder, w, w + '-index.jsonic')
    const indexcontent = fs.readFileSync(indexfile, 'utf8')
    content[`${w}_index`] = indexcontent
  })

  return content
}



export {
  UpdateIndex,
  loadContent
}
