
import {
  Content,
  File,
  cmp,
  pkgDescription,
  repoInfo,
} from '@voxgig/sdkgen'


import type {
  Model,
} from '@voxgig/apidef'


// Generate mix.exs for the Elixir SDK. The vendored struct library has zero
// third-party runtime deps, so the SDK ships with none either.
const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model

  const Name = model.const.Name
  // Elixir app names are atoms: a hyphenated slug (`bluefin-decryptx-p2pe`)
  // is invalid (`:a-b` parses as subtraction). Snake_case it.
  const app = String(model.const.name).replace(/-/g, '_')
  const { repoUrl } = repoInfo(model)

  File({ name: 'mix.exs' }, () => {
    Content(`defmodule ${Name}.MixProject do
  use Mix.Project

  def project do
    [
      app: :${app},
      version: "0.0.1",
      elixir: "~> 1.14",
      description: ${JSON.stringify(pkgDescription(model, 'elixir'))},
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      package: package()
    ]
  end

  def application, do: [extra_applications: [:inets, :ssl]]

  defp deps, do: []

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp package do
    [
      licenses: ["MIT"],
      links: %{"Homepage" => ${JSON.stringify(repoUrl)}}
    ]
  end
end
`)
  })
})


export {
  Package
}
