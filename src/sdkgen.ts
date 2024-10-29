/* Copyright (c) 2024 Richard Rodger, MIT License */

import * as Fs from 'node:fs'


import * as JostracaModule from 'jostraca'

import Pino from 'pino'
import PinoPretty from 'pino-pretty'


import { ApiDef } from '@voxgig/apidef'


import { Main } from './cmp/Main'
import { Entity } from './cmp/Entity'
import { Feature } from './cmp/Feature'
import { Readme } from './cmp/Readme'
import { ReadmeInstall } from './cmp/ReadmeInstall'
import { ReadmeOptions } from './cmp/ReadmeOptions'
import { ReadmeEntity } from './cmp/ReadmeEntity'

import { PrepareOpenAPI } from './prepare-openapi'


type SdkGenOptions = {
  folder: string
  fs: any
  root?: string
  def?: string
  model?: {
    folder: string
    entity: any
  }
  meta?: {
    name: string
  }
  debug?: boolean | string
  pino?: ReturnType<typeof Pino>
}


const { Jostraca } = JostracaModule


function SdkGen(opts: SdkGenOptions) {
  const fs = opts.fs || Fs
  const folder = opts.folder || '.'
  const def = opts.def || 'def.yml'
  const jostraca = Jostraca()

  let pino = opts.pino

  if (null == pino) {
    let pretty = PinoPretty({ sync: true })
    const level = null == opts.debug ? 'info' :
      true === opts.debug ? 'debug' :
        'string' == typeof opts.debug ? opts.debug :
          'info'

    pino = Pino({
      name: 'sdkgen',
      level,
    },
      pretty
    )
  }


  const log = pino.child({ cmp: 'sdkgen' })



  async function generate(spec: any) {
    const start = Date.now()
    const { model, config } = spec

    log.info({ point: 'generate-start', start })
    log.debug({ point: 'generate-spec', spec })

    // console.log('SDKGEN.config', config)

    let Root = spec.root

    if (null == Root) {
      clear(config.root)
      const rootModule = require(config.root)
      Root = rootModule.Root
    }

    /*
    if (await prepare(spec, { fs, folder, def })) {
      return
    }
    */

    // console.log('OPTIONS', opts)

    const opts = { fs, folder, meta: { spec } }

    try {
      await jostraca.generate(opts, () => Root({ model }))
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
    pino,
    generate,
  }

}


SdkGen.makeBuild = async function(opts: SdkGenOptions) {
  const sdkgen = SdkGen(opts)

  const apidef = ApiDef({
    pino: sdkgen.pino,
  })

  const config = {
    def: opts.def,
    kind: 'openapi-3',
    model: opts.model ? (opts.model.folder + '/api.jsonic') : undefined,
    meta: opts.meta || {},
  }

  await apidef.watch(config)

  return async function build(model: any, build: any) {
    // TODO: voxgig model needs to handle errors from here
    return sdkgen.generate({ model, build, config })
  }
}



// Adapted from https://github.com/sindresorhus/import-fresh - Thanks!
function clear(path: string) {
  let filePath = require.resolve(path)

  if (require.cache[filePath]) {
    const children = require.cache[filePath].children.map(child => child.id)

    // Delete module from cache
    delete require.cache[filePath]

    for (const id of children) {
      clear(id)
    }
  }


  if (require.cache[filePath] && require.cache[filePath].parent) {
    let i = require.cache[filePath].parent.children.length

    while (i--) {
      if (require.cache[filePath].parent.children[i].id === filePath) {
        require.cache[filePath].parent.children.splice(i, 1)
      }
    }
  }

}




export type {
  SdkGenOptions,
}



type Component = (props: any, children?: any) => void


// Prevents TS2742
export const cmp: (component: Function) => Component = JostracaModule.cmp
export const names: (base: any, name: string, prop?: string) => any = JostracaModule.names
export const each: (subject?: any, apply?: any) => any = JostracaModule.each
export const snakify: (input: any[] | string) => string = JostracaModule.snakify
export const camelify: (input: any[] | string) => string = JostracaModule.camelify
export const kebabify: (input: any[] | string) => string = JostracaModule.kebabify
export const select: (key: any, map: Record<string, Function>) => any = JostracaModule.select
export const cmap: (o: any, p: any) => any = JostracaModule.cmap
export const vmap: (o: any, p: any) => any = JostracaModule.vmap
export const get: (root: any, path: string | string[]) => any = JostracaModule.get
export const getx: (root: any, path: string | string[]) => any = JostracaModule.getx

export const Project: Component = JostracaModule.Project
export const Folder: Component = JostracaModule.Folder
export const File: Component = JostracaModule.File
export const Content: Component = JostracaModule.Content
export const Copy: Component = JostracaModule.Copy
export const Fragment: Component = JostracaModule.Fragment
export const Inject: Component = JostracaModule.Inject


export {
  Main,
  Entity,
  Feature,
  Readme,
  ReadmeInstall,
  ReadmeOptions,
  ReadmeEntity,

  Jostraca,
  SdkGen,
}
