
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { query } = client.utility()


describe('QueryUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof query)
  })

  test('basic', async ()=>{
    const ctx0 = { op: {} }
    deepEqual(query(ctx0), {})

    ctx0.op.params = ['a']
    deepEqual(query(ctx0), {})

    ctx0.op.match = { a: 'A' }
    deepEqual(query(ctx0), {})

    ctx0.op.match = { b: 'B' }
    deepEqual(query(ctx0), { b: 'B' })

    ctx0.op.match = { a: 'A', b: 'B' }
    deepEqual(query(ctx0), { b: 'B' })
  })
})
