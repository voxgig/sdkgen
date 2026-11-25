
import { cmp, Content, installCommand, isPublished, repoInfo, registryNote } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

Or install from source:

\`\`\`bash
pip install -e .
\`\`\`

`)
    return
  }

  // Publish pending: not yet on PyPI. Install from the git release tag or
  // from a local source checkout.
  const { hostName, tagsUrl } = repoInfo(model)
  Content(`${registryNote(model, target.name)} Install it from the ${hostName}
release tag (\`${target.name}/vX.Y.Z\`, see [Tags](${tagsUrl})) or
from a source checkout:

\`\`\`bash
pip install -e .
\`\`\`

`)
})


export {
  ReadmeInstall
}
