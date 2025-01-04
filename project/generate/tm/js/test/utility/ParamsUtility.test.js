
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { params } = client.utility()


describe('ParamsUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof params)
  })

  test('basic', async ()=>{
    const ctx0 = { op: {} }
    deepEqual(params(ctx0), {})

    ctx0.op.params = ['a']
    deepEqual(params(ctx0), {})

    ctx0.op.match = { a: 'A' }
    deepEqual(params(ctx0), { a: 'A' })

    ctx0.op.match = { b: 'B' }
    deepEqual(params(ctx0), {})

    ctx0.op.match = { a: 'A', b: 'B' }
    deepEqual(params(ctx0), { a: 'A' })
  })
})
