
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { escurl } = require('../../src/utility/EscurlUtility')


describe('EscurlUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof escurl)
  })

  test('stringify', async ()=>{
    equal('a-B_0.',escurl('a-B_0.'))
    equal('%20%3F%3A',escurl(' ?:'))
  })
})
