
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { escurl } = client.utility()


describe('EscurlUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof escurl)
  })

  test('basic', async ()=>{
    equal('a-B_0.',escurl('a-B_0.'))
    equal('%20%3F%3A',escurl(' ?:'))
  })
})
