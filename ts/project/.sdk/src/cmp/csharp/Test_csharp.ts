
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_csharp'
import { TestDirect } from './TestDirect_csharp'
import { ReadmeExamplesTest } from './ReadmeExamplesTest_csharp'


const Test = cmp(function Test(props: any) {
  const { model } = props.ctx$
  const { target } = props

  // The shared suites (Exists, StructUtility, PrimaryUtility, Pipeline,
  // Feature, Netsim, CustomUtility) plus the runner infrastructure are
  // templates in tm/csharp/test. Only the API-specific entity/direct
  // tests are generated here.
  Folder({ name: 'test' }, () => {

    each(model.main[KIT].entity, (entity: ModelEntity) => {
      TestEntity({ target, entity })
      TestDirect({ target, entity })
    })

    // Validate the documented csharp examples in the root + per-language docs.
    ReadmeExamplesTest({ target })
  })
})


export {
  Test
}
