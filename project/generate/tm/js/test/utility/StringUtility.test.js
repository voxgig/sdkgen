
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { string } = client.utility()

const { stringify } = string


describe('StringUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof stringify)
  })

  test('stringify', async ()=>{
    equal('1',stringify(1))
    equal('a',stringify('a'))
    equal('false',stringify(false))
    equal('[2,b,true]',stringify([2,'b',true]))
    equal('[[3],{x:1}]',stringify([[3],{x:1}]))
    equal('{x:4,y:c,z:false}',stringify({x:4,y:'c',z:false}))
    equal('{x:{y:5,z:d},y:[6]}',stringify({x:{y:5,z:'d'},y:[6]}))
  })
})
