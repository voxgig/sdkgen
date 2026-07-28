
import { cmp, Copy, Folder } from 'jostraca'

const Feature = cmp(function Feature(props: any) {
  const { target, feature, ctx$ } = props
  const { log } = ctx$

  if (false !== target.srcfeature) {
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
  }

  log.info({
    // Identifiers only — see the note in Entity.ts.
    point: 'generate-feature', target: target.name, feature: feature.name,
    note: 'target:' + target.name + ', ' + 'feature: ' + feature.name
  })

})


export {
  Feature
}
