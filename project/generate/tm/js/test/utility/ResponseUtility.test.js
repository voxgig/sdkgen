
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { response } = client.utility()


describe('ResponseUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof response)
  })

  test('basic', async ()=>{
    const ctx0 = {
      response: {},
      spec: {},
      utility: client.utility()
    }
    deepEqual(await response(ctx0, {}), {
      body: undefined,
      err: undefined,
      headers: {},
      ok: true,
      status: -1,
      statusText: 'no-status'
    })

    ctx0.response.json = async ()=>({a: 'A', b: 'B'})
    deepEqual((await response(ctx0, {})), {
      body: {a: 'A', b: 'B'},
      err: undefined,
      headers: {},
      ok: true,
      status: -1,
      statusText: 'no-status'
    })
  })
})
