
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**Java:**
\`\`\`java
Map<String, Object> result = client.direct(Map.of(
    "path", "${dx.path}",
    "method", "${dx.method}",
    "params", Map.of("${dx.param}", "example")));
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
