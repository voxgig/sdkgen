
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot
} from '@voxgig/sdkgen'

import { EntityOperation } from './EntityOperation_go'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Module name: concatenated lowercase
  const orgPrefix = (model.origin || '').replace(/-sdk$/, '').replace(/[^a-z0-9]/gi, '')
  const gomodule = orgPrefix + model.name + 'sdk'

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/go/fragment/')

  // Entity files go to entity/ folder with snake_case names
  Folder({ name: 'entity' }, () => {

    File({ name: entity.name + '_entity.' + target.ext }, () => {

      const opnames = Object.keys(entity.op)

      const opfrags =
        (['load', 'list', 'create', 'update', 'remove']
          .reduce((a: any, opname: string) =>
          (a['// #' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ? '' : ({ indent }: any) => {
              EntityOperation({ ff, opname, indent, entity, entrep, gomodule })
            }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.go',
        replace: {
          ...entrep,
          'GOMODULE': gomodule,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          '#Entity-Hook': ({ name, indent }: any) =>
            Content({ indent }, `utility.FeatureHook(ctx, "${name}")`),

          ...opfrags,
        }
      })

    })
  })
})



export {
  Entity
}
