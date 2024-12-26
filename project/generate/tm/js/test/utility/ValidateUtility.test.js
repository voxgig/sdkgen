
const { test, describe } = require('node:test')
const { equal, deepEqual, throws } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { validate } = client.utility()

const {
  string,
  array,
  object,
  func,
} = validate


describe('ValidateUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof string)
  })


  test('string', async ()=>{
    equal('a',string('a'))
    equal('',string('',true))
    equal('',string(undefined,true))

    throws(()=>string(null),null,'Error: statuspage: invalid string: null')
    throws(()=>string(null,false,'foo'),null,'Error: statuspage: foo: invalid string: null')
  })


  test('array', async ()=>{
    deepEqual([],array([]))
    deepEqual([1],array([1]))
    deepEqual([],array(undefined,true))

    throws(()=>array(null),null,'Error: statuspage: invalid array: null')
    throws(()=>array(null,false,'foo'),null,'Error: statuspage: foo: invalid array: null')
  })

  
  test('object', async ()=>{
    deepEqual({},object({}))
    deepEqual({x:1},object({x:1}))
    deepEqual({},object(undefined,true))

    throws(()=>object(null),null,'Error: statuspage: invalid object: null')
    throws(()=>object(null,false,'foo'),null,'Error: statuspage: foo: invalid object: null')
  })

  
  test('func', async ()=>{
    equal((()=>1).toString(),func(()=>1).toString())
    equal(((arg)=>arg).toString(),func(undefined,true))

    throws(()=>func(null),null,'Error: statuspage: invalid function: null')
    throws(()=>func(null,false,'foo'),null,'Error: statuspage: foo: invalid function: null')
  })

})
