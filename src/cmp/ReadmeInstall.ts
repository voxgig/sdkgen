
import { cmp, select, Code } from 'jostraca'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { build } = props

  Code(`
## Install
`)

  select(build.name, {
    js: () => Code(`
\`\`\`

npm install ${build.name}SDK

\`\`\`
`),

    python: () => Code(`
\`\`\`

pip install ${build.name}SDK

\`\`\`
`),

    java: () => Code(`
\`\`\`

maven install ${build.name}SDK

\`\`\`
`),

    go: () => Code(`
\`\`\`

go get ${build.name}SDK

\`\`\`
`),

    ruby: () => Code(`
\`\`\`

gem install ${build.name}SDK

\`\`\`
`)


  })

})





export {
  ReadmeInstall
}
