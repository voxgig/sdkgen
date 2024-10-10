
import { cmp, Copy, Folder } from 'jostraca'

import { resolvePath } from '../utility'


const Feature = cmp(function Feature(props: any) {
  const { build, feature, ctx$ } = props

  Folder({ name: 'src/' + feature.name }, () => {
    Copy({ from: 'feature/' + feature.name + '/' + build.name })
  })

})


export {
  Feature
}
