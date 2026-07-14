
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
} from './utility_swift'


// Generates core/Config.swift: the SdkConfig enum holding the generated model
// config (makeConfig, materialised at runtime by parsing an embedded JSON
// literal - pure data, so a JSON round-trip is faithful and avoids emitting
// Value construction by hand) and the by-name feature factory (makeFeature).
// N-feature-safe: makeFeature emits a case per feature entry in the model.
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

  // Assemble the config object (pure JSON data).
  const featureConfigs: any = {}
  each(feature, (f: any) => {
    featureConfigs[f.name] = f.config || {}
  })

  const optionsEntity: any = {}
  each(entity, (ent: any) => {
    optionsEntity[ent.name] = {}
  })

  const entityDefs: any = {}
  each(entity, (ent: any) => {
    entityDefs[ent.name] = clean({
      fields: ent.fields,
      name: ent.name,
      op: ent.op,
      relations: ent.relations,
    })
  })

  const options: any = {
    base: baseUrl,
    headers,
    entity: optionsEntity,
  }
  if (authActive) {
    options.auth = { prefix: authPrefix }
  }

  const configObj = {
    main: { name: model.const.Name },
    feature: featureConfigs,
    options,
    entity: entityDefs,
  }

  // Model-data defaults may carry the ProjectName placeholder (e.g. the
  // clienttrack clientName); resolve it to the API name so the embedded JSON
  // matches the token-replaced runtime.
  const configJson = JSON.stringify(configObj, null, 2)
    .replace(/ProjectName/g, model.const.Name)

  File({ name: 'Config.' + target.ext }, () => {

    Content(`// ${model.const.Name} SDK - generated model configuration and feature
// factory. GENERATED from the API model - do not edit by hand.

import Foundation

public enum SdkConfig {
  public static func makeConfig() -> VMap {
    let json = #"""
${configJson}
"""#
    return (try? JSON.parse(json))?.asMap ?? VMap()
  }

  public static func makeFeature(_ name: String) -> BaseFeature {
    switch name {
`)

    each(feature, (f: any) => {
      const fname = f.name.charAt(0).toUpperCase() + f.name.slice(1)
      if (f.name !== 'base') {
        Content(`    case "${f.name}": return ${fname}Feature()
`)
      }
    })

    Content(`    default: return BaseFeature()
    }
  }
}
`)
  })
})


export {
  Config
}
