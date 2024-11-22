
import { cmp, Content } from 'jostraca'

import { requirePath } from '../utility'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$ } = props

  Content(`
## Quick Start

`)

  const ReadmeQuick_sdk =
    requirePath(ctx$, `./target/${target.name}/ReadmeQuick_${target.name}`, { ignore: true })

  if (ReadmeQuick_sdk) {
    ReadmeQuick_sdk['ReadmeQuick']({ target })
  }
})




export {
  ReadmeQuick
}
