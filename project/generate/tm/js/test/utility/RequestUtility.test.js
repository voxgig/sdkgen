
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')



describe('AuthUtility', ()=>{
  test('exists', async ()=>{
    const client = NameSDK.test()
    const { request } = client.utility()
    equal('function', typeof request)
  })

  test('basic', async ()=>{
    const client = NameSDK.test({
      fetch: async (url, fetchdef)=>{
        return {
          status: 200,
        }
      }
    })
    const { request } = client.utility()
    
    deepEqual(await request({
      op: {
        params: [],
      },
      spec: {
        base: 'base-',
        prefix: 'prefix-',
        suffix: 'suffix-',
        path: '/p0',
        params: {},
        query: {},
        alias: {},
      },
      client,
      utility: client.utility()
    }), {status:200})
  })
})
