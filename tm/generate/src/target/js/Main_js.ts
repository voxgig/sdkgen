
import * as Path from 'node:path'

import { cmp, each, names, File, Content, Copy, Folder, Fragment, Line } from '@voxgig/sdkgen'


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

      Line(`// ${model.const.Name} ${target.Name} SDK`)


      each(feature, (feature: any) =>
        Line(`const { ${feature.Name + 'Feature'} } = require('./${feature.name}/${feature.Name}Feature'`))

      each(entity, (entity: any) =>
        Line(`const { ${entity.Name} } = require('./${entity.Name}Entity')`))

      each(utility, (utility: any) =>
        Line(`const { ${utility.name} } = require('./${utility.Name}Utility')`))


      const features = each(feature).map((feature: any) =>
        `${feature.name}: new ${feature.Name}Feature(this, ${JSON.stringify(feature.config || {})})`).join('\n')

      const utilities = each(utility).map((utility: any) =>
        `this.#utility.${utility.name} = ${utility.name}`).join('\n')


      Fragment({
        from: Path.normalize(__dirname + '/../../../src/target/js/fragment/Main.fragment.js'),
        replace: {
          Name: model.const.Name,
          '// #BuildFeatures\n': features,
          '// #CustomUtilities\n': utilities,
        }
      }, () => {

        each(entity, (entity: any) => {
          MainEntity({ model, target, entity })
        })

      })

      /*
    Content(`

function required(type,name,options) {
const val = options[name]
if(type !== typeof val) {
  throw new Error('${model.const.Name}SDK: Invalid option: '+name+'='+val+': must be of type '+type)
}
}

module.exports = {
${model.const.Name}SDK
}

`)
*/

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
