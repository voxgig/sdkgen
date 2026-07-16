

// Typed-model generator (Scala target). Port of EntityTypes_java.ts /
// EntityTypes_py.ts.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits ONE file, core/<Name>Types.scala,
// holding an `object <Name>Types` with a nested `final case class` per active
// entity plus a request/match case class per active op.
//
// WHY A CONTAINER OBJECT: keeps the whole reference model in one file whatever
// the entity count and matches the java target's single-container layout
// (<Name>Types.java). Scala permits multiple top-level types per file, but a
// container object mirrors the JVM sibling and keeps the generated core/ dir
// tidy.
//
// TYPE CHOICE: reference `case class` types with BOXED (nullable) component
// types, NOT the wired runtime type. The generated ops take/return the loose
// object model (java.util.Map[String, Object] / Object), so these case classes
// are NOT wired into the op signatures — they are documentation/DX reference
// shapes a caller may use to describe a payload before converting it to a map.
// This mirrors the java target's reference records and the JS target's JSDoc
// typedefs (annotation only, no runtime effect). Emitting unused case classes
// is harmless — they compile and have no runtime effect.
//
// OPTIONAL FIELDS: every component is a boxed reference type, hence inherently
// nullable, so a `req:false` field/param needs no distinct rendering in Scala.
//
// canonToType has no `scala` column (it falls back to `any`), so map the
// canonical sentinels to real (boxed) Scala/JVM types locally, matching the
// ReadmeEntity / ReadmeRef mapping.
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

import { scalaPackage } from './utility_scala'


// Scala reserved words that cannot be a case-class parameter name.
const SCALA_KEYWORDS = new Set<string>([
  'abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'enum', 'export',
  'extends', 'false', 'final', 'finally', 'for', 'forSome', 'given', 'if',
  'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override',
  'package', 'private', 'protected', 'return', 'sealed', 'super', 'then',
  'this', 'throw', 'trait', 'true', 'try', 'type', 'val', 'var', 'while',
  'with', 'yield',
])


// A field/param name that has a safe Scala identifier rendering. Names that are
// not valid identifiers (hyphens, leading digits) have no clean parameter form
// and are skipped — they remain reachable via the runtime map.
function scalaIdent(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !SCALA_KEYWORDS.has(name)
}


// Map a canonical type sentinel to a real (boxed, nullable) Scala/JVM type.
function scalaType(type: any): string {
  const k = canonKey(type)
  if ('STRING' === k) return 'String'
  if ('INTEGER' === k) return 'java.lang.Long'
  if ('NUMBER' === k) return 'java.lang.Double'
  if ('BOOLEAN' === k) return 'java.lang.Boolean'
  if ('ARRAY' === k) return 'java.util.List[Object]'
  if ('OBJECT' === k) return 'java.util.Map[String, Object]'
  return 'Object'
}


// Emit a nested `final case class <typeName>(...)` from {name, type} items. An
// item whose name is not a legal identifier is skipped; a duplicate component
// name (after the identifier filter) is dropped. An empty case class is a
// valid, zero-parameter shape.
function emitCaseClass(typeName: string, items: any[]): void {
  const seen = new Set<string>()
  const usable = items.filter((it: any) => {
    if (!it || null == it.name || !scalaIdent(it.name) || seen.has(it.name)) {
      return false
    }
    seen.add(it.name)
    return true
  })

  if (0 === usable.length) {
    Content(`  final case class ${typeName}()

`)
    return
  }

  const params = usable
    .map((it: any) => `${it.name}: ${scalaType(it.type)}`)
    .join(', ')
  Content(`  final case class ${typeName}(${params})

`)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$
  const target = props.target || {}
  const ext = target.ext || 'scala'

  const scalapackage = props.scalapackage || scalaPackage(model)

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named (e.g. a fieldless placeholder) would otherwise read
  // `Name = undefined` below. Parity with the go/py/java/csharp emitter's fix.
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

  File({ name: model.const.Name + 'Types.' + ext }, () => {

    Content(`package ${scalapackage}.core

// Typed reference models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels (source of truth: @voxgig/apidef VALID_CANON). Do
// not edit by hand.
//
// These case classes are documentation/DX reference shapes ONLY. The SDK ops
// take and return the loose object model (java.util.Map[String, Object] /
// Object) at runtime, so these types are not wired into the op signatures —
// use them to describe a payload before converting it to a map. Every
// component is a boxed (nullable) type, so an optional (req:false) key needs
// no distinct rendering.

object ${model.const.Name}Types {

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one component per field.
      emitCaseClass(Name, fields.map((f: any) => ({
        name: f.name, type: f.type,
      })))

      // Per active op: a request/match case class. Members come from the shared
      // partiality policy (opRequestShape).
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)

        emitCaseClass(typeName, items)
      })
    })

    Content(`}
`)
  })
})


export {
  EntityTypes,
}
