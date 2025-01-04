
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { joinurl } = client.utility()


describe('JoinurlUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof joinurl)
  })

  test('basic', async ()=>{
    equal('a', joinurl('a'))
    equal('a/b', joinurl('a','b'))
    equal('a/b', joinurl('a',null,'b'))
    equal('a/b', joinurl('a/','b'))
    equal('a/b', joinurl('a','/b'))
    equal('a/b', joinurl('a/','/b'))
    equal('a/b', joinurl('a/','//b'))
    equal('a/b/c/d', joinurl('a','b', 'c//d'))
    equal('//a/b', joinurl('//a','/b'))
  })
})
