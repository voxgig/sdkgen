
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**Kotlin:**
\`\`\`kotlin
val result = client.direct(mutableMapOf<String, Any?>(
    "path" to "${dx.path}",
    "method" to "${dx.method}",
    "params" to mapOf("${dx.param}" to "example")))
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
