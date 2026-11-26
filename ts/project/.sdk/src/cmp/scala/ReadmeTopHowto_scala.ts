
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**Scala:**
\`\`\`scala
val result = client.direct(java.util.Map.of(
    "path", "${dx.path}",
    "method", "${dx.method}",
    "params", java.util.Map.of("${dx.param}", "example")))
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
