
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**Go:**
\`\`\`go
result, err := client.Direct(map[string]any{
    "path":   "${dx.path}",
    "method": "${dx.method}",
    "params": map[string]any{"${dx.param}": "example"},
})
if err != nil {
    panic(err)
}
fmt.Println(result)
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
