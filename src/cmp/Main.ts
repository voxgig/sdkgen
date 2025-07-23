
import { cmp, names, Copy } from 'jostraca'

import { requirePath } from '../utility'


const Main = cmp(function Main(props: any) {
  const { target, ctx$ } = props
  const { model, stdrep, log } = ctx$

  Copy({
    // This folder is relative to the .sdk folder in the project, as that is where
    // the sdk is generated from.
    from: 'tm/' + target.name,
    replace: {
      ...stdrep,
    }
  })

  const Main_sdk = requirePath(ctx$, `cmp/${target.name}/Main_${target.name}`)

  Main_sdk['Main']({ model, target, stdrep })

  log.info({ point: 'generate-main', target, note: 'target:' + target.name })
})


export {
  Main
}
