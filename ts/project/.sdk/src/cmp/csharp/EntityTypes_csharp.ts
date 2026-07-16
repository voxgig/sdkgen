

// Typed-model generator (C# target). Port of EntityTypes_py.ts / EntityTypes_js.ts.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one file, core/<Name>Types.cs,
// with a `public record <Name>` per active entity plus a request/match record
// per active op.
//
// TYPE CHOICE: reference `record` types with nullable `init` properties, NOT
// the wired runtime type. The generated ops take/return the loose object model
// (`Dictionary<string, object?>` / `object?`), so these records are NOT wired
// into the op signatures — they are documentation/DX reference shapes a caller
// may use to describe a payload before converting it to a dictionary. This
// mirrors the JS target's JSDoc typedefs (annotation only, no runtime effect):
// C# has no annotation-only type, so a `record` is the closest zero-behaviour
// analogue. Emitting unused records is harmless — they compile and have no
// runtime effect.
//
// OPTIONAL FIELDS: a `req:false` field/param becomes a nullable property
// (`T?`), a required one the plain type (`T`). Nullability warnings for
// uninitialised required reference properties (CS8618) are already suppressed
// by the generated csproj, so no initialisation is forced.
//
// canonToType has no `csharp` column (it falls back to `any`), so map the
// canonical sentinels to real C# types locally, matching the ReadmeEntity /
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


const LANG = 'csharp'


// C# keywords that need the `@` verbatim prefix to be legal identifiers.
const CS_KEYWORDS = new Set<string>([
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch',
  'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default',
  'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit',
  'extern', 'false', 'finally', 'fixed', 'float', 'for', 'foreach',
  'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is',
  'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator',
  'out', 'override', 'params', 'private', 'protected', 'public',
  'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short', 'sizeof',
  'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe',
  'ushort', 'using', 'virtual', 'void', 'volatile', 'while',
])


// A field/param name that has a safe C# property rendering (valid identifier).
// Names that are not valid identifiers (hyphens, leading digits) have no clean
// property form and are skipped — they remain reachable via the runtime dict.
function csIdent(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
}


// A legal C# property identifier: keyword names get the `@` verbatim prefix.
function csProp(name: string): string {
  return CS_KEYWORDS.has(name) ? '@' + name : name
}


// Map a canonical type sentinel to a real C# type.
function csType(type: any): string {
  const k = canonKey(type)
  if ('STRING' === k) return 'string'
  if ('INTEGER' === k) return 'long'
  if ('NUMBER' === k) return 'double'
  if ('BOOLEAN' === k) return 'bool'
  if ('ARRAY' === k) return 'List<object?>'
  if ('OBJECT' === k) return 'Dictionary<string, object?>'
  return 'object?'
}


// Emit `public record <typeName>` from {name, type, optional} items. Optional
// items become nullable properties (`T?`); required items the plain type. An
// item whose name is not a legal identifier is skipped. An empty record is a
// valid, zero-member shape.
function emitRecord(typeName: string, items: any[]): void {
  const usable = items.filter((it: any) => it && null != it.name && csIdent(it.name))

  if (0 === usable.length) {
    Content(`public record ${typeName}();

`)
    return
  }

  Content(`public record ${typeName}
{
`)
  usable.forEach((it: any) => {
    const base = csType(it.type)
    // `object?` is already nullable; other types get a trailing `?` when optional.
    const t = it.optional && !base.endsWith('?') ? base + '?' : base
    Content(`    public ${t} ${csProp(it.name)} { get; init; }
`)
  })
  Content(`}

`)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$
  const target = props.target || {}
  const ext = target.ext || 'cs'

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named (e.g. a fieldless placeholder) would otherwise read
  // `Name = undefined` below. Parity with the go/py emitter's fix.
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

  File({ name: model.const.Name + 'Types.' + ext }, () => {

    Content(`// Typed reference models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels (source of truth: @voxgig/apidef VALID_CANON). Do
// not edit by hand.
//
// These records are documentation/DX reference shapes ONLY. The SDK ops take
// and return the loose object model (Dictionary<string, object?> / object?) at
// runtime, so these types are not wired into the op signatures — use them to
// describe a payload before converting it to a dictionary. Optional (req:false)
// keys are modelled as nullable properties.

namespace ${model.const.Name}Sdk.Types;

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one property per field, `req:false` -> nullable.
      emitRecord(Name, fields.map((f: any) => ({
        name: f.name, type: f.type, optional: false === f.req,
      })))

      // Per active op: a request/match record. Members and their optionality
      // come from the shared partiality policy (opRequestShape).
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
  })
})


export {
  EntityTypes,
}
