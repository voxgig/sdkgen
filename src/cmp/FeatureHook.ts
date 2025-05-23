
import { each, cmp, names, Content } from 'jostraca'


const FeatureHook = cmp(function FeatureHook(props: any, children: any) {
  const { ctx$: { model } } = props

  const { feature } = model.main.sdk

  const hook: any = {}
  names(hook, props.name)

  // TODO: much better error reporting for invalid feature hook names
  each(feature)
    // .map(feature => (console.log(props.name, feature), feature))
    .filter(feature => feature.active && feature.hook[props.name].active)
    .map(feature => each(children, { call: true, args: feature }))
})


export {
  FeatureHook
}
