/* Copyright (c) 2024 Richard Rodger, MIT License */

import * as Fs from 'node:fs'

import { Jostraca } from 'jostraca'


type SdkGenOptions = {
  folder: string
  fs: any
}




function SdkGen(opts: SdkGenOptions) {
  const fs = opts.fs || Fs
  const folder = opts.folder || '.'
  const jostraca = Jostraca()

  // const { cmp, each, Project, Folder, File, Code } = jostraca

  function generate(spec: any) {
    const { model, root } = spec

    jostraca.generate(
      { fs, folder },
      () => root({ model })
    )
  }

  return {
    generate,

    // cmp, each,

    // Project, Folder, File, Code
  }

}


SdkGen.makeBuild = function(root: any, opts: SdkGenOptions) {
  const sdkgen = SdkGen(opts)

  return function build(model: any, build: any) {
    return sdkgen.generate({ model, build, root })
  }
}



export type {
  SdkGenOptions,
}


export {
  SdkGen,
}
