
import * as Path from 'node:path'

import { cmp, Content, isPublished, repoInfo, packageVersion, sdkName, readerDir, registryNote, fact } from '@voxgig/sdkgen'

import { elixirApp } from './app_elixir'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const app = elixirApp(model, target)

  if (isPublished(model, target.name)) {
    // Live on Hex: add the dependency to mix.exs deps/0.
    Content(`Add \`${app}\` to your \`mix.exs\` dependencies:

\`\`\`elixir
def deps do
  [
    {:${app}, "~> ${packageVersion(model, target.name)}"}
  ]
end
\`\`\`

Then fetch it:

\`\`\`bash
mix deps.get
\`\`\`

`)
    return
  }

  // Publish pending: not yet on Hex. Install from the git release tag or a
  // local path checkout.
  const { hostName, repoUrl, tagsUrl } = repoInfo(model)
  const tag = fact(target, 'tag')
  Content(`${registryNote(model, target.name)}${'' === tag ? ' Install it from' : ` Install it from
the ${hostName} release tag (\`${tag}X.Y.Z\`, see [Tags](${tagsUrl}))
by adding a git dependency to your \`mix.exs\`:

\`\`\`elixir
def deps do
  [
    {:${app}, git: "${repoUrl}.git", tag: "${tag}X.Y.Z"}
  ]
end
\`\`\`

Or from`} a local source checkout:

\`\`\`elixir
def deps do
  [
    {:${app}, path: "${Path.posix.join('..', repoInfo(model).repo, readerDir(target))}"}
  ]
end
\`\`\`

Then run \`mix deps.get\`.

`)
})


export {
  ReadmeInstall
}
