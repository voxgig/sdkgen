
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { method } = client.utility()


describe('MethodUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof method)
  })

  test('basic', async ()=>{
    const ctx0 = { op: { name:'create'} }
    const m = method(ctx0)
    deepEqual('POST', method(ctx0))
  })
})
