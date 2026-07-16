
import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_ocaml'
import { TestDirect } from './TestDirect_ocaml'
import { ReadmeExamplesTest } from './ReadmeExamplesTest_ocaml'


const Test = cmp(function Test(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  Folder({ name: 'test' }, () => {
    each(entity, (entity: ModelEntity) => {
      TestEntity({ target, entity })
      TestDirect({ target, entity })
    })

    // Structural gate over the ```ocaml blocks in the generated docs.
    ReadmeExamplesTest({ target })
  })
})


export {
  Test
}
