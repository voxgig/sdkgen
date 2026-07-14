
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
  formatRustValue,
} from './utility_rust'


// core/config.rs: make_config() builds the embedded API model as a Value;
// make_feature(name) is the N-feature-safe factory the client uses to
// instantiate features named in the options (mirrors go Config_go).
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

  // Assemble the whole config as a JSON-shaped object, then render it once
  // via formatRustValue (byte-stable; each() sorted-key iteration).
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

    Content(`// Generated API configuration (mirrors go core/config.go).

use std::cell::RefCell;
use std::rc::Rc;

use crate::core::types::FeatureRef;
use crate::utility::voxgigstruct::Value;

pub fn make_config() -> Value {
    ${formatRustValue(config, 1)}
}

pub fn make_feature(name: &str) -> FeatureRef {
    match name {
`)

    each(feature, (f: any) => {
      const fname = f.name.charAt(0).toUpperCase() + f.name.slice(1)
      if (f.name !== 'base') {
        Content(`        "${f.name}" => Rc::new(RefCell::new(crate::feature::${f.name}::${fname}Feature::new())),
`)
      }
    })

    Content(`        _ => Rc::new(RefCell::new(crate::feature::base::BaseFeature::new())),
    }
}
`)
  })
})


export {
  Config
}
