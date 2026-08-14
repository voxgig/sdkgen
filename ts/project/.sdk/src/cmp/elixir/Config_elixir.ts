
import {
  Content,
  File,
  Folder,
  cmp,
  configDefinition,
  configReprSetting,
  each,
  isAuthActive,
  isConfigData,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
} from '@voxgig/apidef'


import {
  clean,
  formatElixir,
  elixirString,
} from './utility_elixir'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model

  const Name = model.const.Name

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  const authPrefix = resolveAuthPrefix(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  const authBlock = authActive
    ? `        "auth" => %{"prefix" => ${elixirString(authPrefix)}},\n`
    : ''

  const entityClean = Object.values(entity).reduce((a: any, n: any) => (a[n.name] = clean({
    fields: n.fields,
    name: n.name,
    op: n.op,
    relations: n.relations,
  }, true), a), {})

  Folder({ name: 'lib' }, () => {
    // The same config as an OBJECT, built by the shared helper so this
    // target's literal and the data that replaces it above the threshold are
    // the same config by construction. The JSON is what the threshold is
    // measured on - emitted source size varies by language, the model does not.
    const { def: configDef, json: configJson } = configDefinition(model)
    const asData = isConfigData(configJson, configReprSetting(model))

    File({ name: 'config.ex' }, () => {

      // ABOVE THE THRESHOLD: emit the model as DATA.
      //
      // The literal is one nested `%{}` the Elixir compiler expands and holds
      // in the module's constant pool; a binary is one token. `Json.parse`
      // builds the vendored struct's heap nodes DIRECTLY - the same nodes
      // `Helpers.deep/1` produces from a plain map - so make_config returns
      // exactly what it returned before.
      //
      // `ProjectName.Json` is already the SDK's response decoder (see
      // `safe_json` in utility.ex), so this adds no dependency.
      if (asData) {
        Content(`# ${Name} SDK configuration
#
# THE API MODEL, EMBEDDED AS DATA (sdkgen rung L1).
#
# Emitted only above a size threshold, or when \`main.kit.config.repr\` pins
# it: for a small model the literal is smaller and far easier to read when
# debugging. Do not edit by hand.

defmodule ${Name}.Config do
  @config_data ${elixirString(configJson)}

  def make_config do
    ${Name}.Json.parse(@config_data)
  end
end
`)
        return
      }

      Content(`# ${Name} SDK configuration
#
# Returns the resolved SDK config as vendored-struct nodes (via
# ${Name}.Helpers.deep/1). Do not edit by hand.

defmodule ${Name}.Config do
  def make_config do
    ${Name}.Helpers.deep(%{
      "main" => %{"name" => ${elixirString(Name)}},
      "feature" => %{
`)

      each(feature, (f: any) => {
        Content(`        ${elixirString(f.name)} => ${formatElixir(f.config || {}, 4)},
`)
      })

      // `options` rendered WHOLE from the canonical definition rather than
      // assembled slot by slot. Assembling it meant `options.server` - the
      // OpenAPI server-variable defaults - was simply absent from this branch,
      // so a templated server URL described a different config either side of
      // the threshold. Same fix as dart, rust and zig.
      Content(`      },
      "options" => ${formatElixir(configDef.options, 3)},
      "entity" => ${formatElixir(entityClean, 3)}
    })
  end
end
`)
    })
  })
})


export {
  Config
}
