
import { cmp, names, Copy, Folder } from 'jostraca'

import { requirePath } from '../utility'


const Main = cmp(function Main(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  names(model, model.name)
  // console.log('MODEL name', model.name, model.Name)

  Copy({
    from: 'tm/' + target.name,
    replace: {
      Name: model.Name,
    }
  })

  // const Main_sdk = require(resolvePath(ctx$, `cmp/${target.name}/Main_${target.name}`))
  const Main_sdk = requirePath(ctx$, `cmp/${target.name}/Main_${target.name}`)

  Main_sdk['Main']({ model, target })

})


export {
  Main
}
