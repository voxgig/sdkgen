
// Typed-model generator (Swift target). Port of EntityTypes_rust.ts /
// EntityTypes_go.ts.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one file,
// Sources/ProjectNameSDK/entity/<Name>Types.swift, with a `struct <Name>` per
// entity plus a request/match struct per active op. Field/param sentinels
// ($STRING, $INTEGER, ...) are mapped to Swift types locally.
//
// DESIGN NOTE: the Swift runtime is fully DYNAMIC — every op takes and returns
// the vendored `Value` enum (throws on error) and the op fragments emit no
// typed wrappers. These typed models are therefore DOCUMENTARY: they mirror the
// entity/op shapes for reference and IDE support, but are not wired into the op
// signatures. They compile as part of the SwiftPM target (every .swift under
// Sources/ProjectNameSDK is built) so they stay in sync with the model.
//   * Optional (req:false) member -> `T?`.
//   * Unknown/missing sentinel -> the dynamic `Value` (never fails), matching
//     the runtime's open shape.

import {
  cmp, each, names,
  File, Content, Folder,
} from '@voxgig/sdkgen'

import { opTypeName, opRequestShape, canonKey } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { swiftVarName } from './utility_swift'


// Canonical type sentinel -> a Swift type. Unknown/missing -> the dynamic
// `Value` (the loose object model's open shape).
function swiftType(sentinel: any): string {
  const k = canonKey(sentinel)
  if ('STRING' === k) return 'String'
  if ('INTEGER' === k) return 'Int'
  if ('NUMBER' === k) return 'Double'
  if ('BOOLEAN' === k) return 'Bool'
  if ('ARRAY' === k) return '[Value]'
  if ('OBJECT' === k) return 'VMap'
  return 'Value'
}


// One Swift struct property line. `optional` -> `T?`. Property names are
// keyword-safe + lowerCamelCase via swiftVarName; duplicates are dropped by the
// caller so a struct never declares the same property twice.
function propLine(name: string, sentinel: any, optional: boolean): string {
  const st = swiftType(sentinel)
  const typ = optional ? `${st}?` : st
  return `  public var ${swiftVarName(name)}: ${typ}\n`
}


// Emit a `struct <typeName>` from {name, type, optional} items, dropping
// duplicate Swift identifiers (two model names can collapse to one ident). An
// empty struct is a valid, zero-property shape.
function emitStruct(comment: string, typeName: string, items: any[]): void {
  Content(`${comment}
public struct ${typeName} {
`)
  const seen = new Set<string>()
  items.forEach((it: any) => {
    if (null == it || null == it.name) return
    const ident = swiftVarName(it.name)
    if (seen.has(ident)) return
    seen.add(ident)
    Content(propLine(it.name, it.type, !!it.optional))
  })
  Content(`}

`)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Emit for every entity that gets an entity file (filter on `name`, always
  // present; derive `Name` here so the struct set is deterministic — parity
  // with the rust/go emitter's fix).
  const entityList = each(entity).filter((e: any) => e && null != e.name)
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

  Folder({ name: 'Sources' }, () => {
    Folder({ name: 'ProjectNameSDK' }, () => {
      Folder({ name: 'entity' }, () => {

        File({ name: model.const.Name + 'Types.' + target.ext }, () => {

          Content(`// Typed models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types are mapped
// from the canonical type sentinels. Do not edit by hand.
//
// These are DOCUMENTARY: the SDK runtime is dynamic (ops take/return the
// \`Value\` enum), so nothing consumes these structs yet — they mirror the
// entity/op shapes for reference and IDE support.

import Foundation

`)

          entityList.forEach((ent: any) => {
            const Name = ent.Name
            const fields = (ent.fields ? each(ent.fields) : [])
              .filter((f: any) => f.active !== false)

            // Entity data model: one property per field. req:false -> optional.
            emitStruct(
              `/// ${Name} is the typed data model for the ${ent.name} entity.`,
              Name,
              fields.map((f: any) => ({ name: f.name, type: f.type, optional: false === f.req }))
            )

            // Per active op: a request/match struct. Members and their
            // optionality come from the shared partiality policy
            // (opRequestShape).
            const ops = ent.op || {}
              ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
                if (null == ops[opname]) {
                  return
                }

                const typeName = opTypeName(Name, opname)
                const { items } = opRequestShape(ent, opname)

                emitStruct(
                  `/// ${typeName} is the typed request payload for ${Name}.${opname}.`,
                  typeName,
                  items
                )
              })
          })
        })
      })
    })
  })
})


export {
  EntityTypes,
}
