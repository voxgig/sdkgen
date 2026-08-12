
import { cmp, names } from 'jostraca'

import { requirePath } from '../utility'

import { ensureStdrep } from '../helpers/stdrep'

import {
  KIT
} from '../types'


const Main = cmp(function Main(props: any) {
  const { target, ctx$ } = props
  const { model, log } = ctx$

  // Generator-owned placeholders (PROJECTENV) that the project's frozen
  // Root.ts cannot know about.
  const stdrep = ensureStdrep(ctx$)

  const Main_sdk = requirePath(ctx$, `cmp/${target.name}/Main_${target.name}`)

  Main_sdk['Main']({ model, target, stdrep })

  log.info({ point: 'generate-main', target, note: 'target:' + target.name })
})


export {
  Main
}
