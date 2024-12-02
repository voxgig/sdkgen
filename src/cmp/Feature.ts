
import { cmp, Copy, Folder } from 'jostraca'

import { resolvePath } from '../utility'


const Feature = cmp(function Feature(props: any) {
  const { target, feature, ctx$ } = props

  Folder({ name: 'src/' + feature.name }, () => {
    // TODO: Copy should just warn if from not found
    // Copy({ from: 'feature/' + feature.name + '/' + target.name })
  })

})


export {
  Feature
}
