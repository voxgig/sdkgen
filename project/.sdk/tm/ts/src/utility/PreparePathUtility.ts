
import { Context } from '../types'

import { joinurl } from './StructUtility'


function preparePath(ctx: Context) {
  const { alt } = ctx

  const path = joinurl(alt.parts)

  return path
}


export {
  preparePath
}
