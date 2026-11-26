
import { cmp, Content, directRoute } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**C#:**
\`\`\`csharp
var result = client.Direct(new Dictionary<string, object?>
{
    ["path"] = "${dx.path}",
    ["method"] = "${dx.method}",
    ["params"] = new Dictionary<string, object?> { ["${dx.param}"] = "example" },
});
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
