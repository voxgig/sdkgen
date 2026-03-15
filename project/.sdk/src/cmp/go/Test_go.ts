
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_go'
import { TestDirect } from './TestDirect_go'


const Test = cmp(function Test(props: any) {
  const { model, stdrep } = props.ctx$
  const { target } = props

  // Module name: concatenated lowercase
  const orgPrefix = (model.origin || '').replace(/-sdk$/, '').replace(/[^a-z0-9]/gi, '')
  const gomodule = orgPrefix + model.name + 'sdk'

  Folder({ name: 'test' }, () => {
    each(model.main[KIT].entity, (entity: ModelEntity) => {
      TestEntity({ target, entity, gomodule })
      TestDirect({ target, entity, gomodule })
    })
  })
})


export {
  Test
}
