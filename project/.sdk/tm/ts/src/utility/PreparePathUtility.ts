
import { Context } from '../types'


function preparePath(ctx: Context) {
  const join = ctx.utility.struct.join
  const target = ctx.target

  const path = join(target.parts, '/', true)

  return path
}


export {
  preparePath
}
