
import { each, cmp, names, Content } from 'jostraca'


const FeatureHook = cmp(function FeatureHook(props: any, children: any) {
  const { ctx$: { model } } = props

  const { feature } = model.main.sdk

  const hook: any = {}
  names(hook, props.name)

  each(feature)
    .filter(feature => feature.active && feature.hook[props.name].active)
    .map(feature => each(children, { call: true, args: feature }))
})


export {
  FeatureHook
}
