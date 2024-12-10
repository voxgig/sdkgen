
import { names, getx, each, cmp, File, Content } from '@voxgig/sdkgen'


const Quick = cmp(function Quick(props: any) {
  const { target } = props
  const { model, meta: { spec } } = props.ctx$

  // get quick entity from target config

  let ent: any
  let entmap = getx(spec.config.guideModel, 'guide entity?test:quick:active=true')

  if (entmap) {
    ent = Object.values(entmap)[0]
    ent.name = Object.keys(entmap)[0]
  }

  ent = ent || { name: 'Entity' }
  names(ent, ent.name)// , ent.key$ || 'name')

  // TODO: selected features should be active by default!

  const featureOptions = each(model.main.sdk.feature)
    .filter((f: any) => f.active)
    .reduce((a: any, f: any) => a + `\n    ${f.name}: { active: true },`, '')

  // console.log('QUICK', ent, featureOptions)


  File({ name: 'quick.' + target.name }, () => {

    Content(`
// ENT 3
require('dotenv').config({ path: ['../../.env.local']})

const { ${model.const.Name}SDK } = require('../')

run()

async function run() {
  const client = new ${model.const.Name}SDK({
    endpoint: process.env.${model.NAME}_ENDPOINT,
    apikey: process.env.${model.NAME}_APIKEY,
    ${featureOptions}
  })

`)

    if (ent.test?.quick.create) {
      Content(`    
  out = await client.${ent.Name}().create(${JSON.stringify(ent.test?.quick.create)})
  console.log('${ent.Name}.load', out) 
`)
    }

    if (ent.test?.quick.load) {
      Content(`    
  out = await client.${ent.Name}().load(${JSON.stringify(ent.test?.quick.load)})
  console.log('${ent.Name}.load', out) 
`)
    }

    if (ent.test?.quick.list) {
      Content(`    
  out = await client.${ent.Name}().list(${JSON.stringify(ent.test?.quick.list)})
  console.log('${ent.Name}.list', out)
`)
    }

    Content(`
}
`)

  })
})


export {
  Quick
}

