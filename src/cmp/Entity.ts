
import {
  cmp,
} from 'jostraca'

import { requirePath } from '../utility'

import {
  KIT,
  getModelPath
} from '../types'


const Entity = cmp(function Entity(props: any) {
  const { target, entity, ctx$ } = props
  const { log } = ctx$

  const entitySDK = getModelPath(ctx$.model, `main.${KIT}.entity.${entity.name}`)

  const Entity_sdk = requirePath(ctx$, `./cmp/${target.name}/Entity_${target.name}`)
  Entity_sdk['Entity']({ target, entity, entitySDK })

  log.info({
    point: 'generate-entity', target, entity,
    note: 'target:' + target.name + ', ' + 'entity: ' + entity.name
  })
})


export {
  Entity
}
