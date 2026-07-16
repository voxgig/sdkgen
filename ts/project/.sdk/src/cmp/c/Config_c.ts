
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

    // The C target ships the full transport/observability feature set as
    // fixed runtime templates (tm/c/feature/*.c, declared in core/sdk.h), so
    // make_feature must dispatch to every shipped feature — not only those the
    // current API model happens to configure. Merge the model's feature names
    // with the standard shipped set; emit in sorted order for byte-stability.
    const SHIPPED_FEATURES = [
      'audit', 'cache', 'clienttrack', 'debug', 'idempotency', 'log',
      'metrics', 'netsim', 'paging', 'proxy', 'ratelimit', 'rbac', 'retry',
      'streaming', 'telemetry', 'test', 'timeout',
    ]
    const featureNames = new Set<string>(SHIPPED_FEATURES)
    each(feature, (f: any) => {
      if (f.name && f.name !== 'base') featureNames.add(f.name)
    })
    for (const fname of Array.from(featureNames).sort()) {
      Content(`  if (strcmp(name, "${fname}") == 0) return feature_${fname}_new();
`)
    }

    Content(`  return feature_base_new();
}
`)
  })
})


export {
  Config
}
