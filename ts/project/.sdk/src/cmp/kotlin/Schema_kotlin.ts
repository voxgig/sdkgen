import {
  Content,
  File,
  cmp,
  entitySpecMap,
  optionSpec,
} from '@voxgig/sdkgen'


import {
  Model,
} from '@voxgig/apidef'


import {
  kotlinPackage,
  jsonAppendLines,
} from './utility_kotlin'


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// The kotlin peer of src/cmp/ts/Schema_ts.ts. Same two members, same source:
// optspec from `main.kit.optspec` plus each feature's own `config.options`,
// entityspec from the entity field sentinels — both built by the shared
// helpers, so what kotlin validates against and what ts validates against
// cannot drift.
//
// EMBEDDED AS JSON, PARSED AT LOAD, where ts emits an object literal: JSON is
// a subset of TypeScript's own literal syntax and is not a subset of
// kotlin's. Chunked StringBuilder appends, exactly as Config.kt carries its
// config, keep every string constant far below the JVM's 64KB limit no matter
// how many features or entities the model grows.
//
// The round-trip is exact because the spec holds only strings and booleans:
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts. That is not incidental — Json.parse decodes a
// JSON number to one kotlin type and struct reads a spec BY EXAMPLE, so one
// number in here would mean something different in kotlin than in ts.
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model
  const kotlinpackage = kotlinPackage(model)

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  // Beside Config.kt, and for the same reason: core owns the generated data,
  // so nothing in utility or feature has to reach up for it.
  File({ name: 'Schema.' + target.ext }, () => {

    Content(`package ${kotlinpackage}.core

import ${kotlinpackage}.utility.Json

/**
 * ${model.const.Name} ${target.Name} SDK: generated schemas. Do not edit.
 *
 * Generated from the model: \`main.kit.optspec\` and each feature's
 * \`config.options\` for the option spec; entity \`fields[].type\` for the
 * entity specs.
 */
@Suppress("UNCHECKED_CAST")
object Schema {

  // Parsed ONCE, on first use. The spec is read on every client construction
  // and never mutated, so a per-call parse would be pure waste — and a shared
  // map is safe for the same reason the spec is a constant: makeOptions
  // validates AGAINST it and writes into the options, never into the spec.
  //
  // 'by lazy' defaults to LazyThreadSafetyMode.SYNCHRONIZED, as
  // Config.sharedConfig uses, so concurrent first calls parse it exactly once.

  /** The option spec makeOptions validates client options against. */
  val optspec: MutableMap<String, Any?> by lazy {
    Json.parse(optspecJson()) as MutableMap<String, Any?>
  }

  /** Per-entity data and request specs, keyed by entity name. */
  val entityspec: MutableMap<String, Any?> by lazy {
    Json.parse(entityspecJson()) as MutableMap<String, Any?>
  }

  private fun optspecJson(): String {
    val b = StringBuilder()
`)

    Content(jsonAppendLines(optspec, 'b'))

    Content(`    return b.toString()
  }

  private fun entityspecJson(): String {
    val b = StringBuilder()
`)

    Content(jsonAppendLines(entityspec, 'b'))

    Content(`    return b.toString()
  }
}
`)
  })
})


export {
  Schema
}
