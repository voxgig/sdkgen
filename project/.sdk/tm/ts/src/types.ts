
import { inspect } from 'node:util'

import { ProjectNameSDK } from './ProjectNameSDK'

import { Utility } from './utility/Utility'
import { getprop } from './utility/StructUtility'




// TODO: convert to classes


type Operation = {
  entity: string
  name: string
  select: string
  alts: Alt[]

  /*
  kind: string
  path: string
  pathalt: ({ path: string } & Record<string, boolean>)[],
  params: string[],
  alias: Record<string, string>
  state: Record<string, any>
  reqform: any
  resform: any
  validate: {
    params: Record<string, any>
  }
  check: Record<string, any>
  */
}


type Alt = {
  args: {
    param: any[]
  }
  rename: {
    param: Record<string, string>
  }
  method: string
  orig: string
  parts: string[]
  select: any
  active: boolean
  relations: any[]
}


type Spec = {
  parts: string[]

  headers: Record<string, string>
  alias: any
  base: string
  prefix: string
  suffix: string
  params: Record<string, string>
  query: Record<string, string>
  step: string
  method: string
  body: any
  url?: string

  path?: string

}


type Response = {
  status: number,
  statusText: string,
  headers: any,
  json: Function,
  err?: Error,
}


type Result = {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body?: any
  err?: any
  resdata?: any
  resmatch?: any
}


type Control = {
  throw?: boolean
  err?: any
  explain?: any
}


// TODO: move to own file
class Context {

  id = 'C' + ('' + Math.random()).substring(2, 10)

  // Store the output of each operation step.
  out: Record<string, any> = {}

  // Store for the current operation.
  current: WeakMap<String, any> = new WeakMap()


  ctrl: Record<string, any> = {}
  meta: Record<string, any> = {}

  client: ProjectNameSDK
  utility: Utility

  op: Operation
  alt: any

  config: Record<string, any>
  entopts: Record<string, any>
  options: Record<string, any>

  response?: Response
  result?: Result
  spec?: Spec

  data?: any
  reqdata?: any
  match?: any
  reqmatch?: any

  entity?: any

  // Shared persistent store.
  shared: WeakMap<String, any>


  constructor(ctxmap: Record<string, any>, basectx?: Context) {
    this.client = getprop(ctxmap, 'client', getprop(basectx, 'client'))
    this.utility = getprop(ctxmap, 'utility', getprop(basectx, 'utility'))

    this.ctrl = getprop(ctxmap, 'ctrl', getprop(basectx, 'ctrl', this.ctrl))
    this.meta = getprop(ctxmap, 'meta', getprop(basectx, 'meta', this.meta))

    this.op = getprop(ctxmap, 'op', getprop(basectx, 'op'))

    this.config = getprop(ctxmap, 'config', getprop(basectx, 'config'))
    this.entopts = getprop(ctxmap, 'entopts', getprop(basectx, 'entopts'))
    this.options = getprop(ctxmap, 'options', getprop(basectx, 'options'))

    this.entity = getprop(ctxmap, 'entity', getprop(basectx, 'entity'))
    this.shared = getprop(ctxmap, 'sharedd', getprop(basectx, 'shared'))

    this.data = getprop(ctxmap, 'data', {})
    this.reqdata = getprop(ctxmap, 'reqdata', {})
    this.match = getprop(ctxmap, 'match', {})
    this.reqmatch = getprop(ctxmap, 'reqmatch', {})
  }


  toJSON() {
    return {
      id: this.id,
      op: this.op,
      spec: this.spec,
      entity: this.entity,
      result: this.result,
      meta: this.meta,
    }
  }

  toString() {
    return 'Context ' + (this as any).utility?.struct.jsonify(this.toJSON())
  }

  [inspect.custom]() {
    return this.toString()
  }

}


type FeatureOptions = Record<string, any> | {
  active: boolean
}


interface Feature {
  version: string
  name: string
  active: boolean

  init: (ctx: Context, options: FeatureOptions) => void | Promise<any>

  PostConstruct: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>
  PostConstructEntity: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>
  SetData: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>
  GetData: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>
  GetMatch: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>

  PreOperation: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>
  PreSpec: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>
  PreRequest: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>
  PreResponse: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>
  PreResult: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>
  PostOperation: (this: ProjectNameSDK, ctx: Context) => void | Promise<any>
}


export {
  Context
}

export type {
  Operation,
  Alt,
  Spec,
  Control,
  FeatureOptions,
  Feature,
  Response,
  Result,
}
