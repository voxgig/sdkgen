
import { cmp, Content, isPublished, repoInfo, packageVersion, cdTarget, packageName, registryNote, fact } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const [groupId, artifactId] = packageName(model, target.name).split(':')

  if (isPublished(model, target.name)) {
    Content(`Add the dependency to your \`pom.xml\`:

\`\`\`xml
<dependency>
  <groupId>${groupId}</groupId>
  <artifactId>${artifactId}</artifactId>
  <version>${packageVersion(model, target.name)}</version>
</dependency>
\`\`\`

Or build and install from a source checkout:

\`\`\`bash
${cdTarget(target)}mvn install
\`\`\`

`)
    return
  }

  // Publish pending: not yet on Maven Central. Install from the git release
  // tag or from a local source checkout built with Maven.
  const { hostName, tagsUrl } = repoInfo(model)
  const tag = fact(target, 'tag')
  Content(`${registryNote(model, target.name)} Install it from ${'' === tag ? '' : `the ${hostName}
release tag (\`${tag}X.Y.Z\`, see [Tags](${tagsUrl})) or
from `}a source checkout — build the library with Maven:

\`\`\`bash
${cdTarget(target)}mvn install
\`\`\`

`)
})


export {
  ReadmeInstall
}
