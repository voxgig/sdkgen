
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test({
  base: 'BASE-',
  prefix: 'PREFIX-',
  suffix: 'SUFFIX-',
})
const { spec } = client.utility()


describe('SpecUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof spec)
  })

  test('basic', async ()=>{
    const ctx = {
      client,
      op: {
        name: 'list',
      },
      utility: client.utility(),
    }
    const spec0 = spec(ctx)
    // console.log('spec0', spec0)

    deepEqual(spec0, {
      base: 'BASE-',
      prefix: 'PREFIX-',
      path: undefined,
      suffix: 'SUFFIX-',
      method: 'GET',
      params: {},
      query: {},
      headers: {
        'content-type': 'application/json',
      },
      body: undefined,
      step: 'start',
      alias: {}
    })
  })
})
