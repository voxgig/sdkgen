
import { cmp } from 'jostraca'

import { requirePath } from '../utility'


const Entity = cmp(function Entity(props: any) {
  const { build, entity, ctx$ } = props

  const Entity_sdk = requirePath(ctx$, `./${build.name}/Entity_${build.name}`)
  Entity_sdk['Entity']({ build, entity })
})


export {
  Entity
}
