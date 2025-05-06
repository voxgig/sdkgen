
import { cmp, names, Copy, Folder } from 'jostraca'

import { resolvePath } from '../utility'


const Main = cmp(function Main(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  names(model, model.name)
  console.log('MODEL name', model.name, model.Name)

  Copy({
    from: 'tm/' + target.name,
    replace: {

      Name: model.Name,

      // '/"`([^"]+)`"/': '$1'
    }
  })

  const Main_sdk = require(resolvePath(ctx$, `cmp/${target.name}/Main_${target.name}`))

  Main_sdk['Main']({ model, target })

  // // TODO: make optional via target model
  // Copy({ from: 'tm/' + target.name + '/LICENSE', to: 'LICENSE' })

  // Folder({ name: 'src/utility' }, () => {
  //   Copy({
  //     from: 'tm/' + target.name + '/src/utility',
  //     // TODO: make this work for folders
  //     // to: target + '/src'
  //   })
  // })

  // Folder({ name: 'test' }, () => {
  //   Copy({
  //     from: 'tm/' + target.name + '/test',
  //   })
  // })

})


export {
  Main
}
