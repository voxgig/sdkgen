

import { cmp, Content } from 'jostraca'

import { requirePath } from '../utility'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { build, ctx$ } = props

  Content(`
## Install
`)

  // Optional
  const ReadmeInstall_sdk = requirePath(ctx$, `./${build.name}/ReadmeInstall_${build.name}`)

  if (ReadmeInstall_sdk) {
    ReadmeInstall_sdk['ReadmeInstall']({ build })
  }
})





export {
  ReadmeInstall
}
