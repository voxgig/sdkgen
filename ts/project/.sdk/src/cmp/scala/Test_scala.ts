
import {
  KIT,
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_scala'
import { TestDirect } from './TestDirect_scala'
import { scalaPackage } from './utility_scala'


const Test = cmp(function Test(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const scalapackage = scalaPackage(model)

  Folder({ name: 'test' }, () => {

    // Shared test infrastructure (the struct corpus runner, the feature
    // harness and the pipeline/feature suites) ships as templates in
    // tm/scala/test/ and is copied by Main_scala. Here we generate only the
    // API-specific entity/direct tests.
    each(model.main[KIT].entity, (entity: ModelEntity) => {
      TestEntity({ target, entity, scalapackage })
      TestDirect({ target, entity, scalapackage })
    })
  })
})


export {
  Test
}
