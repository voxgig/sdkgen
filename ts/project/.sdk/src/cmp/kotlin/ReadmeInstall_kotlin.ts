
import { cmp, Content, isPublished, repoInfo, packageVersion, cdTarget, packageName } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const [group, artifactId] = packageName(model, target.name).split(':')

  if (isPublished(model, target.name)) {
    Content(`Add the dependency to your \`build.gradle.kts\`:

\`\`\`kotlin
dependencies {
    implementation("${group}:${artifactId}:${packageVersion(model, target.name)}")
}
\`\`\`

Or build and install from a source checkout:

\`\`\`bash
${cdTarget(target)}gradle build
\`\`\`

`)
    return
  }

  // Publish pending: not yet on Maven Central. Install from the git release
  // tag or from a local source checkout built with Gradle.
  const { hostName, tagsUrl } = repoInfo(model)
  Content(`This package is not yet published to Maven Central. Install it from the ${hostName}
release tag (\`${target.name}/vX.Y.Z\`, see [Tags](${tagsUrl})) or
from a source checkout — build the library with Gradle:

\`\`\`bash
${cdTarget(target)}gradle build
\`\`\`

`)
})


export {
  ReadmeInstall
}
