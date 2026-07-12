
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
  formatCsMap,
} from './utility_csharp'


// Generates core/Config.cs: the static SdkConfig class holding the
// generated model config (MakeConfig) and the by-name feature factory
// (MakeFeature). N-feature-safe: both are emitted per feature entry in the
// model, so any number of features works.
const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  const authBlock = authActive
    ? `                ["auth"] = new Dictionary<string, object?>
                {
                    ["prefix"] = "${authPrefix}",
                },\n`
    : ''

  File({ name: 'Config.' + target.ext }, () => {

    Content(`// ${model.const.Name} SDK - generated model configuration and feature
// factory. GENERATED from the API model - do not edit by hand.

namespace ${model.const.Name}Sdk;

public static class SdkConfig
{
    public static Dictionary<string, object?> MakeConfig()
    {
        return new Dictionary<string, object?>
        {
            ["main"] = new Dictionary<string, object?>
            {
                ["name"] = "${model.const.Name}",
            },
            ["feature"] = new Dictionary<string, object?>
            {
`)

    each(feature, (f: any) => {
      const fconfig = f.config || {}
      Content(`                ["${f.name}"] = ${formatCsMap(fconfig, 4)},
`)
    })

    Content(`            },
            ["options"] = new Dictionary<string, object?>
            {
                ["base"] = "${baseUrl}",
${authBlock}                ["headers"] = ${formatCsMap(headers, 4)},
                ["entity"] = new Dictionary<string, object?>
                {
`)

    each(entity, (ent: any) => {
      Content(`                    ["${ent.name}"] = new Dictionary<string, object?>(),
`)
    })

    Content(`                },
            },
            ["entity"] = ${formatCsMap(
      Object.values(entity).reduce((a: any, n: any) => (a[n.name] = clean({
        fields: n.fields,
        name: n.name,
        op: n.op,
        relations: n.relations,
      }), a), {}), 3)},
        };
    }

    public static Feature.BaseFeature MakeFeature(string name)
    {
        switch (name)
        {
`)

    each(feature, (f: any) => {
      const fname = f.name.charAt(0).toUpperCase() + f.name.slice(1)
      if (f.name !== 'base') {
        Content(`            case "${f.name}":
                return new Feature.${fname}Feature();
`)
      }
    })

    Content(`            default:
                return new Feature.BaseFeature();
        }
    }
}
`)
  })
})


export {
  Config
}
