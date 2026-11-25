
import * as Path from 'node:path'

import { cmp, Content, installCommand, isPublished, packageName, repoInfo, readerDir, registryNote, fact } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

`)
    return
  }

  // Publish pending: not yet on Packagist. Install from the git release tag,
  // or from a clone as a Composer path repository, since a tag may not exist.
  const { hostName, tagsUrl, repoUrl, repo } = repoInfo(model)
  const tag = fact(target, 'tag')
  Content(`${registryNote(model, target.name)} Install it from ${'' === tag ? '' : `the
${hostName} release tag (\`${tag}X.Y.Z\`, see [Tags](${tagsUrl})), or
from `}a clone as a Composer path repository:

\`\`\`bash
git clone ${repoUrl}
composer config repositories.${repo} path ./${Path.posix.join(repo, readerDir(target))}
composer require ${packageName(model, target.name)}:@dev
\`\`\`

`)
})


export {
  ReadmeInstall
}
