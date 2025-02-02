
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { outward } = client.utility()


describe('OutwardUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof outward)
  })

  test('basic', async ()=>{
    let lasterr
    const ctx = {
      client,
      result: { body: { foo: {x:1}}},
      spec: { step: '' },
      op: { outward: (ctx)=>ctx.result.body.foo },
      utility: {
        error: (ctx)=>lasterr = ctx.result.err
      }
    }

    ctx.result.ok = true
    deepEqual(outward(ctx), {x:1})
    equal(lasterr, undefined)
    equal(ctx.spec.step, 'outward')
  })


  test('not-ok', async ()=>{
    let lasterr
    const ctx = {
      client,
      result: { body: { foo: {x:1}}},
      spec: { step: '' },
      op: { outward: (ctx)=>ctx.result.body.foo },
      utility: {
        error: (ctx)=>lasterr = ctx.result.err
      }
    }

    ctx.result.ok = false
    deepEqual(outward(ctx), undefined)
    equal(lasterr, undefined)
    equal(ctx.spec.step, 'outward')
  })


  test('error', async ()=>{
    let err0 = new Error('err0')
    let lasterr
    const ctx = {
      client,
      result: { body: { foo: {x:1}}},
      spec: { step: '' },
      op: { outward: (ctx)=>{throw err0} },
      utility: {
        error: (ctx)=>lasterr = ctx.result.err
      }
    }

    ctx.result.ok = true
    equal(outward(ctx), lasterr)
    equal(err0, lasterr)
    equal(ctx.spec.step, 'outward')
    equal(ctx.result.ok, false)
    equal(ctx.result.err, lasterr)
  })

})
