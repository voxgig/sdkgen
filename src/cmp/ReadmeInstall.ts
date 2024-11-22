

import { cmp, Content } from 'jostraca'

import { requirePath } from '../utility'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props

  Content(`
## Install
`)

  // Optional
  const ReadmeInstall_sdk =
    requirePath(ctx$, `./target/${target.name}/ReadmeInstall_${target.name}`, { ignore: true })

  if (ReadmeInstall_sdk) {
    ReadmeInstall_sdk['ReadmeInstall']({ target })
  }
})





export {
  ReadmeInstall
}
