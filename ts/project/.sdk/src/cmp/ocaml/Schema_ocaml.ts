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
  ocamlString,
} from './utility_ocaml'


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// The ocaml peer of src/cmp/ts/Schema_ts.ts. Same two members, same source:
// optspec from `main.kit.optspec` plus each feature's own `config.options`,
// entityspec from the entity field sentinels — both built by the shared
// helpers, so what ocaml validates against and what ts validates against
// cannot drift.
//
// EMBEDDED AS JSON, PARSED AT LOAD, where ts emits an object literal: JSON is
// a subset of TypeScript's own literal syntax and is not a subset of ocaml's.
// A string constant read by `Sdk_json.json_read`, exactly as sdk_config.ml
// carries its data rep above the size threshold.
//
// COMPILE ORDER. ocaml links a fixed module list, and sdk_runtime.ml's
// make_options reads this, so sdk_schema.ml is named in RUNTIME (the
// Makefile) between sdk_helpers.ml and sdk_runtime.ml. It opens nothing of
// the SDK beyond Voxgig_struct and Sdk_json, so it cannot close a cycle.
//
// The round-trip is exact because the spec holds only strings and booleans:
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts. json_read yields `Num (float)` for any number,
// and struct reads a spec BY EXAMPLE, so one number in here would mean
// something different in ocaml than in ts.
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  File({ name: 'sdk_schema.' + target.ext }, () => {

    Content(`(* ${model.const.Name} SDK: generated schemas. Do not edit.
 *
 * Built from the model: main.kit.optspec and each feature's config.options
 * for the option spec; entity fields[].type for the entity specs.
 *
 * opt_spec_value () - the option spec make_options validates client options
 * against. entity_spec_value () - per-entity data and request specs, keyed by
 * entity name. Both parse once and memoise: the spec is read on every client
 * construction and never mutated, so a per-call parse would be pure waste.
 *
 * The returned values are SHARED: treat them as read-only. make_options
 * validates AGAINST the spec and writes into the options, never into it. *)

open Voxgig_struct

let optspec_data = "${ocamlString(JSON.stringify(optspec))}"

let entityspec_data = "${ocamlString(JSON.stringify(entityspec))}"

let optspec_memo : value option ref = ref None

let entityspec_memo : value option ref = ref None

let opt_spec_value () : value =
  match !optspec_memo with
  | Some v -> v
  | None ->
    let v = Sdk_json.json_read optspec_data in
    optspec_memo := Some v;
    v

let entity_spec_value () : value =
  match !entityspec_memo with
  | Some v -> v
  | None ->
    let v = Sdk_json.json_read entityspec_data in
    entityspec_memo := Some v;
    v
`)
  })
})


export {
  Schema
}
