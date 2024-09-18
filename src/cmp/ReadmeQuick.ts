
import { cmp, Content } from 'jostraca'

import { requirePath } from '../utility'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { build, ctx$ } = props

  Content(`
## Quick Start

`)


  const ReadmeQuick_sdk = requirePath(ctx$, `./${build.name}/ReadmeQuick_${build.name}`)

  if (ReadmeQuick_sdk) {
    ReadmeQuick_sdk['ReadmeQuick']({ build })
  }
})




export {
  ReadmeQuick
}
