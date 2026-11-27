
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot,
  opTypeName, entityClassName, entityCollection, tsTypeName, entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_ts'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, disambiguated when it would clash with another entity's
  // data-type name. The DATA type stays `<Name>`. The class file name and the
  // Main import path both use this, so they always agree.
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  // A TS/JS global (Record, Array, Promise, ...) would shadow itself for
  // the rest of the file — see tsTypeName. The runtime `this.Name`
  // string stays entity.Name; only the TYPE reference is ever renamed.
  const dataType = tsTypeName(entity, entityColl)

  const typeNames = [dataType]
  const opnamesAll = Object.keys(entity.op || {})
  ;['load', 'list', 'create', 'update', 'patch', 'remove'].forEach((opname: string) => {
    if (opnamesAll.includes(opname)) {
      typeNames.push(opTypeName(entity.Name, opname))
    }
  })
  const typeImport =
    'import type {\n  ' + typeNames.join(',\n  ') +
    `,\n} from '../${model.const.Name}Types'`

  const ff = Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/')

  // The entity's binary slots, by name; '' is its own bytes, reached with no name.
  const slots = entitySlots(entity)
  const slotDefs = Object.fromEntries(slots.map((slot: any) => [slot.name, {
    action: slot.action,
    ...(null == slot.read ? {} : { read: slot.read }),
    ...(null == slot.write ? {} : { write: slot.write }),
  }]))
  const named = slots.map((slot: any) => slot.name).filter((name: string) => '' !== name)
  const slotParam = 0 === named.length ? '' :
    'slot' + (named.length < slots.length ? '?' : '') + ': ' +
    named.map((name: string) => JSON.stringify(name)).join(' | ')

  Folder({ name: 'src/entity' }, () => {

    File({ name: cls + '.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['#' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ? '' : ({ indent }: any) => {
              EntityOperation({ ff, opname, indent, entity, entrep })
            }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.ts',
        replace: {
          ...entrep,
          entityname: entity.name,
          SdkName: model.const.Name,
          EntityName: entity.Name,
          EntityDataType: dataType,

          EntyClass: cls,

          '#TypeImports': ({ indent }: any) => Content({ indent }, typeImport),

          '#BinaryImport': ({ indent }: any) => 0 === slots.length ? undefined :
            Content({ indent }, `import { BinaryHandle as ${model.const.Name}BinaryHandle } from '../utility/codec/HandleCodec'

const BINARY_SLOTS = ${JSON.stringify(slotDefs, null, 2)}
`),

          '#BinarySlot': ({ indent }: any) => 0 === slots.length ? undefined :
            Content({ indent }, `// An entity's bytes never enter its data: they are reached by slot.
binary(${slotParam}): ${model.const.Name}BinaryHandle<${cls}> {
  return new ${model.const.Name}BinaryHandle<${cls}>(this, BINARY_SLOTS${'' === slotParam ? '' : ', slot'})
}
`),

          '#Feature-Hook': ({ name, indent }: any) =>
            Content({ indent }, `
fres = featureHook(ctx, '${name}')
if (fres instanceof Promise) { await fres }
`.trim()),

          ...opfrags,
        }
      })

    })
  })

})



export {
  Entity
}
