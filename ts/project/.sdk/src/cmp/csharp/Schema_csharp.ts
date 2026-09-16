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
  formatCsMap,
} from './utility_csharp'


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// The csharp peer of src/cmp/ts/Schema_ts.ts. Same two members, same source:
// Optspec from `main.kit.optspec` plus each feature's own `config.options`,
// Entityspec from the entity field sentinels — both built by the shared
// helpers, so what csharp validates against and what ts validates against
// cannot drift.
//
// A COLLECTION LITERAL, not embedded JSON, where go and the JVM targets
// parse a string. SdkConfig switches to a JSON constant above a size
// threshold because a large composite literal is slow for the compiler to
// bind and the JIT to run; the spec has no such spread. It is bounded by the
// option list and the feature set — a few hundred entries whatever the API
// looks like — and in C# the literal is also the SAFER rep: a `false` here
// stays `false` rather than arriving as a JsonElement to be mapped back, and
// the number ladder SdkConfig's ConfigValue exists to reproduce is a question
// the spec never asks (it holds only strings and booleans, pinned by "strings
// and booleans only" in ts/test/optspec.test.ts).
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  // Beside Config.cs, and for the same reason: core owns the generated data,
  // so nothing in the copied runtime has to reach up for it.
  File({ name: 'Schema.' + target.ext }, () => {

    Content(`// ${model.const.Name} SDK - generated schemas. GENERATED from the API model -
// do not edit by hand.
//
// Built from the model: \`main.kit.optspec\` and each feature's
// \`config.options\` for Optspec; entity \`fields[].type\` for Entityspec.

namespace ${model.const.Name}Sdk;

public static class SdkSchema
{
    // Built ONCE, on first use. The spec is read on every client construction
    // and never mutated, so rebuilding it per call would be pure waste — and
    // a shared dictionary is safe for the same reason the spec is a constant:
    // MakeOptions validates AGAINST it and writes into the options, never
    // into the spec.
    //
    // A static field initializer, so the CLR's type initializer gives the
    // once-only, thread-safe guarantee with no locking on the read path.

    /// <summary>The option spec MakeOptions validates client options against.</summary>
    public static readonly Dictionary<string, object?> Optspec =
        ${formatCsMap(optspec, 2)};

    /// <summary>Per-entity data and request specs, keyed by entity name.</summary>
    public static readonly Dictionary<string, object?> Entityspec =
        ${formatCsMap(entityspec, 2)};
}
`)
  })
})


export {
  Schema
}
