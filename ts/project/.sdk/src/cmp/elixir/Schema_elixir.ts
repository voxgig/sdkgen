import {
  Content,
  File,
  Folder,
  cmp,
  entitySpecMap,
  optionSpec,
} from '@voxgig/sdkgen'


import {
  Model,
} from '@voxgig/apidef'


import {
  elixirString,
} from './utility_elixir'


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// The elixir peer of src/cmp/ts/Schema_ts.ts. Same two exports, same source —
// OPTSPEC from `main.kit.optspec` plus each feature's own `config.options`,
// ENTITYSPEC from the entity field sentinels — built by the shared helpers,
// so what elixir validates against and what ts validates against cannot
// drift.
//
// EMBEDDED AS JSON IN A MODULE ATTRIBUTE, PARSED AT COMPILE TIME, exactly as
// config.ex carries the model. `elixirString` escapes every `#` for the
// reason recorded there: elixir interpolates `#{...}` inside a double-quoted
// string, so an unescaped one would be evaluated as code rather than emitted
// as text.
//
// The round-trip is exact because the spec holds only strings and booleans —
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts.
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model
  const Name = model.const.Name

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  // UNDER lib/, like config.ex and for a reason that bites immediately: mix's
  // `elixirc_paths` is ["lib"] (plus test/ under :test), so a module at the
  // SDK ROOT is never compiled. This file used to be emitted there, and
  // `Schema.optspec/0` was therefore undefined in every generated elixir SDK
  // — make_options raised UndefinedFunctionError on the first client
  // construction. The elixir compile lane skips where no toolchain is
  // installed, so nothing caught it.
  Folder({ name: 'lib' }, () => {

  File({ name: 'schema.ex' }, () => {
    Content(`# ${Name} ${target.Name} SDK: generated schemas. Do not edit.
#
# Generated from the model: \`main.kit.optspec\` and each feature's
# \`config.options\` for OPTSPEC; entity \`fields[].type\` for ENTITYSPEC.

defmodule ${Name}.Schema do
  @optspec_data ${elixirString(JSON.stringify(optspec))}

  @entityspec_data ${elixirString(JSON.stringify(entityspec))}

  # Parsed at COMPILE time and held as a literal: the spec is read on every
  # client construction and never mutated, so parsing per call would be pure
  # waste, and elixir terms are immutable so sharing carries no risk at all.
  @optspec ${Name}.Json.parse(@optspec_data)

  @entityspec ${Name}.Json.parse(@entityspec_data)

  def optspec, do: @optspec

  def entityspec, do: @entityspec
end
`)
  })

  })
})


export {
  Schema
}
