
import * as Path from 'node:path'

import { cmp, Content, installCommand, isPublished, repoInfo, cdTarget, readerDir } from '@voxgig/sdkgen'

import { cIdent } from './utility_c'


// Why one program can hold several generated SDKs, and what a program must
// do to keep it so.
function linking(target: any, model: any): string {
  const prefix = cIdent(model) + '_'
  const dir = readerDir(target)
  return `Every global name in \`libsdk.a\` carries this SDK's prefix
(\`${prefix}sdk_prepare\`, \`${prefix}cmap\`, ...), so one program can link several
generated SDKs. \`make\` maps each short name to its prefixed one in
\`${Path.posix.join(dir, 'core/prefix.h')}\`, which the SDK is compiled with, and each name its
headers declare in \`${Path.posix.join(dir, 'core/prefix_api.h')}\`, which \`core/api.h\` includes,
so your code keeps the short names and the SDK's private names never rename
your own. Include \`core/api.h\` before any other SDK header, and give each SDK
a source file of its own: the headers of two SDKs declare the same type names.

`
}


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

Or build it from a source checkout with the bundled \`Makefile\`:

\`\`\`bash
${cdTarget(target)}make
\`\`\`

${linking(target, model)}`)
    return
  }

  // Publish pending: C has no central package registry — the release IS the
  // git tag. Build from a source checkout (the vendored voxgig struct means
  // there are no external dependencies to fetch).
  const { tagsUrl } = repoInfo(model)
  Content(`C has no central package registry — a release is the git tag
(\`${target.name}/vX.Y.Z\`, see [Tags](${tagsUrl})). Build from a
source checkout with the bundled \`Makefile\`; the voxgig struct library is
vendored under \`utility/struct\`, so there are no external dependencies to
fetch:

\`\`\`bash
${cdTarget(target)}make          # builds libsdk.a
${cdTarget(target)}make test     # builds + runs the test binaries
\`\`\`

Link your program against \`libsdk.a\` and the libraries \`make -s ldlibs\`
prints, and include \`core/api.h\`:

\`\`\`bash
cc -I ${Path.posix.join(readerDir(target), 'core')} -I ${Path.posix.join(readerDir(target), 'utility/struct')} \\
   myapp.c ${Path.posix.join(readerDir(target), 'libsdk.a')} $(make -s -C ${readerDir(target)} ldlibs) -o myapp
\`\`\`

${linking(target, model)}`)
})


export {
  ReadmeInstall
}
