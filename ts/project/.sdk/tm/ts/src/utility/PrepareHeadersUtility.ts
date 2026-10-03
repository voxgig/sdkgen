
import { Context } from '../types'

import { callArgs } from './ParamUtility'
import { mediaHeaders } from './MediaUtility'


function prepareHeaders(ctx: Context) {
  const struct = ctx.utility.struct
  const clone = struct.clone
  const getprop = struct.getprop
  const stringify = struct.stringify

  const client = ctx.client

  const options = client.options()

  let out = mediaHeaders(ctx.point, clone(getprop(options, 'headers', {})))

  // A header argument replaces a default of the same name, whatever its case.
  for (const arg of callArgs(ctx, 'header')) {
    if (null != arg.val) {
      const wire = arg.wire.toLowerCase()
      for (const key of Object.keys(out)) {
        if (wire === key.toLowerCase()) delete out[key]
      }
      out[wire] = stringify(arg.val)
    }
  }

  return out
}


export {
  prepareHeaders
}
