
import { cmp } from 'jostraca'

import { resolvePath } from '../utility'


const Entity = cmp(function Entity(props: any) {
  const { build, entity, ctx$ } = props

  // console.log('BUILD name', build.name)
  const Entity_sdk = require(resolvePath(ctx$, `./${build.name}/Entity_${build.name}`))

  Entity_sdk['Entity']({ build, entity })
})


export {
  Entity
}
