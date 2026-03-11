
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot
} from '@voxgig/sdkgen'

import { EntityOperation } from './EntityOperation_go'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const origin = null == model.origin ? '' : `${model.origin}/`
  const gomodule = `${origin}${model.name}`

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/go/fragment/')

  File({ name: entity.name + '_entity.' + target.ext }, () => {

    const opnames = Object.keys(entity.op)

    const opfrags =
      (['load', 'list', 'create', 'update', 'remove']
        .reduce((a: any, opname: string) =>
        (a['// #' + camelify(opname) + 'Op'] =
          !opnames.includes(opname) ? '' : ({ indent }: any) => {
            EntityOperation({ ff, opname, indent, entity, entrep })
          }, a), {}))

    Fragment({
      from: ff + 'Entity.fragment.go',
      replace: {
        ...entrep,
        'ProjectNameModule': gomodule,
        'ProjectNamePkg': model.name,
        ProjectName: model.const.Name,
        EntityName: entity.Name,
        entityname: entity.name,

        '#Feature-Hook': ({ name, indent }: any) =>
          Content({ indent }, `
sdk.FeatureHook(e.entctx, "${name}")
`.trim()),

        ...opfrags,
      }
    })

  })
})



export {
  Entity
}
