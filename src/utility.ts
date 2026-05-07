
import Path from 'node:path'

import { JostracaResult } from 'jostraca'

import { KIT, getModelPath } from '@voxgig/apidef'


function resolvePath(ctx$: any, path: string): any {
  const fullpath = Path.join(ctx$.folder, '.sdk', 'dist', path)
  return fullpath
}


// True unless the model explicitly declares main.kit.config.auth.active: false.
// Used by templates to gate apikey-related code, docs, and examples for
// public APIs that need no authentication.
function isAuthActive(model: any): boolean {
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
