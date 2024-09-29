
import { test, describe } from 'node:test'
import { expect } from '@hapi/code'

import { Aontu } from 'aontu'
import { memfs } from 'memfs'


import { cmp, each, Project, Folder, File, Content } from 'jostraca'

import {
  SdkGen
} from '../'



describe('sdkgen', () => {

  test('happy', async () => {
    expect(SdkGen).exist()

    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      fs,
      folder: '/top'
    })
    expect(sdkgen).exist()

    const root = makeRoot()
    const model = makeModel()
    // console.log('MODEL', model)

    const spec = {
      model,
      root
    }

    await sdkgen.generate(spec)

    const voljson: any = vol.toJSON()
    expect(JSON.parse(voljson['/top/.jostraca/info.json']).exclude).equal([])

    expect(voljson).equal({
      '/top/.jostraca/info.json': voljson['/top/.jostraca/info.json'],
      '/top/foo/js/README.md': '\n# foo js SDK\n',
      '/top/foo/python/README.md': '\n# foo python SDK\n',
      '/top/foo/java/README.md': '\n# foo java SDK\n'
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


  function makeRoot() {
    return cmp(function Root(props: any) {
      const { model } = props
      Project({ model, folder: model.name }, () => {
        each(model.main.sdk, (sdk: any) => {
          Folder({ name: sdk.name }, () => {
            File({ name: 'README.md' }, () => {
              Content(`
# ${model.name} ${sdk.name} SDK
`)
            })
          })
        })
      })
    })
  }

})

