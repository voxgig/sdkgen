
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

  Folder({ name: 'test' }, () => {

    Folder({ name: 'entity' }, () => {
      each(model.main[KIT].entity, (entity: ModelEntity) => {
        TestEntity({ target, entity })
        TestDirect({ target, entity })
      })
    })
  })
})


export {
  Test
}
