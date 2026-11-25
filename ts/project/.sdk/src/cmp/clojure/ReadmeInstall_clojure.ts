
import * as Path from 'node:path'

import { cmp, Content, isPublished, repoInfo, readerDir, packageName, registryNote } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$
  const { hostName, origin, repo, repoUrl, tagsUrl } = repoInfo(model)

  if (isPublished(model, target.name)) {
    // Live on Clojars: add the published coordinate to deps.edn.
    Content(`Add the dependency to your \`deps.edn\`:

\`\`\`clojure
;; deps.edn
{:deps {${packageName(model, target.name)} {:mvn/version "X.Y.Z"}}}
\`\`\`

`)
    return
  }

  // Publish pending: not yet on Clojars. Depend on the library directly from
  // the release tag, or from a local checkout via :local/root.
  Content(`${registryNote(model, target.name)} Depend on it directly from the
${hostName} release tag (\`${target.name}/vX.Y.Z\`, see [Tags](${tagsUrl})),
using a \`tools.deps\` git dependency:

\`\`\`clojure
;; deps.edn
{:deps {${model.const.Name.toLowerCase()}/sdk
        {:git/url "${repoUrl}"
         :git/tag "${target.name}/vX.Y.Z"
         :git/sha "..."${'.' === readerDir(target) ? '' : '\n         :deps/root "' + readerDir(target) + '"'}}}}
\`\`\`

Or from a local source checkout:

\`\`\`clojure
;; deps.edn
{:deps {${model.const.Name.toLowerCase()}/sdk {:local/root "${Path.posix.join('..', repo, readerDir(target))}"}}}
\`\`\`

`)
})


export {
  ReadmeInstall
}
