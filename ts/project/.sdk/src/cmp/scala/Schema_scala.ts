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
  scalaPackage,
  jsonAppendLines,
} from './utility_scala'


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// The scala peer of src/cmp/ts/Schema_ts.ts. Same two members, same source:
// optspec from `main.kit.optspec` plus each feature's own `config.options`,
// entityspec from the entity field sentinels — both built by the shared
// helpers, so what scala validates against and what ts validates against
// cannot drift.
//
// EMBEDDED AS JSON, PARSED AT LOAD, where ts emits an object literal: JSON is
// a subset of TypeScript's own literal syntax and is not a subset of scala's.
// Chunked StringBuilder appends, exactly as Config.scala carries its config,
// keep every string constant far below the JVM's 64KB limit no matter how
// many features or entities the model grows.
//
// The round-trip is exact because the spec holds only strings and booleans:
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts. That is not incidental — Json.parse decodes a
// JSON number to one scala type and struct reads a spec BY EXAMPLE, so one
// number in here would mean something different in scala than in ts.
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model
  const scalapackage = scalaPackage(model)

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  // Beside Config.scala, and for the same reason: core owns the generated
  // data, so nothing in utility or feature has to reach up for it.
  File({ name: 'Schema.' + target.ext }, () => {

    Content(`package ${scalapackage}.core

import java.util.{Map => JMap}

import ${scalapackage}.utility.Json

// ${model.const.Name} ${target.Name} SDK: generated schemas. Do not edit.
//
// Generated from the model: \`main.kit.optspec\` and each feature's
// \`config.options\` for the option spec; entity \`fields[].type\` for the
// entity specs.
object Schema {

  // Parsed ONCE, on first use. The spec is read on every client construction
  // and never mutated, so a per-call parse would be pure waste - and a shared
  // map is safe for the same reason the spec is a constant: makeOptions
  // validates AGAINST it and writes into the options, never into the spec.
  //
  // A lazy val is initialised once, on first use, under a lock, as
  // Config.sharedConfig is, so concurrent first calls parse it exactly once.

  // The option spec makeOptions validates client options against.
  lazy val optspec: JMap[String, Object] =
    Json.parse(optspecJson()).asInstanceOf[JMap[String, Object]]

  // Per-entity data and request specs, keyed by entity name.
  lazy val entityspec: JMap[String, Object] =
    Json.parse(entityspecJson()).asInstanceOf[JMap[String, Object]]

  private def optspecJson(): String = {
    val b = new StringBuilder()
`)

    Content(jsonAppendLines(optspec, 'b'))

    Content(`    b.toString
  }

  private def entityspecJson(): String = {
    val b = new StringBuilder()
`)

    Content(jsonAppendLines(entityspec, 'b'))

    Content(`    b.toString
  }
}
`)
  })
})


export {
  Schema
}
