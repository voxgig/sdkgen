
// Typed-model generator (Dart target). Port of EntityTypes_ts.ts.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one file,
// lib/<Sdk>Types.dart, with a Dart class per active entity plus a
// request/match class per active op. Field/param sentinels ($STRING,
// $INTEGER, ...) are turned into Dart types locally (Dart is not in the
// shared canonToType table); the sentinel key comes from the shared
// canonKey helper so the source of truth (@voxgig/apidef VALID_CANON) is
// respected.
//
// TYPE CHOICE: plain classes with nullable fields + fromMap/toMap. The
// generated ops accept/return runtime maps (Dart has no structural typing),
// so these classes are the documented, convertible view of those maps —
// mirroring the Python target's TypedDict approach at the level Dart
// allows. Keep the SAME type-name scheme as every other language: <Name>,
// <Name>LoadMatch, <Name>ListMatch, <Name>CreateData, <Name>UpdateData,
// <Name>RemoveMatch.

import {
  cmp, each, names,
  File, Content,
} from '@voxgig/sdkgen'

import { canonKey, opTypeName, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// Sentinel -> Dart type (nullable added at emission).
const DART_TYPE: Record<string, string> = {
  STRING: 'String',
  INTEGER: 'int',
  NUMBER: 'num',
  BOOLEAN: 'bool',
  NULL: 'Object',
  ARRAY: 'List<dynamic>',
  OBJECT: 'Map<String, dynamic>',
  ANY: 'dynamic',
}

function dartType(sentinel: unknown): string {
  return DART_TYPE[canonKey(sentinel)] ?? 'dynamic'
}


// Dart reserved words that cannot be used as field names.
const DART_KEYWORDS = new Set([
  'assert', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'default', 'do', 'else', 'enum', 'extends', 'false', 'final', 'finally',
  'for', 'if', 'in', 'is', 'new', 'null', 'rethrow', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'var', 'void', 'while', 'with',
])


// A name usable as a Dart field (valid identifier, not a keyword, public).
function dartIdent(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && !DART_KEYWORDS.has(name)
}


// Emit a Dart data class from a list of {name, type, optional} items. All
// fields are nullable (`optional` is documented) since the runtime passes
// partial maps; fromMap is lenient (mismatched value types become null).
function emitClass(typeName: string, items: any[]): void {
  const usable = items.filter((it: any) => it && null != it.name && dartIdent(it.name))

  Content(`class ${typeName} {
`)
  usable.forEach((it: any) => {
    const base = dartType(it.type)
    const t = 'dynamic' === base ? 'dynamic' : base + '?'
    const req = it.optional ? '' : ' (required at the API)'
    Content(`  /// ${canonKey(it.type) || 'ANY'}${req}
  ${t} ${it.name};
`)
  })

  if (0 === usable.length) {
    Content(`  ${typeName}();

  factory ${typeName}.fromMap(Map<String, dynamic> m) => ${typeName}();

  Map<String, dynamic> toMap() => <String, dynamic>{};
`)
  }
  else {
    Content(`
  ${typeName}({
`)
    usable.forEach((it: any) => {
      Content(`    this.${it.name},
`)
    })
    Content(`  });

  factory ${typeName}.fromMap(Map<String, dynamic> m) => ${typeName}(
`)
    usable.forEach((it: any) => {
      const base = dartType(it.type)
      if ('dynamic' === base) {
        Content(`        ${it.name}: m['${it.name}'],
`)
      }
      else {
        Content(`        ${it.name}: m['${it.name}'] is ${base} ? m['${it.name}'] : null,
`)
      }
    })
    Content(`      );

  Map<String, dynamic> toMap() {
    final m = <String, dynamic>{};
`)
    usable.forEach((it: any) => {
      Content(`    if (null != ${it.name}) {
      m['${it.name}'] = ${it.name};
    }
`)
    })
    Content(`    return m;
  }
`)
  }

  Content(`}

`)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named (e.g. a fieldless placeholder) would otherwise read
  // `Name = undefined` below. Parity with the go emitter's fix.
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

  File({ name: model.const.Name + 'Types.' + target.ext }, () => {

    Content(`// Typed models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels (source of truth: @voxgig/apidef VALID_CANON).
// Do not edit by hand.
//
// The operation pipeline passes plain maps; these classes are the typed,
// convertible view: \`${model.const.Name}.fromMap(ent.data())\` / \`model.toMap()\`.

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one field per model field, `req:false` -> optional.
      emitClass(Name, fields.map((f: any) => ({
        name: f.name,
        type: f.type,
        optional: false === f.req,
      })))

      // Per active op: a request/match type. The members and each member's
      // required/optional decision come from the shared partiality policy
      // (opRequestShape); this file only renders them as a Dart class.
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)

        emitClass(typeName, items)
      })
    })
  })
})


export {
  EntityTypes,
}
