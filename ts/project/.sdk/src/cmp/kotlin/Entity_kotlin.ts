
import * as Path from 'node:path'

import {
  cmp, camelify, names,
  File, Content, Folder, Fragment,
  entityClassName, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { kotlinPackage } from './utility_kotlin'
import { EntityOperation } from './EntityOperation_kotlin'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const kotlinpackage = kotlinPackage(model)

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, but disambiguated (e.g. `<Name>EntityClient`) when it
  // would clash with another entity's data-type name.
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/kotlin/fragment/')

  // The entity's binary slots, by name; '' is its own bytes, reached with no name.
  const slots = entitySlots(entity)
  const handle = kotlinpackage + '.utility.codec.HandleCodec'
  const named = slots.filter((slot: any) => '' !== slot.name)
  const str = (v: any) => null == v ? 'null' : JSON.stringify(v).replace(/\$/g, '\\$')
  const binarySlot = 0 === slots.length ? '' : `  // An entity's bytes never enter its data: they are reached by slot.
  companion object {
${named.map((slot: any) => '    const val BINARY_' +
    slot.name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase() + ' = ' + str(slot.name) + '\n').join('')}
    private val BINARY_SLOTS: Map<String, ${handle}.SlotDef> = mapOf(
${slots.map((slot: any) => '      ' + str(slot.name) + ' to ' + handle + '.SlotDef(' +
    [slot.action, slot.read, slot.write].map(str).join(', ') + ')').join(',\n')},
    )
  }
${named.length < slots.length ? `
  fun binary(): ${handle}.BinaryHandle =
    ${handle}.BinaryHandle(this, this.entctx, BINARY_SLOTS, "")
` : ''}${0 < named.length ? `
  fun binary(slot: String): ${handle}.BinaryHandle =
    ${handle}.BinaryHandle(this, this.entctx, BINARY_SLOTS, slot)
` : ''}`

  // Entity classes go to the entity/ folder.
  Folder({ name: 'entity' }, () => {

    File({ name: cls + '.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['// #' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ?
              ({ indent }: any) => {
                Content({ indent }, `  override fun ${opname}(req: MutableMap<String, Any?>?, ctrl: MutableMap<String, Any?>?): Any? {
    throw Helpers.unsupportedOp("${opname}", this.name)
  }
`)
              } :
              ({ indent }: any) => {
                EntityOperation({ ff, opname, indent, entity, entrep, kotlinpackage, cls })
              }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.kt',
        replace: {
          ...entrep,
          KOTLINPACKAGE: kotlinpackage,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          // Class tokens are decoupled from the EntityName data-type token so
          // the class can be renamed independently.
          EntyClass: cls,

          '// #BinarySlot': ({ indent }: any) =>
            '' === binarySlot ? undefined : Content({ indent }, binarySlot),

          '#Entity-Hook': ({ name, indent }: any) =>
            Content({ indent }, `utility.featureHook(ctx, "${name}")`),

          ...opfrags,
        }
      })

    })
  })
})



export {
  Entity
}
