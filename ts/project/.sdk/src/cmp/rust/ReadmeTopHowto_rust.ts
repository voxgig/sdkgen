
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**Rust:**
\`\`\`rust
let result = client.direct(jo(vec![
    ("path", Value::str("${dx.path}")),
    ("method", Value::str("${dx.method}")),
    ("params", jo(vec![("${dx.param}", Value::str("example"))])),
]));
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
