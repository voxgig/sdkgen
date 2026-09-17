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
  cljStringChunks,
} from './utility_clojure'


// THE GENERATED SCHEMA NAMESPACE: the model's schemas, as data the SDK runs.
//
// The clojure peer of src/cmp/ts/Schema_ts.ts. Same source — OPTSPEC from
// `main.kit.optspec` plus each feature's own `config.options`, ENTITYSPEC
// from the entity field sentinels — built by the shared helpers, so what
// clojure validates against and what ts validates against cannot drift.
//
// DATA ONLY, AND THAT IS STRUCTURAL. This namespace requires nothing and
// exposes the raw JSON strings; `sdk.core` parses them. The parse it would
// otherwise call, `json-parse`, is defined in sdk.core itself — and sdk.core
// is what reads the spec — so a schema ns that required core to parse its own
// data would close a require cycle. Holding the strings here and parsing
// there is the only arrangement that does not.
//
// Chunked the way config.clj chunks its model: the JVM caps a string literal
// at 64KB, so `cljStringChunks` splits and `str` rejoins at load.
//
// The round-trip is exact because the spec holds only strings and booleans —
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts.
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  const chunks = (json: string) =>
    cljStringChunks(json).map((c: string) => JSON.stringify(c)).join('\n       ')

  File({ name: 'schema.clj' }, () => {
    Content(`;; ${model.const.Name} ${target.Name} SDK: generated schemas. Do not edit.
;;
;; Generated from the model: main.kit.optspec and each feature's
;; config.options for the option spec; entity fields[].type for the entity
;; specs. Parsed by sdk.core — see the note in Schema_clojure.ts for why the
;; parse cannot live here.
(ns sdk.schema)

(def optspec-data
  (str ${chunks(JSON.stringify(optspec))}))

(def entityspec-data
  (str ${chunks(JSON.stringify(entityspec))}))
`)
  })
})


export {
  Schema
}
