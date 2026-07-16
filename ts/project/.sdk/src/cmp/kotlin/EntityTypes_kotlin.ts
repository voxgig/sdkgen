
// Typed-model generator (Kotlin target). Port of EntityTypes_java.ts /
// EntityTypes_py.ts.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits ONE file, core/<Name>Types.kt,
// holding a container `object <Name>Types` with a nested `data class` per
// active entity plus a request/match type per active op.
//
// WHY A CONTAINER OBJECT: parity with the java/csharp emitters — every
// generated reference type lives inside a single `object <Name>Types`, so the
// whole reference model is in one file (<Name>Types.kt) whatever the entity
// count. Kotlin has no one-public-type-per-file rule, but the single-file
// convention is kept for cross-language consistency.
//
// TYPE CHOICE: reference types with BOXED (nullable) component types, NOT the
// wired runtime type. The generated ops take/return the loose object model
// (MutableMap<String, Any?> / Any?), so these types are NOT wired into the op
// signatures — they are documentation/DX reference shapes a caller may use to
// describe a payload before converting it to a map. This mirrors the JS
// target's JSDoc typedefs (annotation only, no runtime effect). Emitting unused
// types is harmless — they compile and have no runtime effect.
//
// OPTIONAL FIELDS: every component is a nullable reference type, so a
// `req:false` field/param needs no distinct rendering in Kotlin.
//
// EMPTY SHAPES: Kotlin forbids a `data class` with zero components, so an
// empty shape is emitted as a plain marker `class <Name>` instead.
//
// canonToType has no `kotlin` column, so map the canonical sentinels to real
// Kotlin types locally, matching the ReadmeEntity / ReadmeRef mapping.
//
// Keep the SAME type-name scheme as every other language: <Name>,
// <Name>LoadMatch, <Name>ListMatch, <Name>CreateData, <Name>UpdateData,
// <Name>RemoveMatch (via the shared opTypeName helper).

import {
  cmp, each, names,
  File, Content,
} from '@voxgig/sdkgen'

import { canonKey, opTypeName, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { kotlinPackage } from './utility_kotlin'


// Kotlin hard keywords that cannot be a (non-escaped) property name.
const KOTLIN_KEYWORDS = new Set<string>([
  'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun',
  'if', 'in', 'interface', 'is', 'null', 'object', 'package', 'return',
  'super', 'this', 'throw', 'true', 'try', 'typealias', 'typeof', 'val',
  'var', 'when', 'while',
])


// A field/param name that has a safe Kotlin identifier rendering. Names that
// are not valid identifiers (hyphens, leading digits) have no clean component
// form and are skipped — they remain reachable via the runtime map.
function kotlinIdent(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !KOTLIN_KEYWORDS.has(name)
}


// Map a canonical type sentinel to a real (nullable) Kotlin type.
function kotlinType(type: any): string {
  const k = canonKey(type)
  if ('STRING' === k) return 'String?'
  if ('INTEGER' === k) return 'Long?'
  if ('NUMBER' === k) return 'Double?'
  if ('BOOLEAN' === k) return 'Boolean?'
  if ('ARRAY' === k) return 'List<Any?>?'
  if ('OBJECT' === k) return 'Map<String, Any?>?'
  return 'Any?'
}


// Emit a nested `data class <typeName>(...)` from {name, type} items. An item
// whose name is not a legal identifier is skipped; a duplicate component name
// (after the identifier filter) is dropped. An empty shape becomes a plain
// marker `class <typeName>` (Kotlin forbids a zero-component data class).
function emitRecord(typeName: string, items: any[]): void {
  const seen = new Set<string>()
  const usable = items.filter((it: any) => {
    if (!it || null == it.name || !kotlinIdent(it.name) || seen.has(it.name)) {
      return false
    }
    seen.add(it.name)
    return true
  })

  if (0 === usable.length) {
    Content(`  class ${typeName}

`)
    return
  }

  const params = usable
    .map((it: any) => `val ${it.name}: ${kotlinType(it.type)}`)
    .join(', ')
  Content(`  data class ${typeName}(${params})

`)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$
  const target = props.target || {}
  const ext = target.ext || 'kt'

  const kotlinpackage = props.kotlinpackage || kotlinPackage(model)

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named (e.g. a fieldless placeholder) would otherwise read
  // `Name = undefined` below. Parity with the go/py/csharp/java emitter's fix.
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

  File({ name: model.const.Name + 'Types.' + ext }, () => {

    Content(`package ${kotlinpackage}.core

// Typed reference models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels (source of truth: @voxgig/apidef VALID_CANON). Do
// not edit by hand.
//
// These types are documentation/DX reference shapes ONLY. The SDK ops take and
// return the loose object model (MutableMap<String, Any?> / Any?) at runtime,
// so these types are not wired into the op signatures — use them to describe a
// payload before converting it to a map. Every component is a nullable type, so
// an optional (req:false) key needs no distinct rendering.

@Suppress("unused")
object ${model.const.Name}Types {

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one component per field.
      emitRecord(Name, fields.map((f: any) => ({
        name: f.name, type: f.type,
      })))

      // Per active op: a request/match type. Members come from the shared
      // partiality policy (opRequestShape).
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)

        emitRecord(typeName, items)
      })
    })

    Content(`}
`)
  })
})


export {
  EntityTypes,
}
