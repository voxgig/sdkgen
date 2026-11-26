
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**Zig:**
\`\`\`zig
const result = client.direct(h.jo(&.{
    .{ "path", h.vstr("${dx.path}") },
    .{ "method", h.vstr("${dx.method}") },
    .{ "params", h.jo(&.{.{ "${dx.param}", h.vstr("example") }}) },
}));
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
