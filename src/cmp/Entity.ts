
import { cmp } from 'jostraca'

import { resolvePath } from '../utility'


const Entity = cmp(function Entity(props: any) {
  const { build, entity, ctx$ } = props

  const Entity_sdk = require(resolvePath(ctx$, `./${build.name}/Entity_${build.name}`))

  Entity_sdk['Entity_' + build.name]({ build, entity })
})


export {
  Entity
}
