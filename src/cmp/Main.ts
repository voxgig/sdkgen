
import { cmp, Copy } from 'jostraca'

import { resolvePath } from '../utility'


const Main = cmp(function Main(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const Main_sdk = require(resolvePath(ctx$, `target/${target.name}/Main_${target.name}`))

  Main_sdk['Main']({ model, target })

  // TODO: make optional via target model
  Copy({ from: 'tm/target/' + target.name + '/LICENSE', name: 'LICENSE' })
})


export {
  Main
}
