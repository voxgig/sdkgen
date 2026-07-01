
import {
  cmp,
} from 'jostraca'

import { requirePath } from '../utility'


import {
  KIT,
  getModelPath
} from '../types'


const Test = cmp(function Test(props: any) {
  const { target, ctx$ } = props
  const { model, stdrep, log } = ctx$

  const Test_sdk = requirePath(ctx$, `./cmp/${target.name}/Test_${target.name}`)
  Test_sdk['Test']({ model, target, stdrep })

  log.info({
    point: 'generate-test', target,
    note: 'target:' + target.name
  })
})


export {
  Test
}
