
import {
  cmp,
} from 'jostraca'

import { requirePath } from '../utility'


const Entity = cmp(function Entity(props: any) {
  const { target, entity, ctx$ } = props

  const entitySDK = ctx$.model.main.sdk.entity[entity.name]

  const Entity_sdk = requirePath(ctx$, `./cmp/${target.name}/Entity_${target.name}`)
  Entity_sdk['Entity']({ target, entity, entitySDK })
})


export {
  Entity
}
