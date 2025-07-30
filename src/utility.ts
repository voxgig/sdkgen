
import Path from 'node:path'

import { JostracaResult } from 'jostraca'



function resolvePath(ctx$: any, path: string): any {
  const fullpath = Path.join(ctx$.folder, '.sdk', 'dist', path)
  return fullpath
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
  SdkGenError,
}
