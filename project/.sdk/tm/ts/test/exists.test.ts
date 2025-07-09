
import { test, describe } from 'node:test'
import { equal } from 'node:assert'


import { ProjectNameSDK } from '..'


describe('exists', async () => {

  test('test-mode', async () => {
    const testsdk = await ProjectNameSDK.test()
    // console.log('testsdk', testsdk)
    equal(null !== testsdk, true)
  })

})
