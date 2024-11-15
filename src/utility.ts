
import Path from 'node:path'


const resolvePath = (ctx$: any, path: string): any => {
  const fullpath = Path.join(ctx$.folder, '..', 'dist', path)
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



export {
  resolvePath,
  requirePath,
}
