
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { empty } = client.utility()


describe('EmptyUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof empty)
  })

  test('basic', async ()=>{
    equal(true, empty(null))
    equal(true, empty(undefined))
    equal(true, empty(''))
    equal(false, empty('x'))
    equal(false, empty({}))
  })
})
