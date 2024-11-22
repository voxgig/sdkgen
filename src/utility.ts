
import Path from 'node:path'

// TODO: move to @voxgig/util as duplicated with @voxgig/sdkgen

const resolvePath = (ctx$: any, path: string): any => {
  // console.log('RP', ctx$.folder)
  const fullpath = Path.join(ctx$.folder, 'generate', 'dist', path)
  return fullpath
}


const requirePath = (ctx$: any, path: string, flags?: { ignore?: boolean }): any => {
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
