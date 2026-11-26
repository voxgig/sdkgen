
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { ctx$: { model } } = props
  const dx = directRoute(model)

  const Name = model.const.Name

  Content(`**Elixir:**
\`\`\`elixir
result = ${Name}.direct(sdk, ${Name}.Helpers.deep(%{
  "path" => "${dx.path}",
  "method" => "${dx.method}",
  "params" => %{"${dx.param}" => "example"}
}))
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
