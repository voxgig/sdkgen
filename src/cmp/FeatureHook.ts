
import { each, cmp } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'


const FeatureHook = cmp(function FeatureHook(props: any, children: any) {
  const { ctx$: { model } } = props

  const feature = getModelPath(model, `main.${KIT}.feature`)

  // A feature need not implement every pipeline stage; only fire the hook
  // for features that declare it as active. Optional chaining guards
  // features whose `hook` map omits this stage entirely.
  each(feature)
    .filter(feature => feature.active && feature.hook?.[props.name]?.active)
    .forEach(feature => each(children, { call: true, args: feature }))
})


export {
  FeatureHook
}
