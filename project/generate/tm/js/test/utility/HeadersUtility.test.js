
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { headers } = client.utility()


describe('HeadersUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof headers)
  })

  test('basic', async ()=>{
    const ctx0 = {}
    const h0 = headers(ctx0)
    deepEqual(h0, {
      'content-type': 'application/json'
    })
  })
})
