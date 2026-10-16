
import { cmp, Content, installCommand, isPublished, repoInfo } from '@voxgig/sdkgen'

import { cIdent } from './utility_c'


// Why one program can hold several generated SDKs, and what a program must
// do to keep it so.
function linking(target: any, model: any): string {
  const prefix = cIdent(model) + '_'
  return `Every global name in \`libsdk.a\` carries this SDK's prefix
(\`${prefix}sdk_prepare\`, \`${prefix}cmap\`, ...), so one program can link several
generated SDKs. \`make\` maps each short name to its prefixed one in
\`${target.name}/core/prefix.h\`, which the SDK is compiled with, and each name its
headers declare in \`${target.name}/core/prefix_api.h\`, which \`core/api.h\` includes,
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
cd ${target.name} && make
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
cd ${target.name} && make          # builds libsdk.a
cd ${target.name} && make test     # builds + runs the test binaries
\`\`\`

Link your program against \`libsdk.a\` and the libraries \`make -s ldlibs\`
prints, and include \`core/api.h\`:

\`\`\`bash
cc -I ${target.name}/core -I ${target.name}/utility/struct \\
   myapp.c ${target.name}/libsdk.a $(make -s -C ${target.name} ldlibs) -o myapp
\`\`\`

${linking(target, model)}`)
})


export {
  ReadmeInstall
}
