
const { test, describe } = require('node:test')
const { equal } = require('node:assert')


const { ProjectNameSDK } = require('..')


describe('exists', async () => {

  test('test-mode', async () => {
    const testsdk = await ProjectNameSDK.test()
    equal(null !== testsdk, true)
  })

})
