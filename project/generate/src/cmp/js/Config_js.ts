
import * as Path from 'node:path'

import {
  cmp, each, names,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
} from '@voxgig/sdkgen'



const Config = cmp(async function Config(props: any) {
  const { target, ctx$: { model } } = props
  const { main: { def, sdk: { entity } } } = model

  File({ name: 'Config.' + target.ext }, () => {
    Content(`

const Config = {
  options: {
    base: '${def.servers[0].url}',

    entity: {
`)


    each(entity, (entity: any) => {
      Content(`
      ${entity.name}: {
      },
`)
    })

    Content(`
    }
  }
}


module.exports = {
  Config
}
`)
  })
})


export {
  Config
}
