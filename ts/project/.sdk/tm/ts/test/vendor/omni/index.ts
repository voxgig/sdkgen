// VENDORED: @voxgig/omni 0.1.2 (typescript/src/index.ts)
// Source: https://github.com/voxgig/omni @ 5956cc4e5ecdaeebd11eab8bb4b9462dfc76e018
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
