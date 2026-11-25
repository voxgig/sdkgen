
import { cmp, Content, isPublished, repoInfo, packageVersion, cdTarget, collectDeps, registryNote, fact } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content(`Add the package as a dependency in your \`Package.swift\`:

\`\`\`swift
dependencies: [
    .package(url: "${repoInfo(model).repoUrl}", from: "${packageVersion(model, target.name)}"),
],
\`\`\`

Or build from a source checkout — the SDK is a plain SwiftPM package:

\`\`\`bash
${cdTarget(target)}swift build
\`\`\`

`)
    return
  }

  // Publish pending: not yet on the SwiftPM registry (git-tag only), so
  // install it from the git release tag or a local source checkout.
  const { hostName, tagsUrl } = repoInfo(model)
  const free = 0 === collectDeps(model, target.name, target.deps).length
  const tag = fact(target, 'tag')
  Content(`${registryNote(model, target.name)}${free ? ` The generated SDK
is a dependency-free SwiftPM package (Foundation only, plus the vendored
Voxgig Struct port).` : ''}${'' === tag ? ' Build it' : ` Depend on it from the ${hostName} release tag
(\`${tag}X.Y.Z\`, see [Tags](${tagsUrl})) by adding it to
your \`Package.swift\`:

\`\`\`swift
dependencies: [
    // From the git release tag:
    .package(url: "${repoInfo(model).repoUrl}", exact: "${packageVersion(model, target.name)}"),
],
\`\`\`

Or build`} from a source checkout with SwiftPM:

\`\`\`bash
${cdTarget(target)}swift build
\`\`\`

`)
})


export {
  ReadmeInstall
}
