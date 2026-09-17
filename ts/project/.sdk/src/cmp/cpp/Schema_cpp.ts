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
  cppConfigLiterals,
} from './utility_cpp'


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// The cpp peer of src/cmp/ts/Schema_ts.ts. Same two members, same source:
// optspec from `main.kit.optspec` plus each feature's own `config.options`,
// entityspec from the entity field sentinels — both built by the shared
// helpers, so what cpp validates against and what ts validates against cannot
// drift.
//
// EMBEDDED AS JSON, PARSED AT LOAD, where ts emits an object literal: JSON is
// a subset of TypeScript's own literal syntax and is not a subset of cpp's.
// Chunked adjacent string literals, exactly as config.hpp carries its config,
// so no single literal approaches an implementation's minimum-supported
// length however large the model grows.
//
// This REPLACES the OPTSPEC_JSON() that used to sit in pipeline.hpp — a
// hand-maintained copy of the spec that nothing cross-checked, and which had
// already drifted (no `extend`, no `server`, no `auth.basic`).
//
// The round-trip is exact because the spec holds only strings and booleans:
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts.
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  // Beside config.hpp, in core, and for the same reason: core owns the
  // generated data, so nothing in utility or feature has to reach up for it.
  File({ name: 'schema.' + target.ext }, () => {

    Content(`// ${model.const.Name} SDK: generated schemas. Do not edit.
//
// Built from the model: \`main.kit.optspec\` and each feature's
// \`config.options\` for the option spec; entity \`fields[].type\` for the
// entity specs.

#ifndef SDK_CORE_SCHEMA_HPP
#define SDK_CORE_SCHEMA_HPP

#include "../core/struct.hpp"

namespace sdk {

inline const char* optspec_json() {
  return
${cppConfigLiterals(optspec)};
}

inline const char* entityspec_json() {
  return
${cppConfigLiterals(entityspec)};
}

// SHARED SPECS, the shape sharedConfig uses and for the same reasons: the
// spec is read on every client construction and never mutated, so a per-call
// parse would be pure waste. A function-local static in an inline function is
// one object across every translation unit, and its initialisation is
// thread-safe by the standard.
//
// The results are SHARED: treat them as read-only. makeOptions validates
// AGAINST the spec and writes into the options, never into the spec.
inline const Value& sharedOptspec() {
  static const Value shared = vs::parse_json(optspec_json());
  return shared;
}

inline const Value& sharedEntityspec() {
  static const Value shared = vs::parse_json(entityspec_json());
  return shared;
}

}  // namespace sdk

#endif  // SDK_CORE_SCHEMA_HPP
`)
  })
})


export {
  Schema
}
