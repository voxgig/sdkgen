
import Path from 'node:path'

import { JostracaResult } from 'jostraca'

import { KIT, getModelPath } from '@voxgig/apidef'


function resolvePath(ctx$: any, path: string): any {
  const fullpath = Path.join(ctx$.folder, '.sdk', 'dist', path)
  return fullpath
}


// True unless the model declares auth off. Templates use this to gate
// apikey-related code, docs, and examples for public APIs that need no
// authentication. Two opt-outs, in priority order:
//   1. main.kit.info.auth: false        (user-facing, set in api-info.jsonic)
//   2. main.kit.config.auth.active: false
function isAuthActive(model: any): boolean {
  const info = getModelPath(model, `main.${KIT}.info`,
    { only_active: false, required: false })
  if (info && false === info.auth) return false

  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return null == auth || false !== auth.active
}


function requirePath(ctx$: any, path: string, flags?: { ignore?: boolean }): any {
  const fullpath = resolvePath(ctx$, path)
  const ignore = null == flags?.ignore ? false : flags.ignore

  try {
    return require(fullpath)
  }
  catch (err: any) {
    if (ignore) {
      ctx$.log.warn({ point: 'require-missing', path, note: path })
    }
    else {
      throw err
    }
  }
}


class SdkGenError extends Error {
  constructor(...args: any[]) {
    super(...args)
    this.name = 'SdkGenError'
  }
}


export {
  resolvePath,
  requirePath,
  isAuthActive,
  SdkGenError,
}
