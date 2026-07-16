
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_swift'
import { TestDirect } from './TestDirect_swift'
import { ReadmeExamplesTest } from './ReadmeExamplesTest_swift'


const Test = cmp(function Test(props: any) {
  const { model } = props.ctx$
  const { target } = props

  // The shared suites (Exists, StructUtility, PrimaryUtility, Pipeline,
  // Feature, Netsim, CustomUtility) plus the runner infrastructure are
  // templates in tm/swift/Tests. Only the API-specific entity/direct tests
  // are generated here.
  Folder({ name: 'Tests' }, () => {
    Folder({ name: 'ProjectNameSDKTests' }, () => {
      each(getModelPath(model, `main.${KIT}.entity`), (entity: ModelEntity) => {
        TestEntity({ target, entity })
        TestDirect({ target, entity })
      })

      // Validate the documented swift examples in the READMEs are well-formed.
      ReadmeExamplesTest({ target })
    })
  })
})


export {
  Test
}
