
import { Context } from '../types'


import { getprop } from './StructUtility'


function prepareHeaders(ctx: Context) {
  const utility = ctx.utility
  const clone = utility.struct.clone

  const client = ctx.client

  const options = client.options()

  let out = clone(getprop(options, 'headers', {}))

  return out
}


export {
  prepareHeaders
}
