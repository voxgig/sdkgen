


import {
  cmp, each,
  File, Content, Folder,
} from '@voxgig/sdkgen'

import { canonToType, opTypeName, opRequestShape, warnEntityTypeCollisions , deriveEntityNames } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { rustVarName } from './utility_rust'


const LANG = 'rust'


// One rust struct field line. `optional` -> Option<T>. Field names are
// snake_case + keyword-safe via rustVarName; duplicates are dropped by the
// caller so a struct never declares the same field twice.
function fieldLine(name: string, sentinel: any, optional: boolean): string {
  const rt = canonToType(sentinel, LANG)
  const typ = optional ? `Option<${rt}>` : rt
  return `    pub ${rustVarName(name)}: ${typ},\n`
}


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
  const { model, log } = props.ctx$

  // only_active:false — a Root scaffolded before create-sdkgen filtered on
  // `active` still generates entity code for inactive entities, and a project
  // keeps its Root until it re-scaffolds; that code needs these typed names.
  const entity = getModelPath(model, `main.${KIT}.entity`, { only_active: false, required: false })
  const entityList = deriveEntityNames(entity)

  warnEntityTypeCollisions(entity, log, LANG)

  Folder({ name: 'entity' }, () => {

    File({ name: 'types.' + target.ext }, () => {

      Content(`// Typed models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields{} and per-op
// params (op.<name>.points[].g.params[]). Field/param types are mapped
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
          .filter((f: any) => f.a !== false)

        emitStruct(
          `/// ${Name} is the typed data model for the ${ent.name} entity.`,
          Name,
          fields.map((f: any) => ({ name: f.n, type: f.t, optional: false === f.r }))
        )

        const ops = ent.op || {}
        ;['load', 'list', 'create', 'update', 'patch', 'remove'].forEach((opname: string) => {
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
