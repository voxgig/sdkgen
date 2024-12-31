
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test({
  apikey: 'APIKEY01'
})
const { auth } = client.utility()


describe('AuthUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof auth)
  })

  test('basic', async ()=>{
    const ctx = { client }
    const spec = { headers: {} }
    client.options()
    auth(ctx, spec)
    equal(spec.headers['authorization'], 'Bearer APIKEY01')
  })
})
