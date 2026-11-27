
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot,
  entityClassName, entityConstructorName, entityCollection, entitySlots, goModule
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_go'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const gomodule = goModule(model, target.name)

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, but disambiguated (e.g. `<Name>EntityClient`) when it would
  // clash with another entity's data-type name. The DATA type stays `<Name>`.
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)
  const ctor = entityConstructorName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/go/fragment/')

  // The entity's binary slots, by name; '' is its own bytes, reached with no name.
  const slots = entitySlots(entity)
  const named = slots.map((slot: any) => slot.name).filter((name: string) => '' !== name)
  const slotsVar = 'binarySlots' + cls
  const slotTable = slots.map((slot: any) =>
    `\t${JSON.stringify(slot.name)}: {Action: ${JSON.stringify(slot.action)}` +
    (null == slot.read ? '' : `, Read: ${JSON.stringify(slot.read)}`) +
    (null == slot.write ? '' : `, Write: ${JSON.stringify(slot.write)}`) + '},').join('\n')
  const slotConsts = named.map((name: string) =>
    `\t${cls}Binary${camelify(name)} = ${JSON.stringify(name)}`).join('\n')
  const slotParam = 0 === named.length ? '' : named.length < slots.length ? 'slot ...string' :
    'slot string'
  const slotArg = 0 === named.length ? '""' : named.length < slots.length ?
    'append(slot, "")[0]' : 'slot'

  Folder({ name: 'entity' }, () => {

    File({ name: entity.name + '_entity.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

      // For each CRUD op: if the spec defines it, splice in the real
      // implementation. Otherwise emit a stub that satisfies the static
      // ProjectNameEntityBase interface (so the package compiles) but errors
      // at runtime if the caller invokes an unsupported op.
      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['// #' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ?
              ({ indent }: any) => {
                const Method = camelify(opname)
                Content({ indent }, `func (e *${cls}) ${Method}(_ map[string]any, _ map[string]any) (any, error) {
	return core.UnsupportedOp("${opname}", e.name)
}
`)
              } :
              ({ indent }: any) => {
                EntityOperation({ ff, opname, indent, entity, entrep, gomodule, cls, ctor })
              }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.go',
        replace: {
          ...entrep,
          'GOMODULE': gomodule,
          '"github.com/voxgig/struct"': `"${gomodule}/utility/struct"`,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          EntyClass: cls,
          NewEntyClass: ctor,

          '#BinaryImport': ({ indent }: any) => 0 === slots.length ? undefined :
            Content({ indent }, `"${gomodule}/utility/codec"
`),

          '#BinarySlot': ({ indent }: any) => 0 === slots.length ? undefined :
            Content({ indent }, `var ${slotsVar} = map[string]codec.BinarySlot{
${slotTable}
}
${0 === named.length ? '' : `
const (
${slotConsts}
)
`}
// Binary reaches the entity's bytes by slot: they never enter its data.
func (e *${cls}) Binary(${slotParam}) *codec.BinaryHandle {
	return codec.NewBinaryHandle(e, ${slotsVar}, ${slotArg})
}
`),

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
