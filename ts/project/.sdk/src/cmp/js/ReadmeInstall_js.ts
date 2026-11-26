
import * as Path from 'node:path'

import { cmp, Content, installCommand, isPublished, repoInfo, readerDir, registryNote, fact } from '@voxgig/sdkgen'


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
  const tag = fact(target, 'tag')
  Content(`${registryNote(model, target.name)} Install it from ${'' === tag ? '' : `the ${hostName}
release tag (\`${tag}X.Y.Z\`, see [Tags](${tagsUrl})), or from `}a
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
