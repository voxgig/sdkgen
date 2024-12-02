
import * as Path from 'node:path'

import {
  cmp, each, names,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
} from '@voxgig/sdkgen'


import { MainEntity } from './MainEntity_js'
import { Test } from './Test_js'


const Main = cmp(async function Main(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const { entity } = model.main.api
  const { feature } = model.main.sdk
  const { utility } = model.main.sdk

  Copy({ from: 'tm/target/' + target.name + '/package.json', name: 'package.json' })

  Test({ target })

  Folder({ name: 'src' }, () => {

    File({ name: model.const.Name + 'SDK.' + target.name }, () => {

      Line(`// ${model.const.Name} ${target.Name} SDK\n`)

      List({ item: feature }, ({ item }: any) =>
        Line(`const { ${item.Name + 'Feature'} } = ` +
          `require('./${item.name}/${item.Name}Feature')`))

      List({ item: entity }, ({ item }: any) =>
        Line(`const { ${item.Name} } = require('./${item.Name}Entity')`))

      each(utility, (u: any) =>
        Line(`const { ${u.name} } = require('./${u.Name}Utility')`))
      Line('')

      Fragment({
        from: Path.normalize(__dirname + '/../../../src/target/js/fragment/Main.fragment.js'),
        replace: {
          Name: model.const.Name,

          '#BuildFeature': ({ indent }: any) =>
            List({ item: feature }, ({ item }) =>
              Line({ indent }, `${item.name}: ` +
                `new ${item.Name}Feature(this, ${JSON.stringify(item.config || {})}), `)),

          '#CustomUtility': ({ indent }: any) =>
            each(utility, (u: any) =>
              Line({ indent }, `this.#utility.${u.name} = ${u.name}`)),

          '#Feature-Hook': ({ name, indent }: any) =>
            FeatureHook({ name }, (f: any) =>
              Line({ indent }, `this.#feature.${f.name}.${name}({ self: this })`)),
        }
      }, () => {

        each(entity, (entity: any) => {
          MainEntity({ model, target, entity })
        })

      })
    })


    File({ name: 'Utility.' + target.name }, () => {
      Fragment({
        from: Path.normalize(__dirname + '/../../../src/target/js/fragment/Utility.fragment.js'),
        replace: {
          Name: model.const.Name,
        }
      }, () => { })
    })
  })
})


export {
  Main
}
