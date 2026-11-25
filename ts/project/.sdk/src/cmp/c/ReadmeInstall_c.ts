
import * as Path from 'node:path'

import { cmp, Content, installCommand, isPublished, repoInfo, cdTarget, readerDir, collectDeps, registryNote, registryState, fact } from '@voxgig/sdkgen'

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

  // No registry to install from: the release is the git tag. Build from a
  // source checkout.
  const { tagsUrl } = repoInfo(model)
  const free = 0 === collectDeps(model, target.name, target.deps).length
  const tag = fact(target, 'tag')
  Content(`${'tag' === registryState(model, target.name) ? 'C has no central package registry' :
    registryNote(model, target.name).replace(/\.$/, '')}${'' === tag ? '' : ` — a release is the git tag
(\`${tag}X.Y.Z\`, see [Tags](${tagsUrl}))`}. Build from a
source checkout with the bundled \`Makefile\`; the voxgig struct library is
vendored under \`utility/struct\`${free ? ', so there are no external dependencies to\nfetch' : ''}:

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
