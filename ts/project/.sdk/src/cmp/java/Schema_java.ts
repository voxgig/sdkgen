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
  javaPackage,
  jsonAppendLines,
} from './utility_java'


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// The java peer of src/cmp/ts/Schema_ts.ts. Same two members, same source:
// OPTSPEC from `main.kit.optspec` plus each feature's own `config.options`,
// ENTITYSPEC from the entity field sentinels — both built by the shared
// helpers, so what java validates against and what ts validates against
// cannot drift.
//
// EMBEDDED AS JSON, PARSED AT LOAD, where ts emits an object literal: JSON is
// a subset of TypeScript's own literal syntax and is not a subset of java's.
// Chunked StringBuilder appends, exactly as Config.java carries its config,
// keep every string constant far below the JVM's 64KB limit no matter how
// many features or entities the model grows.
//
// The round-trip is exact because the spec holds only strings and booleans:
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts. That is not incidental — Json.parse decodes a
// JSON number to one java type and struct reads a spec BY EXAMPLE, so one
// number in here would mean something different in java than in ts.
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model
  const javapackage = javaPackage(model)

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  // Beside Config.java, and for the same reason: core owns the generated
  // data, so nothing in utility or feature has to reach up for it.
  File({ name: 'Schema.' + target.ext }, () => {

    Content(`package ${javapackage}.core;

import java.util.Map;

import ${javapackage}.utility.Json;

/**
 * ${model.const.Name} ${target.Name} SDK: generated schemas. Do not edit.
 *
 * <p>Generated from the model: {@code main.kit.optspec} and each feature's
 * {@code config.options} for OPTSPEC; entity {@code fields[].type} for
 * ENTITYSPEC.
 */
@SuppressWarnings({"unchecked"})
public final class Schema {

  private Schema() {}

  // Parsed ONCE, on first use. The spec is read on every client construction
  // and never mutated, so a per-call parse would be pure waste — and a shared
  // map is safe for the same reason the spec is a constant: MakeOptions
  // validates AGAINST it and writes into the options, never into the spec.
  //
  // Initialization-on-demand holder, as Config.sharedConfig uses: the JLS
  // guarantees the class initializer runs once, lazily, and safely under
  // concurrency, with no locking on the read path.
  private static final class OptHolder {
    static final Map<String, Object> VALUE =
        (Map<String, Object>) Json.parse(optspecJson());
  }

  private static final class EntityHolder {
    static final Map<String, Object> VALUE =
        (Map<String, Object>) Json.parse(entityspecJson());
  }

  /** The option spec MakeOptions validates client options against. */
  public static Map<String, Object> optspec() {
    return OptHolder.VALUE;
  }

  /** Per-entity data and request specs, keyed by entity name. */
  public static Map<String, Object> entityspec() {
    return EntityHolder.VALUE;
  }

  private static String optspecJson() {
    StringBuilder b = new StringBuilder();
`)

    Content(jsonAppendLines(optspec, 'b'))

    Content(`    return b.toString();
  }

  private static String entityspecJson() {
    StringBuilder b = new StringBuilder();
`)

    Content(jsonAppendLines(entityspec, 'b'))

    Content(`    return b.toString();
  }
}
`)
  })
})


export {
  Schema
}
