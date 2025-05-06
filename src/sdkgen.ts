/* Copyright (c) 2024 Richard Rodger, MIT License */

import * as Fs from 'node:fs'

import { prettyPino, Pino } from '@voxgig/util'

import { Jsonic } from 'jsonic'
import * as JostracaModule from 'jostraca'
import { Aontu, Context } from 'aontu'

import { SdkGenError, requirePath } from './utility'

import { Main } from './cmp/Main'
import { Entity } from './cmp/Entity'
import { Feature } from './cmp/Feature'
import { Readme } from './cmp/Readme'
import { ReadmeInstall } from './cmp/ReadmeInstall'
import { ReadmeOptions } from './cmp/ReadmeOptions'
import { ReadmeEntity } from './cmp/ReadmeEntity'
import { FeatureHook } from './cmp/FeatureHook'

import { action_target } from './action/target'
import { action_feature } from './action/feature'


// TODO: use shape
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
  now?: () => number

  // TODO: match Jostraca
  existing?: {
    txt?: any
    bin?: any
  }
}


const { Jostraca } = JostracaModule


const ACTION_MAP: any = {
  target: action_target,
  feature: action_feature,
}


function SdkGen(opts: SdkGenOptions) {
  const fs = opts.fs || Fs
  const folder = opts.folder || '../'
  const now = opts.now || (() => Date.now())

  const jostraca = Jostraca({ now })

  const pino = prettyPino('sdkgen', opts)
  const log = pino.child({ cmp: 'sdkgen' })


  async function generate(spec: any) {
    const start = Date.now()
    const { model, config } = spec

    log.info({ point: 'generate-start', start })
    log.debug({ point: 'generate-spec', spec })

    let Root = spec.root

    if (null == Root && null != config.root) {
      clear(config.root)
      const rootModule: any = require(config.root)
      Root = rootModule.Root
    }

    const jopts = {
      fs: () => fs,
      folder,
      log: log.child({ cmp: 'jostraca' }),
      meta: { spec },
      debug: opts.debug,
      existing: opts.existing
    }

    await jostraca.generate(jopts, () => Root({ model }))

    log.info({ point: 'generate-end' })

    return { ok: true, name: 'sdkgen' }
  }


  async function action(args: string[]) {
    const pargs = args.map(arg => Jsonic(arg))

    const actname = args[0]
    const action = ACTION_MAP[actname]

    if (null == action) {
      throw new SdkGenError('Unknown action: ' + actname)
    }

    const { model, tree } = resolveModel()

    const ctx = {
      fs: () => fs,
      log,
      folder: '.', // The `generate` folder,
      model,
      tree,
    }

    await action(pargs, ctx)
  }


  function resolveModel() {
    const path = './model/sdk.jsonic'
    const aopts = { path }
    const src = fs.readFileSync(path, 'utf8')

    const tree = Aontu(src, aopts)
    const hasErr = tree.err && 0 < tree.err.length

    if (hasErr) {
      for (let serr of tree.err) {
        let err: any = new SdkGenError('Model Error: ' + serr.msg)
        err.cause$ = [serr]

        if ('syntax' === serr.why) {
          err.uxmsg$ = true
        }

        // log.error({ fail: 'parse', point: 'guide-parse', file: path, err })


        err.rooterrs$ = tree.err
        throw err
      }
    }

    let genctx = new Context({ root: tree })
    const model = tree.gen(genctx)

    // TODO: collect all errors
    if (genctx.err && 0 < genctx.err.length) {
      const err: any = new SdkGenError('Model Error:\n' +
        (genctx.err.map((pe: any) => pe.msg)).join('\n'))
      // log.error({ fail: 'build', what: 'guide', file: path, err })
      err.errs = () => genctx.err
      throw err
    }

    // TODO: FIX: This is a hack to set the correct src file
    // aontu bug: url is empty
    tree.url = path


    model.const = { name: model.name }

    names(model.const, model.name)

    model.const.year = new Date().getFullYear()

    return {
      model,
      tree,
    }
  }


  return {
    pino,
    generate,
    action,
  }

}


SdkGen.makeBuild = async function(opts: SdkGenOptions) {
  let sdkgen: any = undefined
  // let apidef: any = undefined

  const config = {
    root: opts.root,
    def: opts.def || 'no-def',
    kind: 'openapi-3',
    model: opts.model ? (opts.model.folder + '/api.jsonic') : 'no-model',
    meta: opts.meta || {},
  }

  return async function build(model: any, build: any, ctx: any) {
    if (null == sdkgen) {
      sdkgen = SdkGen({
        ...opts,
        pino: build.log,
        debug: build.spec.debug,
      })
    }

    // await apidef.generate({ model, build, config })
    return await sdkgen.generate({ model, build, config })
  }
}



// Adapted from https://github.com/sindresorhus/import-fresh - Thanks!
function clear(path: string) {
  if (null == path) {
    return
  }

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
export const template: (root: any, path: string | string[]) => any = JostracaModule.template

export const deep: (...args: any[]) => any = JostracaModule.deep
export const omap: (...args: any[]) => any = JostracaModule.omap


export const Project: Component = JostracaModule.Project
export const Folder: Component = JostracaModule.Folder
export const File: Component = JostracaModule.File
export const Content: Component = JostracaModule.Content
export const Copy: Component = JostracaModule.Copy
export const Fragment: Component = JostracaModule.Fragment
export const Inject: Component = JostracaModule.Inject
export const Line: Component = JostracaModule.Line
export const Slot: Component = JostracaModule.Slot
export const List: Component = JostracaModule.List


export {
  Main,
  Entity,
  Feature,
  Readme,
  ReadmeInstall,
  ReadmeOptions,
  ReadmeEntity,
  FeatureHook,

  Jostraca,
  SdkGen,

  requirePath,
}
