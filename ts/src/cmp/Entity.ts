
import {
  cmp,
} from 'jostraca'

import { requirePath } from '../utility'

import { ensureStdrep } from '../helpers/stdrep'


import {
  KIT,
  getModelPath
} from '../types'


const Entity = cmp(function Entity(props: any) {
  const { target, entity, ctx$ } = props
  const { log } = ctx$

  // Entity_<lang> components pull stdrep off ctx$ for their fragments, and
  // Entity is the FIRST phase Root runs — so the generator-owned keys have to
  // exist by here, not just by Main.
  ensureStdrep(ctx$)

  const entitySDK = getModelPath(ctx$.model, `main.${KIT}.entity.${entity.name}`)

  const Entity_sdk = requirePath(ctx$, `./cmp/${target.name}/Entity_${target.name}`)
  Entity_sdk['Entity']({ target, entity, entitySDK })

  // Log identifiers, not the model subtrees. `target` and `entity` are large
  // aontu nodes and this fires once per entity per target (thousands of times
  // for a big API x 22 targets), so passing them serialised the whole model
  // fragment each time at default log level.
  log.info({
    point: 'generate-entity', target: target.name, entity: entity.name,
    note: 'target:' + target.name + ', ' + 'entity: ' + entity.name
  })
})


export {
  Entity
}
