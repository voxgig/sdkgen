
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder } from '@voxgig/sdkgen'


// import { Quick } from './Quick_ts'
// import { TestMain } from './TestMain_ts'
import { TestDirect } from './TestDirect_ts'
import { TestEntity } from './TestEntity_ts'
import { ReadmeExampleTest } from './ReadmeExampleTest_ts'
import { ReadmeExamplesTest } from './ReadmeExamplesTest_ts'


const Test = cmp(function Test(props: any) {
  const { model, stdrep } = props.ctx$
  const { target } = props

  Folder({ name: 'test' }, () => {
    // Quick({ target })
    // TestMain({ target })

    ReadmeExampleTest({ target })
    ReadmeExamplesTest({ target })

    Folder({ name: 'entity' }, () => {
      // getModelPath, unlike a raw model read, applies the model's default
      // active-only filtering (see entityCollection in helpers/opShape.ts for
      // why that resolver deliberately opts OUT of it instead). Reading
      // model.main[KIT].entity directly emitted a test file for every entity
      // regardless of `active`, even when Main_ts.ts had already left the
      // inactive ones out of the generated source.
      const entity = getModelPath(model, `main.${KIT}.entity`)
      each(entity, (entity: ModelEntity) => {
        TestEntity({ target, entity })
        TestDirect({ target, entity })
      })
    })
  })
})


export {
  Test
}
