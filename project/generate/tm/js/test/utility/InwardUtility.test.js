
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { inward } = client.utility()


describe('InwardUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof inward)
  }) 

  test('basic', async ()=>{
    let lasterr
    const ctx = {
      client,
      result: {},
      spec: { step: '' },
      op: { inward: (ctx)=>({foo:{x:1}}) },
      utility: {
        error: (ctx)=>lasterr = ctx.result.err
      }
    }

    ctx.result.ok = true
    deepEqual(inward(ctx), {foo:{x:1}})
    equal(lasterr, undefined)
    equal(ctx.spec.step, 'inward')
  })


  test('not-ok', async ()=>{
    let lasterr
    const ctx = {
      client,
      result: {},
      spec: { step: '' },
      op: { inward: (ctx)=>({foo:{x:1}}) },
      utility: {
        error: (ctx)=>lasterr = ctx.result.err
      }
    }

    ctx.result.ok = false
    deepEqual(inward(ctx), undefined)
    equal(lasterr, undefined)
    equal(ctx.spec.step, 'inward')
  })


  test('error', async ()=>{
    let err0 = new Error('err0')
    let lasterr
    const ctx = {
      client,
      result: {},
      spec: { step: '' },
      op: { inward: (ctx)=>{throw err0} },
      utility: {
        error: (ctx)=>lasterr = ctx.result.err
      }
    }

    ctx.result.ok = true
    equal(inward(ctx), lasterr)
    equal(err0, lasterr)
    equal(ctx.spec.step, 'inward')
    equal(ctx.result.ok, false)
    equal(ctx.result.err, lasterr)
  })

  
})
