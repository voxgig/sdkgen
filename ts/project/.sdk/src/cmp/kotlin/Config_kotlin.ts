
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
  kotlinPackage,
  jsonAppendLines,
} from './utility_kotlin'


// Generates core/Config.kt: the static SDK configuration (makeConfig) and the
// by-name feature factory (makeFeature). The config itself is emitted as JSON
// chunks parsed at runtime by utility/Json.kt — chunked appends keep every
// string constant far below the JVM 64KB limit (N-feature/N-entity safe).
const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model
  const kotlinpackage = kotlinPackage(model)

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

  File({ name: 'Config.' + target.ext }, () => {

    Content(`package ${kotlinpackage}.core

import ${kotlinpackage}.utility.Json

/** Static SDK configuration and by-name feature construction. */
@Suppress("UNCHECKED_CAST")
object Config {

  fun makeConfig(): MutableMap<String, Any?> {
    return Json.parse(configJson()) as MutableMap<String, Any?>
  }

  fun makeFeature(name: String): Feature {
    return when (name) {
`)

    each(feature, (f: any) => {
      const fname = f.name.charAt(0).toUpperCase() + f.name.slice(1)
      if (f.name !== 'base') {
        Content(`      "${f.name}" -> ${kotlinpackage}.feature.${fname}Feature()
`)
      }
    })

    Content(`      else -> ${kotlinpackage}.feature.BaseFeature()
    }
  }

  private fun configJson(): String {
    val b = StringBuilder()
`)

    Content(jsonAppendLines(config, 'b'))

    Content(`    return b.toString()
  }
}
`)
  })
})


export {
  Config
}
