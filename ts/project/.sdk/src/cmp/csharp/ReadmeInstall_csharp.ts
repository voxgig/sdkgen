
import * as Path from 'node:path'

import { cmp, Content, installCommand, isPublished, repoInfo, cdTarget, readerDir, registryNote, fact } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

Or add a project reference to a source checkout:

\`\`\`bash
dotnet add reference ${Path.posix.join('..', repoInfo(model).repo, readerDir(target), model.const.Name + 'SDK.csproj')}
\`\`\`

`)
    return
  }

  // Publish pending: not yet on NuGet. Install from the git release tag or
  // from a local source checkout.
  const { hostName, tagsUrl } = repoInfo(model)
  const tag = fact(target, 'tag')
  Content(`${registryNote(model, target.name)} Install it from ${'' === tag ? '' : `the ${hostName}
release tag (\`${tag}X.Y.Z\`, see [Tags](${tagsUrl})) or
from `}a source checkout — build the library and add a project reference:

\`\`\`bash
${cdTarget(target)}dotnet build ${model.const.Name}SDK.csproj
\`\`\`

`)
})


export {
  ReadmeInstall
}
