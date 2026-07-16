

// Typed-model generator (C++ target). Port of EntityTypes_ts.ts / _py.ts.
//
// The C++ SDK runtime is fully DYNAMIC: every op takes and returns the
// JSON-like sdk::Value, so — unlike a statically typed target — there are no
// generated structs the runtime consumes. This module emits a DOCUMENTATION
// header, <sdk>_types.hpp, describing the shape of each entity and its per-op
// request/match payloads as plain C++ structs in a dedicated `sdk::types`
// namespace. They are convenience/reference types a consumer MAY use to model
// payloads; the SDK itself neither includes nor requires this header, so it is
// safe (it cannot affect the runtime or the test build).
//
// Field/param sentinels ($STRING, $INTEGER, ...) map to concrete C++ types via
// a local table (the shared canonToType has no C++ column). Object/array/any
// surface as the dynamic sdk::Value. Optional (req:false) members are marked
// with a trailing `// optional` comment — a struct member is always present in
// C++, so key-optionality is documented rather than encoded.
//
// Keep the SAME type-name scheme as every other language: <Name>,
// <Name>LoadMatch, <Name>ListMatch, <Name>CreateData, <Name>UpdateData,
// <Name>RemoveMatch (via the shared opTypeName helper).

import {
  cmp, each, names,
  File, Content,
  canonKey, opTypeName, opRequestShape,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// Map a canonical type sentinel to a concrete C++ type. Array/object/any
// surface as the dynamic sdk::Value (the runtime type).
function cppType(type: any): string {
  const k = canonKey(type)
  if ('STRING' === k) return 'std::string'
  if ('INTEGER' === k) return 'int64_t'
  if ('NUMBER' === k) return 'double'
  if ('BOOLEAN' === k) return 'bool'
  if ('ARRAY' === k) return 'std::vector<Value>'
  return 'Value'
}


// A valid C++ identifier for a struct member; non-identifier field names have
// no safe struct-member rendering, so they are skipped (still reachable via the
// runtime Value map).
function cppIdent(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
}


// Emit a struct named `typeName` from a list of {name, type, optional} items.
function emitStruct(typeName: string, items: any[]): void {
  const usable = items.filter((it: any) => it && null != it.name && cppIdent(it.name))

  if (0 === usable.length) {
    Content(`struct ${typeName} {};

`)
    return
  }

  Content(`struct ${typeName} {
`)
  usable.forEach((it: any) => {
    const opt = it.optional ? '  // optional' : ''
    Content(`  ${cppType(it.type)} ${it.name};${opt}
`)
  })
  Content(`};

`)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$
  const target = props.target || {}
  const ext = target.ext || 'hpp'

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)
  // Derive the PascalCase Name up-front — it is set LAZILY by names().
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

  const guard = 'SDK_' + model.const.Name.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_TYPES_HPP'

  File({ name: model.const.Name.toLowerCase() + '_types.' + ext }, () => {

    Content(`// Typed reference models for the ${model.const.Name} SDK (C++).
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params. The C++ SDK runtime is Value-based, so these structs are
// DOCUMENTATION / convenience types only — the SDK neither includes nor
// requires this header. Object/array/any fields surface as sdk::Value.
// Optional (req:false) members are flagged with a trailing "// optional"
// comment. Do not edit by hand.

#ifndef ${guard}
#define ${guard}

#include <cstdint>
#include <string>
#include <vector>

#include "core/types.hpp"

namespace sdk {
namespace types {

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one member per field, `req:false` -> optional.
      emitStruct(Name, fields.map((f: any) => ({
        name: f.name, type: f.type, optional: false === f.req,
      })))

      // Per active op: a request/match type. Members and their optionality
      // come from the shared partiality policy (opRequestShape).
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }
        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)
        emitStruct(typeName, items)
      })
    })

    Content(`} // namespace types
} // namespace sdk

#endif // ${guard}
`)
  })
})


export {
  EntityTypes,
}
