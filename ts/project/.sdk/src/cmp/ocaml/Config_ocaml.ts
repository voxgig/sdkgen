
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
  formatOcamlValue,
  ocamlString,
} from './utility_ocaml'


// sdk_config.ml: make_config () builds the embedded API model as a value;
// make_feature name is the N-feature-safe factory the client uses to
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

  File({ name: 'sdk_config.' + target.ext }, () => {

    Content(`(* Generated API configuration (mirrors go core/config.go).
 *
 * make_config () — the embedded API model as a voxgig struct value.
 * make_feature name — the N-feature-safe factory the client uses. *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers
open Sdk_features

let make_config () : value =
  ${formatOcamlValue(config, 1)}

let make_feature (name : string) : feature =
  match name with
`)

    each(feature, (f: any) => {
      if (f.name !== 'base') {
        Content(`  | "${ocamlString(f.name)}" -> ${f.name}_feature ()
`)
      }
    })

    Content(`  | _ -> base_feature ()
`)
  })
})


export {
  Config
}
