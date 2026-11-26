
import { Content } from 'jostraca'
import { cmp } from '../helpers/component'

import { KIT, getModelPath } from '../types'
import { credentialPlacement } from '../utility'
import { optionalComponent } from '../helpers/optional'
import { entityOps } from '../helpers/opShape'
import { seriesList } from '../helpers/text'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$ } = props
  const placement = credentialPlacement(ctx$.model)

  // The entity each language's quick start takes: the first active one.
  const entity = Object.values(getModelPath(ctx$.model, `main.${KIT}.entity`, { required: false }) || {})
    .find((e: any) => e && e.active !== false)
  const ops = null == entity ? [] : entityOps(entity)

  Content(`
## Tutorial: your first API call

This tutorial walks through ${seriesList(['creating a client',
    ...(ops.includes('list') ? ['listing entities'] : []),
    ...(ops.includes('load') ? ['loading a specific record'] : [])])}.${'' === placement ? '' : ' ' + placement}

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
