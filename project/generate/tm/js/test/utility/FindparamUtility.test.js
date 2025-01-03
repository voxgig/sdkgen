
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { findparam } = client.utility()


describe('FindparamUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof findparam)
  })

  test('basic', async ()=>{
    const ctx0 = {op:{}}
    const key0 = 'a'
    equal(undefined, findparam(ctx0, key0))

    ctx0.op.kind = 'res'
    equal(undefined, findparam(ctx0, key0))

    ctx0.op.match = {}
    equal(undefined, findparam(ctx0, key0))

    ctx0.op.match = {a:'A'}
    equal('A', findparam(ctx0, key0))

    const key1 = 'b'
    equal(undefined, findparam(ctx0, key1))
    
    ctx0.op.alias = {}
    equal(undefined, findparam(ctx0, key1))

    ctx0.op.alias.b = 'a'
    ctx0.spec = {}
    equal('A', findparam(ctx0, key1))
    equal('A', findparam(ctx0, key0))
    equal('b', ctx0.spec.alias.a)
    
  })
})
