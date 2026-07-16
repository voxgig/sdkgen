

// Typed-model generator (Java target). Port of EntityTypes_py.ts /
// EntityTypes_csharp.ts.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits ONE file, core/<Name>Types.java,
// holding a container class with a nested `public record` per active entity
// plus a request/match record per active op.
//
// WHY A CONTAINER CLASS: Java permits only ONE public top-level type per file
// (the file name must match it), so — unlike C# which emits many top-level
// records — every generated record is a nested (implicitly static) member of a
// single `public final class <Name>Types`. This keeps the whole reference model
// in one file whatever the entity count.
//
// TYPE CHOICE: reference `record` types with BOXED (nullable) component types,
// NOT the wired runtime type. The generated ops take/return the loose object
// model (`Map<String, Object>` / `Object`), so these records are NOT wired into
// the op signatures — they are documentation/DX reference shapes a caller may
// use to describe a payload before converting it to a map. This mirrors the JS
// target's JSDoc typedefs (annotation only, no runtime effect). Emitting unused
// records is harmless — they compile and have no runtime effect.
//
// OPTIONAL FIELDS: every component is a boxed reference type, hence inherently
// nullable, so a `req:false` field/param needs no distinct rendering in Java.
//
// canonToType has no `java` column (it falls back to `any`), so map the
// canonical sentinels to real Java types locally, matching the ReadmeEntity /
// ReadmeRef mapping.
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

import { javaPackage } from './utility_java'


// Java keywords + reserved literals that cannot be a record component name.
const JAVA_KEYWORDS = new Set<string>([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while',
  'true', 'false', 'null', 'var', 'record', 'yield',
])


// A field/param name that has a safe Java identifier rendering. Names that are
// not valid identifiers (hyphens, leading digits) have no clean component form
// and are skipped — they remain reachable via the runtime map.
function javaIdent(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && !JAVA_KEYWORDS.has(name)
}


// Map a canonical type sentinel to a real (boxed, nullable) Java type.
function javaType(type: any): string {
  const k = canonKey(type)
  if ('STRING' === k) return 'String'
  if ('INTEGER' === k) return 'Long'
  if ('NUMBER' === k) return 'Double'
  if ('BOOLEAN' === k) return 'Boolean'
  if ('ARRAY' === k) return 'List<Object>'
  if ('OBJECT' === k) return 'Map<String, Object>'
  return 'Object'
}


// Emit a nested `public record <typeName>(...)` from {name, type} items. An
// item whose name is not a legal identifier is skipped; a duplicate component
// name (after the identifier filter) is dropped. An empty record is a valid,
// zero-component shape.
function emitRecord(typeName: string, items: any[]): void {
  const seen = new Set<string>()
  const usable = items.filter((it: any) => {
    if (!it || null == it.name || !javaIdent(it.name) || seen.has(it.name)) {
      return false
    }
    seen.add(it.name)
    return true
  })

  if (0 === usable.length) {
    Content(`  public record ${typeName}() {}

`)
    return
  }

  const params = usable
    .map((it: any) => `${javaType(it.type)} ${it.name}`)
    .join(', ')
  Content(`  public record ${typeName}(${params}) {}

`)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$
  const target = props.target || {}
  const ext = target.ext || 'java'

  const javapackage = props.javapackage || javaPackage(model)

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named (e.g. a fieldless placeholder) would otherwise read
  // `Name = undefined` below. Parity with the go/py/csharp emitter's fix.
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

  File({ name: model.const.Name + 'Types.' + ext }, () => {

    Content(`package ${javapackage}.core;

// Typed reference models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels (source of truth: @voxgig/apidef VALID_CANON). Do
// not edit by hand.
//
// These records are documentation/DX reference shapes ONLY. The SDK ops take
// and return the loose object model (Map<String, Object> / Object) at runtime,
// so these types are not wired into the op signatures — use them to describe a
// payload before converting it to a map. Every component is a boxed (nullable)
// type, so an optional (req:false) key needs no distinct rendering.

import java.util.List;
import java.util.Map;

public final class ${model.const.Name}Types {

  private ${model.const.Name}Types() {}

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one component per field.
      emitRecord(Name, fields.map((f: any) => ({
        name: f.name, type: f.type,
      })))

      // Per active op: a request/match record. Members come from the shared
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
