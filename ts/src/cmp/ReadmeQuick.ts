
import { cmp, Content } from 'jostraca'

import { requirePath, credentialPlacement } from '../utility'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$ } = props
  const placement = credentialPlacement(ctx$.model)

  Content(`
## Tutorial: your first API call

This tutorial walks through creating a client, listing entities, and
loading a specific record.${'' === placement ? '' : ' ' + placement}

`)

  const ReadmeQuick_sdk =
    requirePath(ctx$, `./cmp/${target.name}/ReadmeQuick_${target.name}`, { ignore: true })

  if (ReadmeQuick_sdk) {
    ReadmeQuick_sdk['ReadmeQuick']({ target })
  }
})




export {
  ReadmeQuick
}
