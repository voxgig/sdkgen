
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const orgPrefix = (model.origin || '').replace(/-sdk$/, '').replace(/[^a-z0-9]/gi, '')
  const gomodule = orgPrefix + model.name + 'sdk'

  Content(`\`\`\`bash
go get ${gomodule}
\`\`\`

`)
})


export {
  ReadmeInstall
}
