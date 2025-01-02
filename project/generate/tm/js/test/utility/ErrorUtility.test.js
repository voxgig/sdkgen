
const { test, describe } = require('node:test')
const { equal, deepEqual, throws } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { error } = client.utility()


describe('ErrorUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof error)
  })

  test('basic', async ()=>{
    const ctx0 = {}
    throws(()=>error(ctx0), /Error: StatuspageSDK: unknown operation: unknown error/)

    ctx0.op = {}
    throws(()=>error(ctx0), /Error: StatuspageSDK: unknown operation: unknown error/)

    ctx0.op.name = 'foo'
    throws(()=>error(ctx0), /Error: StatuspageSDK: foo: unknown error/)

    ctx0.result = {}
    throws(()=>error(ctx0), /Error: StatuspageSDK: foo: unknown error/)

    ctx0.result.err = new Error('bar')
    throws(()=>error(ctx0), /Error: StatuspageSDK: foo: bar/)

    ctx0.spec = {x:1}
    try {
      error(ctx0)
    }
    catch(err) {
      equal(err.message, 'StatuspageSDK: foo: bar')
      deepEqual(err.result, {err: new Error('bar')})
      deepEqual(err.spec, {x:1})
    }
  })
})
