
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { fullurl } = client.utility()


describe('FullurlUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof fullurl)
  })

  test('basic', async ()=>{
    const ctx0 = {
      op: {
        params: ['a'],
      },
      spec: {
        base: 'base-',
        prefix: 'prefix-',
        suffix: 'suffix-',
        path: '/p0/{a}',
        params: {
          a: 'A'
        },
        query: {
          b: 'B'
        },
        alias: {}
      },
      utility: client.utility()
    }

    equal('base-/prefix-/p0/A/suffix-?b=B',fullurl(ctx0))
  })


  test('alias-duplicate', async ()=>{
    const ctx0 = {
      op: {
        kind: 'res',
        params: ['foo_id'],
        alias: {
          foo_id: 'id'
        },
        match: {
          id: 'A',
        },
      },
      spec: {
        base: 'base-',
        prefix: 'prefix-',
        suffix: 'suffix-',
        path: '/p0/{foo_id}',
        params: {},
        alias: {}
      },
      utility: client.utility()
    }

    equal('base-/prefix-/p0/A/suffix-',fullurl(ctx0))
  })

})
