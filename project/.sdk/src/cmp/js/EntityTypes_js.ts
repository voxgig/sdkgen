

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
  cmp, each,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'js'


// The five ops, and whether their request payload is a `Match` (query/id) or
// `Data` (body) — this fixes the generated type-name suffix per op.
const OP_SUFFIX: Record<string, 'Match' | 'Data'> = {
  load: 'Match',
  list: 'Match',
  remove: 'Match',
  create: 'Data',
  update: 'Data',
}


// A bare JSDoc property key, or a quoted string literal for anything that is
// not a plain identifier.
function propKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name)
}


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


// The generated typedef name for an op's request payload, e.g. AdviceLoadMatch.
function opTypeName(Name: string, opname: string): string {
  return Name + cap(opname) + (OP_SUFFIX[opname] || 'Match')
}


// Collect an op's params, deduped by name across all of its points.
function opParams(op: any): any[] {
  const points = op && op.points ? each(op.points) : []
  const seen: Record<string, boolean> = {}
  const out: any[] = []
  points.forEach((pt: any) => {
    const params = pt && pt.args && pt.args.params ? each(pt.args.params) : []
    params.forEach((p: any) => {
      if (p && null != p.name && !seen[p.name]) {
        seen[p.name] = true
        out.push(p)
      }
    })
  })
  return out
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

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

      // Per active op: a request/match typedef. With params -> typed
      // properties; without params -> an open Object (a field filter).
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        const op = ops[opname]
        if (null == op) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const params = opParams(op)

        Content(`/**
 * @typedef {Object} ${typeName}
`)
        params.forEach((p: any) => {
          const key = false === p.reqd ? '[' + propKey(p.name) + ']' : propKey(p.name)
          Content(` * @property {${canonToType(p.type, LANG)}} ${key}
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
