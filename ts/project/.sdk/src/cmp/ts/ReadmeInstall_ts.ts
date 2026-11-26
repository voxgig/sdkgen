
import * as Path from 'node:path'

import { cmp, Content, installCommand, isPublished, repoInfo, readerDir, fact, registryNote } from '@voxgig/sdkgen'


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

  // Publish pending: the package is not yet on npm, so install from the
  // git release tag instead of a `npm install` that would 404. A repository
  // may have no tag at all, and npm cannot install a subdirectory of a git
  // URL, so a clone is always offered too. It carries the compiled dist/.
  const { hostName, tagsUrl, repoUrl, repo } = repoInfo(model)
  const tag = fact(target, 'tag')
  const from = '' === tag ? 'from a clone' : `from the ${hostName}
release tag (\`${tag}X.Y.Z\`, see [Tags](${tagsUrl})), or from a clone`
  Content(`${registryNote(model, target.name)} Install it ${from}, which carries
the compiled \`dist/\`:

\`\`\`bash
git clone ${repoUrl}
npm install ./${Path.posix.join(repo, readerDir(target))}
\`\`\`

`)
})


export {
  ReadmeInstall
}
