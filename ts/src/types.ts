
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
  module?: { name?: string, path?: string, package?: string, goversion?: string }
  srcfeature?: boolean

  // Where this target's files land. Present means OUT OF TREE: the target
  // gets its own generate() pass rooted at `path` rather than a folder inside
  // the SDK repo — see cmp/ExternalTarget and
  // docs/explanation/out-of-tree-targets.
  //
  // Typed rather than left to the index signature because `externalTargets()`
  // decides from these keys whether to write OUTSIDE the repo, and a
  // destination path read off a bare `any` is one a rename can silently
  // change to undefined.
  output?: {
    path?: string
    repo?: string
    adopt?: boolean
    sdkrel?: string
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

  // How `package update` fetches a new version. Injectable so tests do not
  // shell out, and so a caller with its own dependency management (a
  // monorepo, a vendored checkout) can supply one. Defaults to npm.
  fetchPackage?: (pkgname: string, actx: ActionContext) => Promise<void>
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
