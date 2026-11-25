
import { cmp, Content, installCommand, isPublished, repoInfo, collectDeps, registryNote, fact } from '@voxgig/sdkgen'

import { minPerl, perlVersionLabel } from './utility_perl'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  Content(`The SDK needs perl ${perlVersionLabel(minPerl(model, target))} or later.

`)

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

Or install the \`${model.const.Name}SDK\` distribution from a source
checkout with cpanminus:

\`\`\`bash
cpanm .
\`\`\`

`)
    return
  }

  // Publish pending: not yet on CPAN. A pure-Perl SDK installs by adding its
  // \`lib\` directory to Perl's module search path (\`@INC\`).
  const { hostName, tagsUrl } = repoInfo(model)
  const tag = fact(target, 'tag')
  Content(`${registryNote(model, target.name)} Install it from ${'' === tag ? '' : `the ${hostName}
release tag (\`${tag}X.Y.Z\`, see [Tags](${tagsUrl})) or
from `}a source checkout.

${0 === collectDeps(model, target.name, target.deps).length ?
  'The SDK is pure Perl with zero non-core runtime dependencies, so no build\nstep is required — just put' :
  'The SDK is pure Perl, so no build step is required: install the dependencies\n\`Makefile.PL\` lists, and put'} its \`lib\` directory on \`@INC\`:

\`\`\`perl
use lib 'lib';
use ${model.const.Name}SDK;
\`\`\`

`)
})


export {
  ReadmeInstall
}
