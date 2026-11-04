
import { names } from 'jostraca'
import { cmp } from '../helpers/component'

import { requirePath } from '../utility'

import { ensureStdrep } from '../helpers/stdrep'
import { userAgent } from '../helpers/useragent'

import {
  KIT
} from '../types'


const Main = cmp(function Main(props: any) {
  const { target, ctx$ } = props
  const { model, log } = ctx$

  // Generator-owned placeholders (PROJECTENV) that the project's frozen
  // Root.ts cannot know about.
  const stdrep = ensureStdrep(ctx$)

  // Per target, as `plain` names the target's own release; each Main_<lang>
  // copies its templates with this map before the next target sets it.
  stdrep.PROJECTUSERAGENT = userAgent(model, target.name)

  const Main_sdk = requirePath(ctx$, `cmp/${target.name}/Main_${target.name}`)

  Main_sdk['Main']({ model, target, stdrep })

  log.info({ point: 'generate-main', target, note: 'target:' + target.name })
})


export {
  Main
}
