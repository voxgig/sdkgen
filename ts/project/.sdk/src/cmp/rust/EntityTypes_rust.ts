

// Typed-model generator (Rust target). Port of EntityTypes_go.ts.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one file, entity/types.rs, with
// a rust `struct <Name> { ... }` per entity plus a request/match struct per
// active op. Field/param sentinels ($STRING, $INTEGER, ...) are turned into
// rust types locally (the shared canonToType helper has no rust column).
//
// DESIGN NOTE (rust specifics vs the go reference):
//   * The rust runtime is fully DYNAMIC: every op takes and returns the
//     vendored `Value` enum (Result<Value, ...Error>), and the op fragments
//     emit no typed wrappers. Go additionally emits `LoadTyped`/`ListTyped`
//     wrappers plus json round-trip helpers; rust has no serde/json-derive
//     dependency (only `ureq`), so these typed models are DOCUMENTARY: they
//     mirror the entity/op shapes for reference and IDE support, but are not
//     wired into the runtime. They compile as part of the crate (declared in
//     entity/mod.rs) so they stay in sync with the model.
//   * Optional (req:false) member -> `Option<T>`.
//   * The module carries broad `#![allow(...)]` since nothing consumes the
//     types yet (parity intent, not dead-code churn).

import {
  cmp, each, names,
  File, Content, Folder,
} from '@voxgig/sdkgen'

import { opTypeName, opRequestShape, canonKey } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { rustVarName } from './utility_rust'


// Canonical type sentinel -> a rust type. Unknown/missing -> the dynamic
// `Value` (never throws), matching the runtime's open shape.
function rustType(sentinel: any): string {
  const k = canonKey(sentinel)
  if ('STRING' === k) return 'String'
  if ('INTEGER' === k) return 'i64'
  if ('NUMBER' === k) return 'f64'
  if ('BOOLEAN' === k) return 'bool'
  if ('ARRAY' === k) return 'Vec<Value>'
  return 'Value'
}


// One rust struct field line. `optional` -> Option<T>. Field names are
// snake_case + keyword-safe via rustVarName; duplicates are dropped by the
// caller so a struct never declares the same field twice.
function fieldLine(name: string, sentinel: any, optional: boolean): string {
  const rt = rustType(sentinel)
  const typ = optional ? `Option<${rt}>` : rt
  return `    pub ${rustVarName(name)}: ${typ},\n`
}


// Emit a struct named `typeName` from {name, type, optional} items, dropping
// duplicate rust identifiers (two model names can collapse to one ident).
function emitStruct(comment: string, typeName: string, items: any[]): void {
  Content(`${comment}
#[derive(Debug, Clone)]
pub struct ${typeName} {
`)
  const seen = new Set<string>()
  items.forEach((it: any) => {
    if (null == it || null == it.name) return
    const ident = rustVarName(it.name)
    if (seen.has(ident)) return
    seen.add(ident)
    Content(fieldLine(it.name, it.type, !!it.optional))
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
  // with the go emitter's fix).
  const entityList = each(entity).filter((e: any) => e && null != e.name)
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

  Folder({ name: 'entity' }, () => {

    File({ name: 'types.' + target.ext }, () => {

      Content(`// Typed models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types are mapped
// from the canonical type sentinels. Do not edit by hand.
//
// These are DOCUMENTARY: the SDK runtime is dynamic (ops take/return the
// \`Value\` enum), so nothing consumes these structs yet — they mirror the
// entity/op shapes for reference and IDE support.
#![allow(dead_code, non_snake_case, unused_imports)]

use crate::utility::voxgigstruct::Value;

`)

      entityList.forEach((ent: any) => {
        const Name = ent.Name
        const fields = (ent.fields ? each(ent.fields) : [])
          .filter((f: any) => f.active !== false)

        // Entity data model: one field per model field. req:false -> Option.
        emitStruct(
          `/// ${Name} is the typed data model for the ${ent.name} entity.`,
          Name,
          fields.map((f: any) => ({ name: f.name, type: f.type, optional: false === f.req }))
        )

        // Per active op: a request/match struct. Members and their optionality
        // come from the shared partiality policy (opRequestShape).
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


export {
  EntityTypes,
}
