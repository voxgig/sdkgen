
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**OCaml:**
\`\`\`ocaml
let result = Sdk_client.direct client (jo [
    ("path", Str "${dx.path}");
    ("method", Str "${dx.method}");
    ("params", jo [("${dx.param}", Str "example")]);
]) in
ignore result
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
