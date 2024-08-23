/* Copyright (c) 2024 Richard Rodger, MIT License */

import * as Fs from 'node:fs'

import { Jostraca } from 'jostraca'

import { ApiDef } from '@voxgig/apidef'


import { PrepareOpenAPI } from './prepare-openapi'


type SdkGenOptions = {
  folder: string
  def?: string
  fs: any
  model?: {
    folder: string
    entity: any
  }
}



function SdkGen(opts: SdkGenOptions) {
  const fs = opts.fs || Fs
  const folder = opts.folder || '.'
  const def = opts.def || 'def.yml'
  const jostraca = Jostraca()

  // const { cmp, each, Project, Folder, File, Code } = jostraca

  async function generate(spec: any) {
    const { model, root } = spec

    /*
    if (await prepare(spec, { fs, folder, def })) {
      return
    }
    */

    try {
      jostraca.generate(
        { fs, folder },
        () => root({ model })
      )
    }
    catch (err: any) {
      console.log('SDKGEN ERROR: ', err)
      throw err
    }
  }


  async function prepare(spec: any, ctx: any) {
    return await PrepareOpenAPI(spec, ctx)
  }


  return {
    generate,

    // cmp, each,

    // Project, Folder, File, Code
  }

}


SdkGen.makeBuild = async function(root: any, opts: SdkGenOptions) {
  const sdkgen = SdkGen(opts)

  const apidef = ApiDef()

  const spec = {
    def: opts.def,
    kind: 'openapi-3',
    model: opts.model ? (opts.model.folder + '/api.jsonic') : undefined,
    meta: {
      name: 'foo'
    },
    entity: opts.model ? opts.model.entity : undefined,
  }

  await apidef.watch(spec)

  return async function build(model: any, build: any) {
    // TODO: voxgig model needs to handle errors from here
    return sdkgen.generate({ model, build, root })
  }
}



export type {
  SdkGenOptions,
}


export {
  SdkGen,
}
