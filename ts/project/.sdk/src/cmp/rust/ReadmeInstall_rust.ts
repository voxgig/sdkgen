
import * as Path from 'node:path'

import { cmp, Content, installCommand, isPublished, repoInfo, readerDir, packageName, registryNote, fact } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

Or add it as a path dependency in your \`Cargo.toml\`:

\`\`\`toml
[dependencies]
${packageName(model, target.name)} = { path = "${Path.posix.join('..', repoInfo(model).repo, readerDir(target))}" }
\`\`\`

`)
    return
  }

  // Publish pending: not yet on crates.io. Depend on the git release tag or
  // on a local source checkout via a path dependency.
  const { hostName, tagsUrl } = repoInfo(model)
  const tag = fact(target, 'tag')
  Content(`${registryNote(model, target.name)} Depend on it from ${'' === tag ? '' : `the ${hostName}
release tag (\`${tag}X.Y.Z\`, see [Tags](${tagsUrl})) or
from `}a source checkout by adding it to your \`Cargo.toml\`:

\`\`\`toml
[dependencies]
# From a source checkout:
${packageName(model, target.name)} = { path = "${Path.posix.join('..', repoInfo(model).repo, readerDir(target))}" }
${'' === tag ? '' : `
# Or from the git release tag:
# ${packageName(model, target.name)} = { git = "${repoInfo(model).repoUrl}", tag = "${tag}X.Y.Z" }
`}\`\`\`

`)
})


export {
  ReadmeInstall
}
