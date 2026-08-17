// `wtest`'s test-suite emitter, dispatched as `cmp/<t>/Test_<t>`.
//
// A file per active entity, under `test/`. Note what this does NOT do: read
// `model.main.kit.entity` directly. That raw map is unfiltered, and sixteen
// shipped targets read it here and generated a full test suite for entities
// the SDK deliberately excluded. A fixture package repeating that mistake
// would bake it into the authoring guide, so this reads the same filtered
// view the emitters do.

import {
  cmp, each, Folder, File, Content, entityCollection,
} from '@voxgig/sdkgen'


const Test = cmp(function Test(props: any) {
  const { model, target } = props

  const entities = each(entityCollection(model))
    .filter((e: any) => false !== e.active)
    .sort((a: any, b: any) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)

  Folder({ name: 'test' }, () => {
    each(entities, (entity: any) => {
      File({ name: entity.name + '.test.' + target.ext }, () => {
        Content([
          '# test ' + entity.name,
          'check ' + entity.name + ' exists',
          '',
        ].join('\n'))
      })
    })
  })
})


export {
  Test
}
