

// Typed-model generator (JavaScript target).
//
// JavaScript is dynamically typed, so the "types" are JSDoc typedefs
// (@typedef / @property) for editor/tooling DX only — no runtime effect.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one file, src/<Sdk>Types.js,
// with a `@typedef {Object} <Name>` per active entity plus a request/match
// typedef per active op. Field/param sentinels ($STRING, $INTEGER, ...) are
// turned into JSDoc types by the shared sdkgen helper `canonToType`
// ('js' column: Object / Array / * for open shapes).
//
// The typedefs are emitted at file (script) scope so they are GLOBAL across
// the SDK's JS program — the op fragments reference them by bare name
// (@param {AdviceLoadMatch} / @returns {Promise<Advice>}). Keeps the SAME
// type-name scheme as the TS reference (<Name>, <Name>LoadMatch,
// <Name>ListMatch, <Name>CreateData, <Name>UpdateData, <Name>RemoveMatch).

import {
  cmp, each, names,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType, opTypeName, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'js'


// A bare JSDoc property key, or a quoted string literal for anything that is
// not a plain identifier.
function propKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named (e.g. a fieldless placeholder) would otherwise read
  // `Name = undefined` below. Parity with the go emitter's fix.
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

  File({ name: model.const.Name + 'Types.' + LANG }, () => {

    Content(`// Typed models for the ${model.const.Name} SDK (JSDoc typedefs).
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
// @voxgig/apidef VALID_CANON). Annotations only — no runtime effect. Do not
// edit by hand.

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one @property per field, `req:false` -> optional [].
      Content(`/**
 * @typedef {Object} ${Name}
`)
      fields.forEach((f: any) => {
        const key = false === f.req ? '[' + propKey(f.name) + ']' : propKey(f.name)
        Content(` * @property {${canonToType(f.type, LANG)}} ${key}
`)
      })
      Content(` */

`)

      // Per active op: a request/match typedef. Members and their optionality
      // come from the shared partiality policy (opRequestShape); this file only
      // renders them as JSDoc @property lines (optional -> [bracketed] key).
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)

        Content(`/**
 * @typedef {Object} ${typeName}
`)
        items.forEach((it: any) => {
          const key = it.optional ? '[' + propKey(it.name) + ']' : propKey(it.name)
          Content(` * @property {${canonToType(it.type, LANG)}} ${key}
`)
        })
        Content(` */

`)
      })
    })
  })
})


export {
  EntityTypes,
}
