
const { test, describe } = require('node:test')
const { equal, deepEqual } = require('node:assert')

const { NameSDK } = require('../..')

const client = NameSDK.test()
const { options } = client.utility()

const fetch = global.fetch

describe('OptionsUtility', ()=>{
  test('exists', async ()=>{
    equal('function', typeof options)
  })

  test('basic', async ()=>{
    const ctx0 = { utility: client.utility() }
    deepEqual(options(ctx0), {
      base: 'http://localhost:8000',
      entity: {},
      prefix: '',
      suffix: '',
      fetch,
    })

    ctx0.config = {
      options: {
        base: 'cbase',
        prefix: 'cpre-',
        suffix: 'csuf-',
        entity: {
          foo: {}
        }
      },
    }
    deepEqual(options(ctx0), {
      base: 'cbase',
      prefix: 'cpre-',
      suffix: 'csuf-',
      entity: {
        foo: {
          alias: {}
        }
      },
      fetch,
    })

  })
})
