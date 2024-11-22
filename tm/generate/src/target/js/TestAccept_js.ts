
import { cmp, each, File, Content } from '@voxgig/sdkgen'


import { TestAcceptEntity } from './TestAcceptEntity_js'


const TestAccept = cmp(function TestMain(props: any) {
  const { target } = props
  const { model } = props.ctx$


  File({ name: model.const.Name + 'SDK.accept.test.' + target.name }, () => {

    Content(`
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { ${model.const.Name}SDK } = require('../../')


describe('${model.const.Name}SDK Acceptance Tests', ()=>{
  test('happy', async ()=>{
    const client = makeClient()
    const out = await client.Geofence().load({id:'gf01'})
    console.log('Geofence.load', out)
    equal(out.data.id,'gf01')
  })

`)

    each(model.main.sdk.entity, (entity: any) => {
      TestAcceptEntity({ model, target, entity })
    })


    Content(`
})


function makeClient(config) {
  const client = ${model.const.Name}SDK.make({
    endpoint: process.env.${model.NAME}_ENDPOINT,
    apikey: process.env.${model.NAME}_APIKEY,
    ...config
  })

  return client
}

`)

  })
})


export {
  TestAccept
}

