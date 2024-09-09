
import Path from 'node:path'


const resolvePath = (ctx$: any, path: string): any => {
  const fullpath = Path.join(ctx$.folder, '..', 'dist', path)
  return fullpath
}


const requirePath = (ctx$: any, path: string, flags?: { ignore?: boolean }): any => {
  const fullpath = resolvePath(ctx$, path)
  const ignore = null == flags?.ignore ? true : flags.ignore

  try {
    return require(fullpath)
  }
  catch (err: any) {
    if (!ignore) {
      throw err
    }
    console.warn('MISSING: ', path)
  }
}



export {
  resolvePath,
  requirePath,
}
