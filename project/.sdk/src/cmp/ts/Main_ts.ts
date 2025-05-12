
import * as Path from 'node:path'

import {
  cmp, each, names, cmap,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
} from '@voxgig/sdkgen'


import { Package } from './Package_ts'
import { Config } from './Config_ts'
//import { MainEntity } from './MainEntity_ts'
//import { Test } from './Test_ts'


const Main = cmp(async function Main(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const { entity } = model.main.api
  const { feature } = model.main.sdk

  Package({ target })

  // Test({ target })

  Folder({ name: 'src' }, () => {

    // File({ name: model.const.Name + 'SDK.' + target.name }, () => {

    //   Line(`// ${model.const.Name} ${target.Name} SDK\n`)

    //   List({ item: feature }, ({ item }: any) =>
    //     Line(`const { ${item.Name + 'Feature'} } = ` +
    //       `require('./feature/${item.name}/${item.Name}Feature')`))

    //   List({ item: entity }, ({ item }: any) =>
    //     Line(`const { ${item.Name}Entity } = require('./entity/${item.Name}Entity')`))

    //   Fragment({
    //     from: Path.normalize(__dirname + '/../../../src/cmp/js/fragment/Main.fragment.js'),
    //     replace: {
    //       Name: model.const.Name,


    //       '#FeatureOptions': ({ indent }: any) =>
    //         Line({ indent }, `const fopts = this.#options.feature || {}`),

    //       '#BuildFeature': ({ indent }: any) => {
    //         List({ item: feature, line: false }, ({ item }: any) =>
    //           Line({ indent }, `${item.name}: ` +
    //             `new ${item.Name}Feature(this, fopts.${item.name}, ` +
    //             `${JSON.stringify(item.config || {})}), `))
    //       },

    //       '#Feature-Hook': ({ name, indent }: any) =>
    //         FeatureHook({ name }, (f: any) =>
    //           Line({ indent },
    //             `${f.await ? 'await ' : ''}this.#features.${f.name}.${name}({ client: this })`)),

    //       '#TestOptions': ({ indent }: any) => {
    //         const topts = {
    //           feature: cmap(feature, {
    //             active: false
    //           }),
    //         }
    //         Content({ indent },
    //           JSON.stringify(topts, null, 2)
    //             .replace(/^{\n  /, '').replace(/\n}$/, ',\n').replace(/\n  /g, '\n'))
    //       }
    //     }
    //   }, () => {
    //     each(entity, (entity: any) => {
    //       // console.log('ENTITY', entity.name)
    //       MainEntity({ target, entity, entitySDK: model.main.sdk.entity[entity.name] })
    //     })
    //   })
    // })

    Config({ target })

  })
})


export {
  Main
}
