
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { resbody } = client.utility()


describe('ResbodyUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof resbody)
  })

  test('basic', async ()=>{
    const ctx0 = { response: {}, utility: client.utility() }
    deepEqual(resbody(ctx0, {}).body, undefined)

    ctx0.response.json = async ()=>({a: 'A', b: 'B'})
    deepEqual((await resbody(ctx0, {})).body, {a: 'A', b: 'B'})
  })
})
