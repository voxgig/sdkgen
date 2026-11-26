
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**Swift:**
\`\`\`swift
let result = client.direct(VMap([
    ("path", .string("${dx.path}")),
    ("method", .string("${dx.method}")),
    ("params", .map([("${dx.param}", .string("example"))])),
]))
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
