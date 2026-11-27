
import * as Path from 'node:path'

import { swiftTargetDir, swiftTestDir, swiftVarName, swiftString } from './utility_swift'

import {
  cmp, camelify, names,
  Content, File, Folder, Fragment,
  entityClassName, entityCollection, entitySlots,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_swift'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Collision-free entity CLASS name (see entityClassName).
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/swift/fragment/')

  const binarySlot = binarySlotSource(cls, entitySlots(entity))

  // Entity files join the copied runtime under Sources/ProjectNameSDK/entity.
  Folder({ name: 'Sources' }, () => {
    Folder({ name: swiftTargetDir(model) }, () => {
      Folder({ name: 'entity' }, () => {

        File({ name: cls + '.' + target.ext }, () => {

          const opnames = Object.keys(entity.op || {})

          // For each CRUD op: if the spec defines it, splice in the real
          // implementation (an override). Otherwise leave the base-class
          // method, which throws unsupportedOp at runtime.
          const opfrags =
            (['load', 'list', 'create', 'update', 'patch', 'remove']
              .reduce((a: any, opname: string) =>
              (a['#' + camelify(opname) + 'Op'] =
                !opnames.includes(opname) ?
                  ({ indent }: any) => {
                    Content({ indent },
                      `// (${opname} not defined by this API - base class throws unsupportedOp)
`)
                  } :
                  ({ indent }: any) => {
                    EntityOperation({ ff, opname, indent, entity, entrep, cls })
                  }, a), {}))

          Fragment({
            from: ff + 'Entity.fragment.swift',
            replace: {
              ...entrep,
              ProjectName: model.const.Name,
              EntityName: entity.Name,
              entityname: entity.name,

              // Class/constructor tokens are decoupled from the EntityName
              // data-type token so the class can be renamed independently.
              EntyClass: cls,

              '#BinarySlot': ({ indent }: any) => null == binarySlot ? undefined :
                Content({ indent }, binarySlot),

              ...opfrags,
            }
          })

        })
      })
    })
  })
})



// The entity's binary slots, by name; "" is its own bytes, reached with no
// name. Built line by line: the swift type guard reads declarations that open
// a line, and these nest in the entity class.
function binarySlotSource(cls: string, slots: any[]): string | undefined {
  if (0 === slots.length) return undefined

  const lit = (v: any) => null == v ? 'nil' : swiftString(String(v))
  const named = slots.map((slot: any) => slot.name).filter((name: string) => '' !== name)

  const taken: string[] = []
  const constName = (name: string) => {
    let out = swiftVarName(name)
    for (let i = 2; taken.includes(out); i++) out = swiftVarName(name) + i
    taken.push(out)
    return out
  }

  const param = 0 === named.length ? '' :
    named.length < slots.length ? '_ slot: String? = nil' : '_ slot: String'

  const lines: string[] = [
    ...(0 === named.length ? [] : [
      'public enum BinarySlot {',
      ...named.map((name: string) => `  public static let ${constName(name)} = ${lit(name)}`),
      '}',
      '',
    ]),
    `private static let binarySlots: [String: BinaryHandle<${cls}>.Slot] = [`,
    ...slots.map((slot: any) => `  ${lit(slot.name)}: (action: ${lit(slot.action)}, ` +
      `read: ${lit(slot.read)}, write: ${lit(slot.write)}),`),
    ']',
    '',
    '// An entity\'s bytes never enter its data: they are reached by slot.',
    `public func binary(${param}) -> BinaryHandle<${cls}> {`,
    `  return BinaryHandle<${cls}>(self, entctx, ${cls}.binarySlots${'' === param ? '' : ', slot'})`,
    '}',
  ]
  return lines.join('\n') + '\n'
}


export {
  Entity
}
