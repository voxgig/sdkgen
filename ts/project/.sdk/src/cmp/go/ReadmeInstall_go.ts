
import * as Path from 'node:path'

import { cmp, Content, packageName, repoInfo, readerDir } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = packageName(model, target.name)
  // `repo` is the directory a `git clone` of this project creates — not
  // `<slug>-sdk`, which is only the DEFAULT repo name.
  const { hostName, tagsUrl, repo } = repoInfo(model)
  const dir = readerDir(target)

  Content(`\`\`\`bash
go get ${gomodule}@latest
\`\`\`

The Go module proxy resolves the version from the \`go/vX.Y.Z\` ${hostName}
release tag — see [Tags](${tagsUrl}) for the available versions.

To vendor from a local checkout instead, clone this repo alongside your
project and add a \`replace\` directive pointing at the checked-out
${'.' === dir ? 'module' : '\`' + dir + '/\` directory'}:

\`\`\`bash
go mod edit -replace ${gomodule}=${Path.posix.join('..', repo, dir)}
\`\`\`

`)
})


export {
  ReadmeInstall
}
