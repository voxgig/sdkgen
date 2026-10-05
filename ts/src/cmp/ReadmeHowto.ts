
import { Content } from 'jostraca'
import { cmp } from '../helpers/component'

import { optionalComponent } from '../helpers/optional'


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$ } = props

  Content(`
## How-to guides

`)

  const ReadmeHowto_sdk =
    optionalComponent(ctx$, target, 'ReadmeHowto')

  if (ReadmeHowto_sdk) {
    ReadmeHowto_sdk['ReadmeHowto']({ target })
  }
})




export {
  ReadmeHowto
}
