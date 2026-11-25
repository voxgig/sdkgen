
import * as Path from 'node:path'

import { cmp, Content, installCommand, isPublished, repoInfo, readerDir } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content('```bash')
    Content(`
${installCommand(model, target.name)}
`)
    Content('```')
    return
  }

  // Publish pending, as in the ts target: a tag may not exist, so a clone is
  // always offered. The js target needs no build.
  const { hostName, tagsUrl, repoUrl, repo } = repoInfo(model)
  Content(`This package is not yet published to npm. Install it from the ${hostName}
release tag (\`${target.name}/vX.Y.Z\`, see [Tags](${tagsUrl})), or from a
clone:

\`\`\`bash
git clone ${repoUrl}
npm install ./${Path.posix.join(repo, readerDir(target))}
\`\`\`

`)
})


export {
  ReadmeInstall
}
