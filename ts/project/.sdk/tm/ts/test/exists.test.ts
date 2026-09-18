
import { test, describe } from 'node:test'
import { equal } from 'node:assert'


import { ProjectNameSDK } from '..'


describe('exists', async () => {

  test('test-mode', () => {
    const testsdk = ProjectNameSDK.test()
    equal(testsdk instanceof ProjectNameSDK, true,
      'ProjectNameSDK.test() must return a client synchronously')
  })

})
