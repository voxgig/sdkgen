
import { cmp, Copy } from 'jostraca'

import { resolvePath } from '../utility'


const Main = cmp(function Main(props: any) {
  const { build, ctx$ } = props
  const { model } = ctx$

  const Main_sdk = require(resolvePath(ctx$, `${build.name}/Main_${build.name}`))

  Main_sdk['Main']({ model, build })

  // TODO: make optional via build model
  Copy({ from: 'tm/' + build.name + '/LICENSE', name: 'LICENSE' })
})


export {
  Main
}
