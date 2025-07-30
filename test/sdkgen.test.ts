
import { test, describe } from 'node:test'
import { expect } from '@hapi/code'

import { Aontu } from 'aontu'
import { memfs } from 'memfs'


import { cmp, each, Project, Folder, File, Content } from 'jostraca'

import {
  SdkGen
} from '../'


// 2025-01-01T00:00:00.000Z
const START_TIME = 1735689600000


describe('sdkgen', () => {

  test('merge', async () => {
    let nowI = 0
    const now = () => START_TIME + (++nowI * (60 * 1000))

    expect(SdkGen).exist()

    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({
      now, fs, folder: '/top', root: '',
      existing: { txt: { merge: true } }
    })
    expect(sdkgen).exist()

    const root = makeRoot()
    const model = makeModel()
    // console.log('MODEL', model)

    const spec = {
      model,
      root,
    }

    let res0 = await sdkgen.generate(spec)
    expect(res0).includes({ ok: true })

    const voljson: any = vol.toJSON()

    expect(voljson).equals({
      '/top/foo/js/README.md': '\n# foo js SDK\n# index=0\n',
      '/top/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
      '/top/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
      '/top/.jostraca/generated/foo/js/README.md': '\n# foo js SDK\n# index=0\n',
      '/top/.jostraca/generated/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
      '/top/.jostraca/generated/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
      '/top/.jostraca/jostraca.meta.log': '{\n' +
        '  "foldername": ".jostraca",\n' +
        '  "filename": "jostraca.meta.log",\n' +
        '  "last": 1735690140000,\n' +
        '  "hlast": 2025010100090000,\n' +
        '  "files": {\n' +
        '    "foo/js/README.md": {\n' +
        '      "action": "write",\n' +
        '      "path": "foo/js/README.md",\n' +
        '      "exists": false,\n' +
        '      "actions": [\n' +
        '        "write"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735689840000,\n' +
        '      "hwhen": 2025010100040000\n' +
        '    },\n' +
        '    "foo/python/README.md": {\n' +
        '      "action": "write",\n' +
        '      "path": "foo/python/README.md",\n' +
        '      "exists": false,\n' +
        '      "actions": [\n' +
        '        "write"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735689960000,\n' +
        '      "hwhen": 2025010100060000\n' +
        '    },\n' +
        '    "foo/java/README.md": {\n' +
        '      "action": "write",\n' +
        '      "path": "foo/java/README.md",\n' +
        '      "exists": false,\n' +
        '      "actions": [\n' +
        '        "write"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735690080000,\n' +
        '      "hwhen": 2025010100080000\n' +
        '    }\n' +
        '  }\n' +
        '}',
      '/top/.jostraca/.gitignore': '\njostraca.meta.log\ngenerated\n'
    })

    // Modify a generated file
    fs.writeFileSync('/top/foo/js/README.md', '\n# foo js SDK\n# EXTRA\n# index=0\n')

    let res1 = await sdkgen.generate(spec)
    // console.log('RES1', res1)
    expect(res1).includes({ ok: true })

    const voljson1: any = vol.toJSON()
    expect(voljson1).equals({
      '/top/foo/js/README.md': '\n# foo js SDK\n# EXTRA\n# index=0\n',
      '/top/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
      '/top/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
      '/top/.jostraca/generated/foo/js/README.md': '\n# foo js SDK\n# index=0\n',
      '/top/.jostraca/generated/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
      '/top/.jostraca/generated/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
      '/top/.jostraca/jostraca.meta.log': '{\n' +
        '  "foldername": ".jostraca",\n' +
        '  "filename": "jostraca.meta.log",\n' +
        '  "last": 1735691160000,\n' +
        '  "hlast": 2025010100260000,\n' +
        '  "files": {\n' +
        '    "foo/js/README.md": {\n' +
        '      "action": "merge",\n' +
        '      "path": "foo/js/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "merge"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735690860000,\n' +
        '      "hwhen": 2025010100210000\n' +
        '    },\n' +
        '    "foo/python/README.md": {\n' +
        '      "action": "skip",\n' +
        '      "path": "foo/python/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "skip"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735690980000,\n' +
        '      "hwhen": 2025010100230000\n' +
        '    },\n' +
        '    "foo/java/README.md": {\n' +
        '      "action": "skip",\n' +
        '      "path": "foo/java/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "skip"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735691100000,\n' +
        '      "hwhen": 2025010100250000\n' +
        '    }\n' +
        '  }\n' +
        '}',
      '/top/.jostraca/.gitignore': '\njostraca.meta.log\ngenerated\n'
    })


    // generate again
    let res2 = await sdkgen.generate(spec)
    expect(res2).includes({ ok: true })

    const voljson2: any = vol.toJSON()
    expect(voljson2).equals({
      '/top/foo/js/README.md': '\n# foo js SDK\n# EXTRA\n# index=0\n',
      '/top/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
      '/top/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
      '/top/.jostraca/generated/foo/js/README.md': '\n# foo js SDK\n# index=0\n',
      '/top/.jostraca/generated/foo/python/README.md': '\n# foo python SDK\n# index=0\n',
      '/top/.jostraca/generated/foo/java/README.md': '\n# foo java SDK\n# index=0\n',
      '/top/.jostraca/jostraca.meta.log': '{\n' +
        '  "foldername": ".jostraca",\n' +
        '  "filename": "jostraca.meta.log",\n' +
        '  "last": 1735692180000,\n' +
        '  "hlast": 2025010100430000,\n' +
        '  "files": {\n' +
        '    "foo/js/README.md": {\n' +
        '      "action": "merge",\n' +
        '      "path": "foo/js/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "merge"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735691880000,\n' +
        '      "hwhen": 2025010100380000\n' +
        '    },\n' +
        '    "foo/python/README.md": {\n' +
        '      "action": "skip",\n' +
        '      "path": "foo/python/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "skip"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735692000000,\n' +
        '      "hwhen": 2025010100400000\n' +
        '    },\n' +
        '    "foo/java/README.md": {\n' +
        '      "action": "skip",\n' +
        '      "path": "foo/java/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "skip"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735692120000,\n' +
        '      "hwhen": 2025010100420000\n' +
        '    }\n' +
        '  }\n' +
        '}',
      '/top/.jostraca/.gitignore': '\njostraca.meta.log\ngenerated\n'
    })


    // update model
    model.zed.a = 1
    let res3 = await sdkgen.generate(spec)
    expect(res3).includes({ ok: true })

    const voljson3: any = vol.toJSON()
    expect(voljson3).equals({
      '/top/foo/js/README.md': '\n' +
        '# foo js SDK\n' +
        '<<<<<<< EXISTING: 2025-01-01T00:43:00.000Z/merge\n' +
        '# EXTRA\n' +
        '# index=0\n' +
        '=======\n' +
        '# index=1\n' +
        '>>>>>>> GENERATED: 2025-01-01T00:47:00.000Z/merge\n',
      '/top/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
      '/top/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
      '/top/.jostraca/generated/foo/js/README.md': '\n# foo js SDK\n# index=1\n',
      '/top/.jostraca/generated/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
      '/top/.jostraca/generated/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
      '/top/.jostraca/jostraca.meta.log': '{\n' +
        '  "foldername": ".jostraca",\n' +
        '  "filename": "jostraca.meta.log",\n' +
        '  "last": 1735693560000,\n' +
        '  "hlast": 2025010101060000,\n' +
        '  "files": {\n' +
        '    "foo/js/README.md": {\n' +
        '      "action": "merge",\n' +
        '      "path": "foo/js/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "merge"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": true,\n' +
        '      "when": 1735692900000,\n' +
        '      "hwhen": 2025010100550000\n' +
        '    },\n' +
        '    "foo/python/README.md": {\n' +
        '      "action": "merge",\n' +
        '      "path": "foo/python/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "merge"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735693200000,\n' +
        '      "hwhen": 2025010101000000\n' +
        '    },\n' +
        '    "foo/java/README.md": {\n' +
        '      "action": "merge",\n' +
        '      "path": "foo/java/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "merge"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735693500000,\n' +
        '      "hwhen": 2025010101050000\n' +
        '    }\n' +
        '  }\n' +
        '}',
      '/top/.jostraca/.gitignore': '\njostraca.meta.log\ngenerated\n'
    })


    // Modify a generated file
    fs.writeFileSync('/top/foo/js/README.md', '\n# foo js SDK\n# EXTRA\n# index=A\n')


    let res4 = await sdkgen.generate(spec)
    expect(res4).includes({ ok: true })

    const voljson4: any = vol.toJSON()
    expect(voljson4).equals({
      '/top/foo/js/README.md': '\n# foo js SDK\n# EXTRA\n# index=A\n',
      '/top/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
      '/top/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
      '/top/.jostraca/generated/foo/js/README.md': '\n# foo js SDK\n# index=1\n',
      '/top/.jostraca/generated/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
      '/top/.jostraca/generated/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
      '/top/.jostraca/jostraca.meta.log': '{\n' +
        '  "foldername": ".jostraca",\n' +
        '  "filename": "jostraca.meta.log",\n' +
        '  "last": 1735694580000,\n' +
        '  "hlast": 2025010101230000,\n' +
        '  "files": {\n' +
        '    "foo/js/README.md": {\n' +
        '      "action": "merge",\n' +
        '      "path": "foo/js/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "merge"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735694280000,\n' +
        '      "hwhen": 2025010101180000\n' +
        '    },\n' +
        '    "foo/python/README.md": {\n' +
        '      "action": "skip",\n' +
        '      "path": "foo/python/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "skip"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735694400000,\n' +
        '      "hwhen": 2025010101200000\n' +
        '    },\n' +
        '    "foo/java/README.md": {\n' +
        '      "action": "skip",\n' +
        '      "path": "foo/java/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "skip"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735694520000,\n' +
        '      "hwhen": 2025010101220000\n' +
        '    }\n' +
        '  }\n' +
        '}',
      '/top/.jostraca/.gitignore': '\njostraca.meta.log\ngenerated\n'
    })


    // generate again

    let res5 = await sdkgen.generate(spec)
    expect(res5).includes({ ok: true })

    const voljson5: any = vol.toJSON()
    expect(voljson5).equals({
      '/top/foo/js/README.md': '\n# foo js SDK\n# EXTRA\n# index=A\n',
      '/top/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
      '/top/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
      '/top/.jostraca/generated/foo/js/README.md': '\n# foo js SDK\n# index=1\n',
      '/top/.jostraca/generated/foo/python/README.md': '\n# foo python SDK\n# index=1\n',
      '/top/.jostraca/generated/foo/java/README.md': '\n# foo java SDK\n# index=1\n',
      '/top/.jostraca/jostraca.meta.log': '{\n' +
        '  "foldername": ".jostraca",\n' +
        '  "filename": "jostraca.meta.log",\n' +
        '  "last": 1735695600000,\n' +
        '  "hlast": 2025010101400000,\n' +
        '  "files": {\n' +
        '    "foo/js/README.md": {\n' +
        '      "action": "merge",\n' +
        '      "path": "foo/js/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "merge"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735695300000,\n' +
        '      "hwhen": 2025010101350000\n' +
        '    },\n' +
        '    "foo/python/README.md": {\n' +
        '      "action": "skip",\n' +
        '      "path": "foo/python/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "skip"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735695420000,\n' +
        '      "hwhen": 2025010101370000\n' +
        '    },\n' +
        '    "foo/java/README.md": {\n' +
        '      "action": "skip",\n' +
        '      "path": "foo/java/README.md",\n' +
        '      "exists": true,\n' +
        '      "actions": [\n' +
        '        "skip"\n' +
        '      ],\n' +
        '      "protect": false,\n' +
        '      "conflict": false,\n' +
        '      "when": 1735695540000,\n' +
        '      "hwhen": 2025010101390000\n' +
        '    }\n' +
        '  }\n' +
        '}',
      '/top/.jostraca/.gitignore': '\njostraca.meta.log\ngenerated\n'
    })

  })


  function makeModel() {
    return Aontu(`
name: 'foo'

zed: a: 0

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
# index=${model.zed.a}
`)
            })
          })
        })
      })
    })
  }

})

