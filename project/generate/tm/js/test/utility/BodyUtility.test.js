
const { test, describe } = require('node:test')
const { equal, deepEqual, throws } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { body } = client.utility()


describe('BodyUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof body)
  })

  test('basic', async ()=>{
    let lasterr
    const ctx0 = {
      op: {
        kind: 'req',
        outward: (ctx)=>ctx.result.body.foo
      },
      result: {
        body: {
          foo: {x: 1}
        }
      },
      utility: {
        error: (ctx)=>{ throw (lasterr = ctx.result.err) }
      }
    }

    deepEqual({x: 1}, body(ctx0))
    equal(undefined, lasterr)

    ctx0.op.outward = (ctx)=>ctx.result.body.bar.zed

    throws(()=>body(ctx0),/Cannot read properties of undefined \(reading 'zed'\)/)
    deepEqual(lasterr, new TypeError('Cannot read properties of undefined (reading \'zed\')'))
  })
})
