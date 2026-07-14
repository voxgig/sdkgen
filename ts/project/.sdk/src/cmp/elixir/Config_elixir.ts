
import {
  Content,
  File,
  Folder,
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
  }), a), {})

  Folder({ name: 'lib' }, () => {
    File({ name: 'config.ex' }, () => {

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

      Content(`      },
      "options" => %{
        "base" => ${elixirString(baseUrl)},
${authBlock}        "headers" => ${formatElixir(headers, 4)},
        "entity" => %{
`)

      each(entity, (e: any) => {
        Content(`          ${elixirString(e.name)} => %{},
`)
      })

      Content(`        }
      },
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
