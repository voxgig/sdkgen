
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { resbasic } = client.utility()


describe('ResbasicUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof resbasic)
  })

  test('basic', async ()=>{
    const ctx0 = { response: {}, utility: client.utility() }
    deepEqual(resbasic(ctx0, {}), {
      status: -1,
      statusText: 'no-status'
    })

    ctx0.response = {}
    ctx0.response.status = 500
    deepEqual(resbasic(ctx0, {}), {
      status: 500,
      statusText: 'no-status',
      err: new Error('request: 500: no-status')
    })

    ctx0.response.status = 200
    ctx0.response.statusText = 'OK'
    deepEqual(resbasic(ctx0, {}), {
      status: 200,
      statusText: 'OK',
    })

    ctx0.response.status = 400
    ctx0.response.statusText = 'BAD'

    deepEqual(resbasic(ctx0, {
      err: new Error('Foo')
    }), {
      status: 400,
      statusText: 'BAD',
      err: new Error('Foo: request: 400: BAD')
    })
  })
})
