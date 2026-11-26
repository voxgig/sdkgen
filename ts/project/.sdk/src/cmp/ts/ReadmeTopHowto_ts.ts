
import { cmp, Content, directRoute, jsKey } from '@voxgig/sdkgen'


const ReadmeTopHowto = cmp(function ReadmeTopHowto(props: any) {
  const { target } = props
  const dx = directRoute(props.ctx$.model)

  Content(`**TypeScript:**
\`\`\`ts
const result = await client.direct({
  path: '${dx.path}',
  method: '${dx.method}',
  params: { ${jsKey(dx.param)}: 'example' },
})
if (result.ok) {
  console.log(result.data)
}
\`\`\`

`)

})


export {
  ReadmeTopHowto
}
