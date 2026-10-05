
import { cmp, Content } from 'jostraca'

import { optionalComponent } from '../helpers/optional'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$ } = props

  Content(`
## Tutorial: your first API call

This tutorial walks through creating a client, listing entities, and
loading a specific record.

`)

  const ReadmeQuick_sdk =
    optionalComponent(ctx$, target, 'ReadmeQuick')

  if (ReadmeQuick_sdk) {
    ReadmeQuick_sdk['ReadmeQuick']({ target })
  }
})




export {
  ReadmeQuick
}
