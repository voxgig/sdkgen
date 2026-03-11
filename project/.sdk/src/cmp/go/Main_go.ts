
import * as Path from 'node:path'

import {
  cmp, each, names, cmap,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
} from '@voxgig/sdkgen'


import type {
  ModelEntity
} from '@voxgig/apidef'


import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


import { Package } from './Package_go'
import { Config } from './Config_go'
import { MainEntity } from './MainEntity_go'


const Main = cmp(async function Main(props: any) {

  const { target } = props
  const { model } = props.ctx$

  const entity: ModelEntity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const origin = null == model.origin ? '' : `${model.origin}/`
  const gomodule = `${origin}${model.name}`

  Package({ target })

  // Overwrite tm/go files that need the full Go module path (including origin).
  Copy({
    from: 'tm/' + target.name,
    replace: {
      ...props.ctx$.stdrep,
      GOMODULE: gomodule,
    }
  })

  File({ name: model.name + '.' + target.ext }, () => {

    Fragment(
      {
        from: Path.normalize(__dirname + '/../../../src/cmp/go/fragment/Main.fragment.go'),
        replace: {
          ...props.ctx$.stdrep,
          'ProjectNameModule': gomodule,
          'ProjectNamePkg': model.name,

          '#BuildFeatures': ({ indent }: any) => {
            // Go features are built differently - iterate and add
            List({ item: feature, line: false }, ({ item }: any) =>
              Line({ indent },
                `// Feature: ${item.name}`))
          },

          '#Feature-Hook': ({ name, indent }: any) => Content({ indent }, `
sdk.FeatureHook(s.rootctx, "${name}")
`),

        }
      },

      // Entities - injected at SLOT
      () => {
        each(entity, (entity: ModelEntity) => {
          const entitySDK = getModelPath(model, `main.${KIT}.entity.${entity.name}`)
          const entprops = { target, entity, entitySDK }
          MainEntity(entprops)
        })
      })
  })

  Config({ target })

})


export {
  Main
}
