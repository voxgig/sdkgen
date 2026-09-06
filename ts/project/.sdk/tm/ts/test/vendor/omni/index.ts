// VENDORED: @voxgig/omni 0.1.4 (typescript/src/index.ts)
// Source: https://github.com/voxgig/omni @ 8c3e1b573a8d35796f7fc45e3226b977023cabf7  [tag: sdk-20260904-1610-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// @voxgig/omni - shared multi-language test runner.

export {
  CAPABILITIES,
  EXISTSMARK,
  NULLMARK,
  OmniError,
  SPECVERSION,
  UNDEFMARK,
  errify,
  fixjson,
  loadspec,
  makeRunner,
  match,
  matchval,
  nullmodifier,
  resolvespec,
} from './Runner'

export type { Flags, Provider, RunPack, RunSet, RunSetFlags, Runner, Subject } from './Runner'

export {
  clone,
  deepequal,
  getpath,
  islist,
  ismap,
  isnode,
  jsonstr,
  pathify,
  stringify,
  walk,
} from './Util'

export type { Json } from './Util'
