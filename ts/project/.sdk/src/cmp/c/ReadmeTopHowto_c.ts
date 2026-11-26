
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**C:**
\`\`\`c
PNError* err = NULL;
voxgig_value* result = sdk_direct(client, cmap(3,
    "path", v_str("${dx.path}"),
    "method", v_str("${dx.method}"),
    "params", cmap(1, "${dx.param}", v_str("example"))), &err);
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
