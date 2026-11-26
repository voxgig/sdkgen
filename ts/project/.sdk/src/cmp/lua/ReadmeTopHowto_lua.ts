
import { cmp, Content, directRoute, luaKey } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**Lua:**
\`\`\`lua
local result, err = client:direct({
  path = "${dx.path}",
  method = "${dx.method}",
  params = { ${luaKey(dx.param)} = "example" },
})
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
