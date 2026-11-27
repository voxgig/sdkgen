// VENDORED: @voxgig/omni 0.2.0 (typescript/src/index.ts)
// Source: https://github.com/voxgig/omni @ ef55ad0fa48470146a81a1d652c859b03ebab6fc  [tag: sdk-20261127-1940-0]
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
