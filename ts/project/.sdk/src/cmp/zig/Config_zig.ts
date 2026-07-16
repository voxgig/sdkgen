
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
  formatZigValue,
} from './utility_zig'


// core/config.zig: make_config() builds the embedded API model as a Value;
// make_feature(name) is the N-feature-safe factory the client uses to
// instantiate features named in the options (mirrors go/rust Config).
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

  File({ name: 'config.' + target.ext }, () => {

    Content(`// Generated API configuration (mirrors go/rust core/config).

const std = @import("std");
const h = @import("helpers.zig");
const types = @import("types.zig");
const Value = h.Value;
const Feature = types.Feature;

pub fn make_config() Value {
    return ${formatZigValue(config, 1)};
}

pub fn make_feature(name: []const u8) Feature {
`)

    // The factory must be able to instantiate any built-in feature by name,
    // not just the ones the current API model configures — a caller can enable
    // a shipped feature (e.g. netsim) purely through runtime options even when
    // the API def does not list it. The built-in set mirrors the feature
    // templates in tm/zig/feature/ (excluding `base`, the fallback, and
    // `support`, a helper module). Any model feature not already built in is
    // appended so bespoke features still resolve.
    const builtinFeatures = [
      'audit', 'cache', 'clienttrack', 'debug', 'idempotency', 'log',
      'metrics', 'netsim', 'paging', 'proxy', 'ratelimit', 'rbac',
      'retry', 'streaming', 'telemetry', 'test', 'timeout',
    ]

    const featureNames: string[] = [...builtinFeatures]
    each(feature, (f: any) => {
      if (f.name !== 'base' && !featureNames.includes(f.name)) {
        featureNames.push(f.name)
      }
    })

    featureNames.forEach((name: string) => {
      const fname = name.charAt(0).toUpperCase() + name.slice(1)
      Content(`    if (std.mem.eql(u8, name, "${name}")) return @import("../feature/${name}.zig").${fname}Feature.make();
`)
    })

    Content(`    return @import("../feature/base.zig").BaseFeature.make();
}
`)
  })
})


export {
  Config
}
