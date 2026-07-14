
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
  clean,
  formatCValue,
} from './utility_c'


// core/config.c: make_config() builds the embedded API model as a Value;
// make_feature(name) is the N-feature-safe factory the client uses to
// instantiate features named in the options (mirrors Config_rust).
const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  const authPrefix = resolveAuthPrefix(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  const featureConfig: any = {}
  each(feature, (f: any) => {
    featureConfig[f.name] = f.config || {}
  })

  const entityOptions: any = {}
  each(entity, (ent: any) => {
    entityOptions[ent.name] = {}
  })

  const options: any = {
    base: baseUrl,
    headers,
    entity: entityOptions,
  }
  if (authActive) {
    options.auth = { prefix: authPrefix }
  }

  const entityConfig = Object.values(entity || {}).reduce((a: any, n: any) => (
    a[n.name] = clean({
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

  File({ name: 'config.c' }, () => {

    Content(`// Generated API configuration (mirrors core/config.go).

#include "api.h"

#include <string.h>

voxgig_value* make_config(void) {
  return ${formatCValue(config, 1)};
}

Feature* make_feature(const char* name) {
`)

    each(feature, (f: any) => {
      if (f.name !== 'base') {
        Content(`  if (strcmp(name, "${f.name}") == 0) return feature_${f.name}_new();
`)
      }
    })

    Content(`  return feature_base_new();
}
`)
  })
})


export {
  Config
}
