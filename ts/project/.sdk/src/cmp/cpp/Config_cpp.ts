
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
  cppConfigLiterals,
} from './utility_cpp'


// core/config.hpp: makeConfig() rebuilds the embedded API model by parsing a
// chunked JSON literal with the vendored struct parser; makeFeature(name) is
// the N-feature-safe by-name factory the client uses (mirrors Config_java /
// Config_go).
const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  const authPrefix = resolveAuthPrefix(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

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

  const entityConfig = Object.values(entity || {}).reduce((a: any, n: any) => (
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

  File({ name: 'config.' + target.ext }, () => {

    Content(`// Generated API configuration (mirrors Config_java / core/config.go).

#ifndef SDK_CORE_CONFIG_HPP
#define SDK_CORE_CONFIG_HPP

#include <memory>
#include <string>

#include "../core/struct.hpp"
#include "../core/types.hpp"
#include "../feature/base.hpp"
`)

    each(feature, (f: any) => {
      if (f.name !== 'base') {
        Content(`#include "../feature/${f.name}.hpp"
`)
      }
    })

    Content(`
namespace sdk {

inline const char* config_json() {
  return
${cppConfigLiterals(config)};
}

inline Value makeConfig() { return vs::parse_json(config_json()); }

inline FeaturePtr makeFeature(const std::string& name) {
`)

    each(feature, (f: any) => {
      const fname = f.name.charAt(0).toUpperCase() + f.name.slice(1)
      if (f.name !== 'base') {
        Content(`  if (name == "${f.name}") return std::make_shared<${fname}Feature>();
`)
      }
    })

    Content(`  return std::make_shared<BaseFeature>();
}

} // namespace sdk

#endif // SDK_CORE_CONFIG_HPP
`)
  })
})


export {
  Config
}
