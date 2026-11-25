
import { cmp, Content, isPublished, repoInfo, packageVersion, cdTarget, collectDeps, packageName, registryNote } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const [groupId, artifactId] = packageName(model, target.name).split(':')

  if (isPublished(model, target.name)) {
    Content(`Add the dependency with scala-cli:

\`\`\`scala
//> using dep "${groupId}:${artifactId}_3:${packageVersion(model, target.name)}"
\`\`\`

Or, with sbt:

\`\`\`scala
libraryDependencies += "${groupId}" %% "${artifactId}" % "${packageVersion(model, target.name)}"
\`\`\`

Or build from a source checkout — the SDK is a plain scala-cli project:

\`\`\`bash
${cdTarget(target)}scala-cli compile .
\`\`\`

`)
    return
  }

  // Publish pending: not yet on Maven Central, so install it from the git
  // release tag or a local source checkout and compile with scala-cli.
  const { hostName, tagsUrl } = repoInfo(model)
  const free = 0 === collectDeps(model, target.name, target.deps).length
  Content(`${registryNote(model, target.name)} The generated SDK is a
plain-source scala-cli project (no build tool${free ? ', no third-party runtime\ndependencies' : ''}). Install it from the ${hostName} release tag
(\`${target.name}/vX.Y.Z\`, see [Tags](${tagsUrl})) or from a source
checkout — compile it with scala-cli:

\`\`\`bash
${cdTarget(target)}scala-cli compile .
\`\`\`

`)
})


export {
  ReadmeInstall
}
