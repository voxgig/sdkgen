
import Fs from 'node:fs'

import type {
  JostracaResult
} from 'jostraca'


import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

type FsUtil = typeof Fs


// The model is produced by aontu/apidef and carries dynamic metadata
// (key$, val$, index$, and the Name/NAME case variants injected by
// jostraca's names()). These interfaces document the fields sdkgen relies
// on while the index signatures keep the genuinely-dynamic remainder
// accessible — a pragmatic middle ground until the model is shaped with
// `shape`.

// Case variants injected by jostraca's names() helper.
type NameCases = {
  name?: string
  Name?: string
  NAME?: string
}

// A dependency entry inside a target or feature `deps` block.
type ModelDep = {
  key$?: string
  version?: string
  active?: boolean
  kind?: string
  replace?: string
  [extra: string]: any
}

type ModelHook = {
  active?: boolean
  [extra: string]: any
}

type ModelFeature = NameCases & {
  active?: boolean
  title?: string
  version?: string
  hook?: Record<string, ModelHook>
  deps?: Record<string, Record<string, ModelDep>>
  [extra: string]: any
}

type ModelTarget = NameCases & {
  active?: boolean
  title?: string
  base?: string
  module?: { name?: string }
  srcfeature?: boolean
  [extra: string]: any
}

type ModelEntity = NameCases & {
  active?: boolean
  short?: string
  desc?: string
  op?: Record<string, any>
  relations?: { ancestors?: any }
  [extra: string]: any
}

type ModelKit = {
  info?: Record<string, any>
  config?: Record<string, any>
  target?: Record<string, ModelTarget>
  feature?: Record<string, ModelFeature>
  entity?: Record<string, ModelEntity>
  [extra: string]: any
}

type SdkModel = NameCases & {
  origin?: string
  const?: Record<string, any>
  main: {
    kit?: ModelKit
    def?: Record<string, any>
    [extra: string]: any
  }
  [extra: string]: any
}


type ActionContext = {
  fs: () => FsUtil,
  log: any,
  folder: string,
  model: SdkModel,
  url: string,
  opts: any,
  jostraca: any
}


type ActionResult = {
  jres: JostracaResult
}


export {
  KIT,
  getModelPath,
}

export type {
  ActionContext,
  ActionResult,
  SdkModel,
  ModelKit,
  ModelTarget,
  ModelFeature,
  ModelEntity,
  ModelDep,
  ModelHook,
}
