
import { cmp, Content, installCommand, isPublished, repoInfo, cdTarget, collectDeps, registryNote } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$
  const free = 0 === collectDeps(model, target.name, target.deps).length

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

Or build from a source checkout${free ? ` — the SDK is dependency-free and compiles
with the stock \`ocamlc\` (no opam packages, no dune)` : ''}:

\`\`\`bash
${cdTarget(target)}make build
\`\`\`

`)
    return
  }

  // Publish pending: not yet on the opam registry. Build from the git release
  // tag or from a local source checkout.
  const { hostName, tagsUrl } = repoInfo(model)
  Content(`${registryNote(model, target.name)} Install it from the
${hostName} release tag (\`${target.name}/vX.Y.Z\`, see [Tags](${tagsUrl}))
or from a source checkout${free ? `. The SDK is dependency-free and compiles with the
stock \`ocamlc\` — no opam packages, no dune` : ''}:

\`\`\`bash
${cdTarget(target)}make build
\`\`\`

`)
})


export {
  ReadmeInstall
}
