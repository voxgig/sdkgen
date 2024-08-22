
import * as Fs from 'node:fs'

import { each } from 'jostraca'

import { bundleFromString, createConfig } from '@redocly/openapi-core'


async function PrepareOpenAPI(inspec: any, ctx: any) {

  // TODO: avoid rebuilding if unchanged

  // const source = Fs.readFileSync(ctx.def, 'utf8')

  // const config = await createConfig({})
  // const bundle = await bundleFromString({
  //   source,
  //   config,
  //   dereference: true,
  // })

  // // console.log('BUNDLE', bundle)

  // Fs.writeFileSync(
  //   ctx.folder + '/../model/def.jsonic',
  //   JSON.stringify(bundle.bundle.parsed, null, 2)
  // )


  // const spec: any = {}

  // spec.main = {
  //   sdk: {
  //     api: {
  //       // cmap
  //       /*
  //               path: each(bundle.bundle.parsed.paths, (path: any) => ({
  //                 param: {}
  //                 }))
  //                 */
  //     }
  //   }
  // }


  // Fs.writeFileSync(
  //   ctx.folder + '/../model/spec.jsonic',
  //   JSON.stringify(spec, null, 2)
  // )


  return false
}



export {
  PrepareOpenAPI
}
