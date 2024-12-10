
import { cmp, Copy, Folder } from 'jostraca'

import { resolvePath } from '../utility'


const Main = cmp(function Main(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const Main_sdk = require(resolvePath(ctx$, `${target.name}/Main_${target.name}`))

  Main_sdk['Main']({ model, target })

  // TODO: make optional via target model
  Copy({ from: 'tm/' + target.name + '/LICENSE', name: 'LICENSE' })

  Folder({ name: 'src/utility' }, () => {
    Copy({
      from: 'tm/' + target.name + '/src/utility',
      // TODO: make this work for folders
      // to: target + '/src'
    })
  })
})


export {
  Main
}
