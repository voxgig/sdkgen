
import { Context } from '../types'

import { join } from './StructUtility'


function preparePath(ctx: Context) {
  const { alt } = ctx

  const path = join(alt.parts, '/', true)

  return path
}


export {
  preparePath
}
