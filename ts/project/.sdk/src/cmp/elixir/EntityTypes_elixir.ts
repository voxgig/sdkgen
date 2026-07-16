

// Typed-model generator (Elixir target). Port of EntityTypes_ts.ts / _rb.ts.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one module, lib/<app>_types.ex,
// holding an `@type` alias per active entity plus a request/match type per
// active op, each with a `@typedoc` documenting its concrete members.
//
// TYPE CHOICE: the SDK carries data as string-keyed struct value nodes, and
// Elixir map typespecs cannot pin individual string keys (only
// `optional(String.t()) => v`), so every alias resolves to an open string-keyed
// map `%{optional(String.t()) => any()}`. The precise per-member shape is
// documented in the accompanying @typedoc (the honest Elixir analogue of the
// TS interface / rb Struct). Field/param sentinels ($STRING, $INTEGER, ...) are
// turned into real Elixir typespec fragments (String.t(), integer(), ...) by
// the SDK-local `elixirType` helper.
//
// Op type-name scheme mirrors every other language (snake_cased for Elixir):
//   <ename>, <ename>_load_match, <ename>_list_match, <ename>_create_data,
//   <ename>_update_data, <ename>_remove_match.

import {
  cmp, each, names,
  File, Folder, Content,
} from '@voxgig/sdkgen'

import { opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { elixirType } from './utility_elixir'


// Op -> snake_case type-name suffix (mirrors opShape OP_SUFFIX).
const OP_SUFFIX: Record<string, string> = {
  load: 'load_match',
  list: 'list_match',
  remove: 'remove_match',
  create: 'create_data',
  update: 'update_data',
}


// Emit one `@typedoc` + `@type` alias. The alias is always an open
// string-keyed map; the members are documented in the doc block.
function emitType(
  typeName: string,
  doc: string,
  members: Array<{ name: string, type: unknown, optional: boolean }>,
): void {
  let block = `  @typedoc """\n  ${doc}\n`

  if (0 < members.length) {
    block += `\n  Members:\n`
    members.forEach((m) => {
      const req = m.optional ? ' (optional)' : ' (required)'
      block += `    * \`"${m.name}"\` — ${elixirType(m.type)}${req}\n`
    })
  }

  block += `  """\n  @type ${typeName} :: %{optional(String.t()) => any()}\n\n`

  Content(block)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$

  const Name = model.const.Name
  const app = model.const.name.toLowerCase()

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named would otherwise read `Name = undefined` below.
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

  Folder({ name: 'lib' }, () => {
    File({ name: app + '_types.ex' }, () => {

      Content(`# Typed models for the ${Name} SDK.
#
# GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
# params (op.<name>.points[].args.params[]). Member types come from the
# canonical type sentinels. The SDK carries data as string-keyed struct value
# nodes, so each alias is an open string-keyed map; the @typedoc member lists
# document the concrete shapes. Do not edit by hand.

defmodule ${Name}.Types do
  @moduledoc """
  Documented shapes for the ${Name} SDK entities and operation payloads.

  Every alias resolves to an open string-keyed map because the SDK carries
  data as string-keyed struct value nodes; consult each type's member list for
  the concrete field/param types.
  """

`)

      entityList.forEach((ent: any) => {
        const EName = ent.Name
        const ename = ent.name
        const fields = (ent.fields ? each(ent.fields) : [])
          .filter((f: any) => f.active !== false)

        // Entity data model: one member per field (`req:false` -> optional).
        emitType(
          ename,
          `${EName} entity data model.`,
          fields.map((f: any) => ({ name: f.name, type: f.type, optional: false === f.req })),
        )

        // Per active op: a request/match type. Members and their optionality
        // come from the shared partiality policy (opRequestShape).
        const ops = ent.op || {}
        ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
          if (null == ops[opname]) {
            return
          }

          const typeName = ename + '_' + OP_SUFFIX[opname]
          const { items } = opRequestShape(ent, opname)

          emitType(
            typeName,
            `Request payload for ${EName} ${opname}.`,
            items,
          )
        })
      })

      Content(`end
`)
    })
  })
})


export {
  EntityTypes,
}
