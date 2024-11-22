
import { cmp } from 'jostraca'

import { requirePath } from '../utility'


const Entity = cmp(function Entity(props: any) {
  const { target, entity, ctx$ } = props

  const Entity_sdk = requirePath(ctx$, `./target/${target.name}/Entity_${target.name}`)
  Entity_sdk['Entity']({ target, entity })
})


export {
  Entity
}
