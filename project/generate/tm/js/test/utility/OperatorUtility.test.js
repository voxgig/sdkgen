
const { test, describe } = require('node:test')
const { equal, deepEqual, throws  } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { operator } = client.utility()


describe('OperatorUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof operator)
  })

  test('basic', async ()=>{
    const ctx0 = { op: {}, utility: client.utility() }
    throws(()=>operator(ctx0),
           /statuspage: operator definition: field: name: invalid string: empty/)

    ctx0.op = {
      name: 'not-an-operation'
    }
    throws(()=>operator(ctx0),
           /statuspage: operator definition: field: kind: invalid string: empty/)


    ctx0.op = {
      name: 'create'
    }
    throws(()=>operator(ctx0),
           /statuspage: operator definition: field: path: invalid string: empty/)

    ctx0.op = {
      name: 'create',
      path: 'path',
      entity: 'foo'
    }
    throws(()=>operator(ctx0),
           /statuspage: operator definition: field: inward: invalid function: undefined/)

    ctx0.op = {
      name: 'create',
      path: 'path',
      entity: 'foo',
      inward: (ctx)=>({}),
      outward: (ctx)=>({}),
    }
    let op0 = operator(ctx0)
    delete op0.inward
    delete op0.outward
    deepEqual(op0, {
      name: 'create',
      kind: 'req',
      path: 'path',
      entity: 'foo',
      // inward: (ctx)=>({}),
      // outward: (ctx)=>({}),

      params: [],
      alias: {},
      match: {},
      data: {},
      state: {},
    })
  })
})
