
import {
  Content,
  File,
  cmp,
  configDefinition,
  each,
  isAuthActive,
  resolveAuthPrefix,
  targetFeatures,
} from '@voxgig/sdkgen'


import {
  serverVariables,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
} from '@voxgig/apidef'


import {
  cleanModel,
  javaPackage,
  jsonAppendLines,
} from './utility_java'


// Generates core/Config.java: the static SDK configuration (makeConfig)
// and the by-name feature factory (makeFeature). The config itself is
// emitted as JSON chunks parsed at runtime by utility/Json.java — chunked
// appends keep every string constant far below the JVM 64KB limit no
// matter how large the API model grows (N-feature/N-entity safe).
const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model
  const javapackage = javaPackage(model)

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Gated by the applicability tags, so this target never imports or
  // registers a feature it has no source for. One rule, one place:
  // helpers/applicability.
  const feature = targetFeatures(model, target)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  // Identity comes from configDefinition's def, not re-derived here, so
  // this target cannot disagree with the shared emitter on main.slug /
  // main.version / main.target (the three station descriptor fields,
  // station design §4) — passing target.name is what opts this target in.
  const { def: configDef } = configDefinition(model, target.name)

  // Assemble the config shape (mirrors Config_go's emitted map). The
  // feature block comes from configDefinition's def, not from f.config,
  // so it carries each feature's `transport` role (station design §8.4)
  // beside its options and cannot drift from the shared emitter.
  const featureConfig: Record<string, any> = {}
  each(feature, (f: any) => {
    featureConfig[f.name] = cleanModel(configDef.feature[f.name] || {})
  })

  const optionsEntity: Record<string, any> = {}
  each(entity, (ent: any) => {
    optionsEntity[ent.name] = {}
  })

  const options: Record<string, any> = {
    base: baseUrl,
  }

  // Templated server URL: emit the spec's server-variable defaults so the
  // runtime can substitute {name} placeholders in base (see MakeOptions).
  // Without this block the placeholder reaches the wire verbatim — java
  // shipped `http://host/api/{account_id}/element` as a real URL, which is
  // worse than the construction error every other target raises.
  const svars = serverVariables(model)
  if (0 < svars.length) {
    options.server = svars.reduce(
      (a: any, v: any) => (a[v.name] = v.dflt, a), {} as Record<string, string>)
  }

  if (authActive) {
    options.auth = { prefix: authPrefix }
  }
  options.headers = headers
  options.entity = optionsEntity

  // configDefinition's `def.entity` verbatim, NOT rebuilt here. This reduce
  // was one of fourteen copies of that function's entityDefs loop, and when
  // configDefinition started reconstructing a point's `parts` from apidef's
  // segment vector (its ADR-003), only the copies that read `configDef` got
  // it — this target's literal config emitted paths with no parts at all
  // while its data config had them. One rule, one place.
  const entityConfig = configDef.entity

  const config = {
    main: configDef.main,
    feature: featureConfig,
    options,
    entity: entityConfig,
  }

  // Config lives in the core package alongside the client.
  File({ name: 'Config.' + target.ext }, () => {

    Content(`package ${javapackage}.core;

import java.util.Map;

import ${javapackage}.utility.Json;

/** Static SDK configuration and by-name feature construction. */
@SuppressWarnings({"unchecked"})
public final class Config {

  private Config() {}

  public static Map<String, Object> makeConfig() {
    return (Map<String, Object>) Json.parse(configJson());
  }

  // SHARED CONFIG (sdkgen rung L2).
  //
  // The SDK reads the config on every request and never writes to it, so one
  // instance is shared by every client rather than rebuilt per client - the
  // difference between parsing the embedded JSON once and once per client.
  //
  // Initialization-on-demand holder: the JLS guarantees the class initializer
  // runs once, lazily, and safely under concurrency, with no locking on the
  // read path.
  private static final class SharedHolder {
    static final Map<String, Object> VALUE = makeConfig();
  }

  // The process-wide config, built once on first use.
  //
  // The returned map is SHARED: treat it as read-only. Callers that need to
  // mutate should use makeConfig, which always parses a fresh copy.
  public static Map<String, Object> sharedConfig() {
    return SharedHolder.VALUE;
  }

  public static Feature makeFeature(String name) {
    switch (name) {
`)

    each(feature, (f: any) => {
      const fname = f.name.charAt(0).toUpperCase() + f.name.slice(1)
      if (f.name !== 'base') {
        Content(`      case "${f.name}":
        return new ${javapackage}.feature.${fname}Feature();
`)
      }
    })

    Content(`      default:
        return new ${javapackage}.feature.BaseFeature();
    }
  }

  private static String configJson() {
    StringBuilder b = new StringBuilder();
`)

    Content(jsonAppendLines(config, 'b'))

    Content(`    return b.toString();
  }
}
`)
  })
})


export {
  Config
}
