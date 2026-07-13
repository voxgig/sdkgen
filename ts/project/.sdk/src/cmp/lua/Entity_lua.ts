
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot,
  entityClassName,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_lua'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, disambiguated when it would clash with another entity's
  // data-type name. The class is a module-local table (snake-cased file name),
  // so this is used only for the local identifier — kept uniform with the other
  // languages.
  const entityColl = getModelPath(model, `main.${KIT}.entity`)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/lua/fragment/')

  // Entity files go to entity/ folder
  Folder({ name: 'entity' }, () => {

    File({ name: entity.name + '_entity.' + target.ext }, () => {

      const opnames = Object.keys(entity.op)

      const opfrags =
        (['load', 'list', 'create', 'update', 'remove']
          .reduce((a: any, opname: string) =>
          (a['-- #' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ? '' : ({ indent }: any) => {
              EntityOperation({ ff, opname, indent, entity, entrep, cls })
            }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.lua',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          // Class token decoupled from the EntityName data-type token in
          // Entity.fragment.lua so the class can be renamed independently.
          EntyClass: cls,

          // Fill the six per-op pipeline hook markers with real feature_hook
          // calls. jostraca's `//`-based `#Name` slot pattern does not fire for
          // Lua's `-- #`-comment markers, so substitute them as literal keys
          // (exactly like the op fragments above).
          ...Object.fromEntries(
            ['PrePoint', 'PreSpec', 'PreRequest', 'PreResponse', 'PreResult', 'PreDone']
              .map((h: string) => [`-- #${h}-Hook`,
              ({ indent }: any) => Content({ indent }, `utility.feature_hook(ctx, "${h}")`)])
          ),

          ...opfrags,
        }
      })

    })
  })
})



export {
  Entity
}
