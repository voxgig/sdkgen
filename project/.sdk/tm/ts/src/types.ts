
import { ProjectNameSDK } from './ProjectNameSDK'

import { Target } from './Target'
import { Context } from './Context'
import { Control } from './Control'
import { Operation } from './Operation'
import { Response } from './Response'
import { Result } from './Result'
import { Spec } from './Spec'


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
  Target,
  Context,
  Control,
  Operation,
  Response,
  Result,
  Spec,
}


export type {
  Feature,
  FeatureOptions,
}
