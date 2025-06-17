
import { cmp, names, Copy } from 'jostraca'

import { requirePath } from '../utility'


const Main = cmp(function Main(props: any) {
  const { target, ctx$ } = props
  const { model, stdrep } = ctx$

  Copy({
    from: 'tm/' + target.name,
    replace: {
      ...stdrep,

      // TODO: remove, replaced by ProjectName
      Name: model.Name
    }
  })

  const Main_sdk = requirePath(ctx$, `cmp/${target.name}/Main_${target.name}`)

  Main_sdk['Main']({ model, target, stdrep })

})


export {
  Main
}
