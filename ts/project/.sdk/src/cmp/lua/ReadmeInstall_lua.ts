
import { cmp, Content, installCommand, isPublished, repoInfo, registryNote, fact } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

If the module is not yet published, add the source directory to
your \`LUA_PATH\`:

\`\`\`bash
export LUA_PATH="path/to/lua/?.lua;path/to/lua/?/init.lua;;"
\`\`\`

`)
    return
  }

  // Publish pending: not yet on LuaRocks. Install from the git release tag,
  // or add the source directory to LUA_PATH.
  const { hostName, tagsUrl } = repoInfo(model)
  const tag = fact(target, 'tag')
  Content(`${registryNote(model, target.name)} ${'' === tag ? 'Add' : `Install it from the
${hostName} release tag (\`${tag}X.Y.Z\`, see [Tags](${tagsUrl})),
or add`} the source directory to your \`LUA_PATH\`:

\`\`\`bash
export LUA_PATH="path/to/lua/?.lua;path/to/lua/?/init.lua;;"
\`\`\`

`)
})


export {
  ReadmeInstall
}
