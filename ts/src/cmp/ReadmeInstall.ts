

import { cmp, Content } from 'jostraca'

import { optionalComponent } from '../helpers/optional'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props

  Content(`
## Install
`)

  // Optional
  const ReadmeInstall_sdk =
    optionalComponent(ctx$, target, 'ReadmeInstall')

  if (ReadmeInstall_sdk) {
    ReadmeInstall_sdk['ReadmeInstall']({ target })
  }
})





export {
  ReadmeInstall
}
