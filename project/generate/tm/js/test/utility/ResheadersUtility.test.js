
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { resheaders } = client.utility()


describe('ResheadersUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof resheaders)
  })

  test('basic', async ()=>{
    const ctx0 = { response: { headers: {} }, utility: client.utility() }
    deepEqual(resheaders(ctx0, {}).headers, {})

    ctx0.response.headers = {
      a: 'A',
      b: 'B',
      forEach(callback) {
        Object.keys(this).forEach((key) => {
          callback(this[key], key, this)
        })
      }
    }
    deepEqual(JSON.parse(JSON.stringify(resheaders(ctx0, {}).headers)), {a: 'A', b: 'B'})
  })
})
