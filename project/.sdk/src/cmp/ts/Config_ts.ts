
import * as Path from 'node:path'

import {
  cmp, each, names,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
} from '@voxgig/sdkgen'



const Config = cmp(async function Config(props: any) {
  const { target, ctx$: { model } } = props
  const { main: { sdk: { entity } } } = model

  const ff = Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/')

  File({ name: 'Config.' + target.ext }, () => {

    Fragment({
      from: ff + 'Config.fragment.ts',
      replace: {
        '// #EntityConfigs': () => each(entity, (entity: any) => {
          Content(`
      ${entity.name}: {
      },
`)
        })
      }
    })
  })
})


export {
  Config
}
