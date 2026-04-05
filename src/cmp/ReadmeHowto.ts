
import { cmp, Content } from 'jostraca'

import { requirePath } from '../utility'


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$ } = props

  Content(`
## How-to guides

`)

  const ReadmeHowto_sdk =
    requirePath(ctx$, `./cmp/${target.name}/ReadmeHowto_${target.name}`, { ignore: true })

  if (ReadmeHowto_sdk) {
    ReadmeHowto_sdk['ReadmeHowto']({ target })
  }
})




export {
  ReadmeHowto
}
