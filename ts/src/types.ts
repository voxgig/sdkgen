
import Fs from 'node:fs'

import type {
  JostracaResult
} from 'jostraca'


import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

type FsUtil = typeof Fs



type NameCases = {
  name?: string
  Name?: string
  NAME?: string
}

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
  // Transport role (station design §8.4): 'base' replaces the transport
  // slot (only `test`), 'wrap' wraps it, 'none' is hook-only. Schema
  // default is 'none'; configDefinition carries it into the embedded
  // config beside the feature's `config.options`.
  transport?: string
  hook?: Record<string, ModelHook>
  deps?: Record<string, Record<string, ModelDep>>
  [extra: string]: any
}

type ModelTarget = NameCases & {
  active?: boolean
  title?: string
  base?: string
  module?: { name?: string, path?: string, package?: string, goversion?: string }
  srcfeature?: boolean

  output?: {
    path?: string
    repo?: string
    create?: boolean
    adopt?: boolean
    sdkrel?: string
    root?: boolean
  }

  // Per-generation-phase activation. A consumer target (go-cli, go-mcp,
  // py-data, seneca-provider) switches every phase off and emits its whole
  // package from Main. Absent — or present with no `active` — means the phase
  // runs: the defaults are inclusive.
  phase?: Record<string, { active?: boolean }>

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
  jostraca: any,

  // PER-INVOCATION action arguments — `--only`, `--alias` — as opposed to
  // generator configuration. `debug` and `dryrun` reach actions through the
  // `SdkGen({…})` constructor because they describe the generator; these
  // describe one command, so smuggling them through the constructor would
  // make a second `action()` call on the same instance inherit them.
  flags?: Record<string, any>

  fetchPackage?: (pkgname: string, actx: ActionContext) => Promise<void>
}


type ActionResult = {
  jres?: JostracaResult
  report?: ActionReport
}


type ActionReport = {
  ok: boolean
  summary?: string
  [key: string]: any
}


export {
  KIT,
  getModelPath,
}

export type {
  ActionContext,
  ActionResult,
  ActionReport,
  SdkModel,
  ModelKit,
  ModelTarget,
  ModelFeature,
  ModelEntity,
  ModelDep,
  ModelHook,
}
