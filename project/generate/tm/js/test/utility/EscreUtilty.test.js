
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { escre } = client.utility()


describe('EscreUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof escre)
  })

  test('basic', async ()=>{
    equal('a0_',escre('a0_'))
    equal('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\', escre('.*+?^${}()|[]\\'))
  })
})
