
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

import { scalaPackage } from './utility_scala'
import { EntityOperation } from './EntityOperation_scala'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const scalapackage = scalaPackage(model)

  // Collision-free entity CLASS name.
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/scala/fragment/')

  const binary = binarySlotSource(scalapackage, cls, entitySlots(entity))

  // Entity classes go to the entity/ folder.
  Folder({ name: 'entity' }, () => {

    File({ name: cls + '.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

      // For each CRUD op: if the spec defines it, splice in the real
      // implementation. Otherwise emit a stub that satisfies the SdkEntity
      // contract (so the package compiles) but errors at runtime.
      const opfrags =
        (['load', 'list', 'create', 'update', 'patch', 'remove']
          .reduce((a: any, opname: string) =>
          (a['// #' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ?
              ({ indent }: any) => {
                Content({ indent }, `  override def ${opname}(req: java.util.Map[String, Object], ctrl: java.util.Map[String, Object]): Object =
    throw Helpers.unsupportedOp("${opname}", this.name)
`)
              } :
              ({ indent }: any) => {
                EntityOperation({ ff, opname, indent, entity, entrep, scalapackage, cls })
              }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.scala',
        replace: {
          ...entrep,
          SCALAPACKAGE: scalapackage,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          // Class tokens are decoupled from the EntityName data-type token.
          EntyClass: cls,

          '#Entity-Hook': ({ name, indent }: any) =>
            Content({ indent }, `utility.featureHook(ctx, "${name}")`),

          '// #BinarySlot': ({ indent }: any) => null == binary ? undefined :
            Content({ indent }, binary.method),

          '// #BinaryTable': ({ indent }: any) => null == binary ? undefined :
            Content({ indent }, binary.table),

          ...opfrags,
        }
      })

    })
  })
})


// A slot name as a constant identifier: its alphanumeric runs, capitalised.
function slotConst(name: string, taken: string[]): string {
  const base = name.split(/[^A-Za-z0-9]+/).filter((p) => '' !== p)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
  const ident = /^[0-9]/.test(base) ? 'Slot' + base : '' === base ? 'Slot' : base
  let out = ident
  for (let i = 2; taken.includes(out); i++) out = ident + i
  taken.push(out)
  return out
}


// The entity's binary slots, by name; "" is its own bytes, reached with no name.
function binarySlotSource(pkg: string, cls: string, slots: any[]):
  { method: string, table: string } | undefined {
  if (0 === slots.length) return undefined

  const lit = (v: any) => null == v ? 'null' : JSON.stringify(String(v))
  const rows = slots.map((slot: any) => `    m.put(${lit(slot.name)}, ${pkg}.utility.BinarySlotDef(` +
    `${lit(slot.action)}, ${lit(slot.read)}, ${lit(slot.write)}))`).join('\n')

  const taken: string[] = []
  const named = slots.map((slot: any) => slot.name).filter((name: string) => '' !== name)
  const consts = named.map((name: string) =>
    `    val ${slotConst(name, taken)}: String = ${lit(name)}`).join('\n')

  const param = 0 === named.length ? '' :
    named.length < slots.length ? 'slot: String = ""' : 'slot: String'

  const handle = `${pkg}.utility.BinaryHandle[${cls}]`

  return {
    method: `  // An entity's bytes never enter its data: they are reached by slot.
  def binary(${param}): ${handle} =
    new ${handle}(this, this.entctx, ${cls}.BinarySlots, ${'' === param ? '""' : 'slot'})
`,
    table: `object ${cls} {
${0 === named.length ? '' : `
  object Slot {
${consts}
  }
`}
  val BinarySlots: java.util.Map[String, ${pkg}.utility.BinarySlotDef] = {
    val m = new java.util.LinkedHashMap[String, ${pkg}.utility.BinarySlotDef]()
${rows}
    java.util.Collections.unmodifiableMap(m)
  }
}
`,
  }
}


export {
  Entity
}
