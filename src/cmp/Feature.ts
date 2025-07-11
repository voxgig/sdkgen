
import { cmp, Copy, Folder } from 'jostraca'

const Feature = cmp(function Feature(props: any) {
  const { target, feature, ctx$ } = props
  const { log } = ctx$

  Folder({ name: 'src/feature/' + feature.name }, () => {
    // TODO: Copy should just warn if from not found
    Copy({
      from: 'tm/' + target.name + '/src/feature/' + feature.name,
      replace: {
        FEATURE_VERSION: feature.version,
        FEATURE_Name: feature.Name,
      }
    })
  })

  log.info({
    point: 'generate-feature', target, feature,
    note: 'target:' + target.name + ', ' + 'feature: ' + feature.name
  })

})


export {
  Feature
}
