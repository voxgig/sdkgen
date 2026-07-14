
import {
  Content,
  File,
  cmp,
  each,
  isAuthActive,
  resolveAuthPrefix,
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
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  // Assemble the config shape (mirrors Config_go's emitted map).
  const featureConfig: Record<string, any> = {}
  each(feature, (f: any) => {
    featureConfig[f.name] = cleanModel(f.config || {})
  })

  const optionsEntity: Record<string, any> = {}
  each(entity, (ent: any) => {
    optionsEntity[ent.name] = {}
  })

  const options: Record<string, any> = {
    base: baseUrl,
  }
  if (authActive) {
    options.auth = { prefix: authPrefix }
  }
  options.headers = headers
  options.entity = optionsEntity

  const entityConfig = Object.values(entity).reduce((a: any, n: any) => (
    a[n.name] = cleanModel({
      fields: n.fields,
      name: n.name,
      op: n.op,
      relations: n.relations,
    }), a), {})

  const config = {
    main: { name: model.const.Name },
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
