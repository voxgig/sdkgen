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
  cStringLiteral,
} from './utility_c'


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// The c peer of src/cmp/ts/Schema_ts.ts. Same two members, same source:
// optspec from `main.kit.optspec` plus each feature's own `config.options`,
// entityspec from the entity field sentinels — both built by the shared
// helpers, so what c validates against and what ts validates against cannot
// drift.
//
// EMBEDDED AS JSON, PARSED AT LOAD, where ts emits an object literal: JSON is
// a subset of TypeScript's own literal syntax and is not a subset of c's. A
// string constant, exactly as config.c carries its data rep above the size
// threshold, and for the same reason — a nested `cmap(...)` literal is one
// expression whose depth is what makes a C compiler's parser and register
// allocator quadratic. The spec has no threshold of its own because it is
// bounded by the option list and the feature set rather than by the API.
//
// The round-trip is exact because the spec holds only strings and booleans:
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts.
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$

  const model: Model = ctx$.model
  const target = props.target

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  // Beside config.c, in core, and for the same reason: core owns the
  // generated data, so nothing in utility or feature has to reach up for it.
  // `core/*.c` is already on the Makefile's LIB_SRCS glob, so this file needs
  // no build wiring.
  File({ name: 'schema.c' }, () => {

    Content(`// ${model.const.Name} SDK: generated schemas. Do not edit.
//
// Built from the model: \`main.kit.optspec\` and each feature's
// \`config.options\` for the option spec; entity \`fields[].type\` for the
// entity specs.

#include "api.h"

static const char OPTSPEC_DATA[] =
${cStringLiteral(JSON.stringify(optspec))};

static const char ENTITYSPEC_DATA[] =
${cStringLiteral(JSON.stringify(entityspec))};

voxgig_value* make_optspec(void) {
  return json_parse(OPTSPEC_DATA);
}

voxgig_value* make_entityspec(void) {
  return json_parse(ENTITYSPEC_DATA);
}

// SHARED SPECS, the shape shared_config uses and for the same reasons: the
// spec is read on every client construction and never mutated, so a per-call
// parse would be pure waste. Deliberately never freed: they live for the life
// of the process, like any other program-lifetime singleton.
//
// The returned values are SHARED: treat them as read-only. make_options
// validates AGAINST the spec and writes into the options, never into the spec.
static voxgig_value* shared_optspec_val = NULL;
static voxgig_value* shared_entityspec_val = NULL;

voxgig_value* shared_optspec(void) {
  if (NULL == shared_optspec_val) {
    shared_optspec_val = make_optspec();
  }
  return shared_optspec_val;
}

voxgig_value* shared_entityspec(void) {
  if (NULL == shared_entityspec_val) {
    shared_entityspec_val = make_entityspec();
  }
  return shared_entityspec_val;
}
`)
  })
})


export {
  Schema
}
