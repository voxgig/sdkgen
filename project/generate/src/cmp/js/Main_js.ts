
import * as Path from 'node:path'

import {
  cmp, each, names,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
} from '@voxgig/sdkgen'


import { Package } from './Package_js'
import { Config } from './Config_js'
import { MainEntity } from './MainEntity_js'
import { Test } from './Test_js'


const Main = cmp(async function Main(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const { entity } = model.main.api
  const { feature } = model.main.sdk
  const { utility } = model.main.sdk

  Package({ target })

  Test({ target })

  Folder({ name: 'src' }, () => {

    File({ name: model.const.Name + 'SDK.' + target.name }, () => {

      Line(`// ${model.const.Name} ${target.Name} SDK\n`)

      List({ item: feature }, ({ item }: any) =>
        Line(`const { ${item.Name + 'Feature'} } = ` +
          `require('./feature/${item.name}/${item.Name}Feature')`))

      List({ item: entity }, ({ item }: any) =>
        Line(`const { ${item.Name}Entity } = require('./entity/${item.Name}Entity')`))

      each(utility, (u: any) =>
        Line(`const { ${u.name} } = require('./utility/${u.Name}Utility')`))
      Line('')

      Fragment({
        from: Path.normalize(__dirname + '/../../../src/cmp/js/fragment/Main.fragment.js'),
        replace: {
          Name: model.const.Name,

          '#BuildFeature': ({ indent }: any) =>
            List({ item: feature, line: false }, ({ item }: any) =>
              Line({ indent }, `${item.name}: ` +
                `new ${item.Name}Feature(this, this.#options.feature.${item.name}, ` +
                `${JSON.stringify(item.config || {})}), `)),

          '#CustomUtility': ({ indent }: any) =>
            each(utility, (u: any) =>
              Line({ indent }, `this.#utility.${u.name} = ${u.name}`)),

          '#Feature-Hook': ({ name, indent }: any) =>
            FeatureHook({ name }, (f: any) =>
              Line({ indent },
                `${f.await ? 'await ' : ''}this.#features.${f.name}.${name}({ client: this })`)),
        }
      }, () => {

        // console.log('ENTITY-SDK', model.main.sdk.entity)

        each(entity, (entity: any) => {
          // console.log('ENTITY', entity.name)
          MainEntity({ target, entity, entitySDK: model.main.sdk.entity[entity.name] })
        })

      })
    })

    Config({ target })

  })
})


export {
  Main
}
