
import { cmp, Content, installCommand, isPublished, repoInfo, registryNote, fact } from '@voxgig/sdkgen'


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
  const tag = fact(target, 'tag')
  Content(`${registryNote(model, target.name)} Install it from ${'' === tag ? '' : `the ${hostName}
release tag (\`${tag}X.Y.Z\`, see [Tags](${tagsUrl})) or
from `}a source checkout:

\`\`\`bash
pip install -e .
\`\`\`

`)
})


export {
  ReadmeInstall
}
