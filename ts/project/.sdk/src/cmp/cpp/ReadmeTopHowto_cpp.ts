
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**${target.title}:**
\`\`\`cpp
Value result = client->direct(vmap({
    {"path", Value("${dx.path}")},
    {"method", Value("${dx.method}")},
    {"params", vmap({{"${dx.param}", Value("example")}})},
}));
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
