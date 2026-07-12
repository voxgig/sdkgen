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
  formatHsValue,
} from './utility_haskell'


// The full set of feature constructors in SdkFeatures (name -> <name>Feature).
const FEATURE_NAMES = [
  'log', 'test', 'retry', 'timeout', 'ratelimit', 'cache', 'idempotency',
  'paging', 'streaming', 'proxy', 'telemetry', 'metrics', 'debug', 'audit',
  'clienttrack', 'rbac', 'netsim',
]


// SdkConfig.hs: makeConfig builds the embedded API model as a struct Value;
// makeFeature(name) is the N-feature-safe factory the client uses to
// instantiate features named in the options.
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

  File({ name: 'SdkConfig.' + target.ext }, () => {

    Content(`-- Generated API configuration (make_config) and the feature factory.

module SdkConfig (makeConfig, makeFeature) where

import VoxgigStruct (Value)
import SdkHelpers (CV (..), buildCV)
import SdkTypes (Feature)
import qualified SdkFeatures as F

makeConfig :: IO Value
makeConfig = buildCV ${formatHsValue(config)}

makeFeature :: String -> IO Feature
makeFeature name = case name of
`)

    for (const fname of FEATURE_NAMES) {
      Content(`  "${fname}" -> F.${fname}Feature\n`)
    }

    Content(`  _ -> F.baseFeature\n`)
  })
})


export {
  Config
}
