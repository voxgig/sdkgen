
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client0 = NameSDK.test({
  apikey: 'APIKEY01'
})

const client1 = NameSDK.test()

const { auth } = client1.utility()


describe('AuthUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof auth)
  })

  test('basic', async ()=>{
    const ctx0 = { client: client0 }
    const spec0 = { headers: {} }
    client0.options()
    auth(ctx0, spec0)
    equal(spec0.headers['authorization'], 'Bearer APIKEY01')

    const ctx1 = { client: client1 }
    const spec1 = { headers: {} }
    client1.options()
    auth(ctx1, spec1)
    equal(spec1.headers['authorization'], undefined)
  })
})
