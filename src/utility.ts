
import Path from 'node:path'


const resolvePath = (ctx$: any, path: string): any => {
  const fullpath = Path.join(ctx$.folder, '..', 'dist', path)
  return fullpath
}


export {
  resolvePath
}
