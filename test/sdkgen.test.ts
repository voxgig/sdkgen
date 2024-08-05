
import { test, describe } from 'node:test'
import { expect } from '@hapi/code'

import { Aontu } from 'aontu'
import { memfs } from 'memfs'


import {
  SdkGen
} from '../'



describe('sdkgen', () => {

  test('happy', async () => {
    expect(SdkGen).exist()

    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs, folder: '/top'
    })
    expect(sdkgen).exist()

    const root = makeRoot(sdkgen)
    const model = makeModel()
    // console.log('MODEL', model)

    const spec = {
      model,
      root
    }
    sdkgen.generate(spec)

    expect(vol.toJSON()).equal({
      '/top/js/README.md': '\n# foo js SDK\n  ',
      '/top/python/README.md': '\n# foo python SDK\n  ',
      '/top/java/README.md': '\n# foo java SDK\n  '
    })
  })


  function makeModel() {
    return Aontu(`
name: 'foo'

main: sdk: &: { name: .$KEY }

main: sdk: js: {}

main: sdk: python: {}

main: sdk: java: {}
`).gen()
  }


  function makeRoot(sdkgen: any) {
    const { cmp, each, Project, Folder, File, Code } = sdkgen

    return (model: any) => Project({ model }, () => {
      each(model.main.sdk, (sdk: any) => {
        Folder({ name: sdk.name }, () => {
          File({ name: 'README.md' }, () => {
            Code(`
# ${model.name} ${sdk.name} SDK
  `)
          })
        })
      })
    })
  }

})

