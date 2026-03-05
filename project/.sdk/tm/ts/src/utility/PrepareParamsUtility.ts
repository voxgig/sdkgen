
import { Context } from '../types'


function prepareParams(ctx: Context) {
  const utility = ctx.utility
  const findparam = utility.param

  // const struct = utility.struct
  // const { validate } = struct

  const alt = ctx.alt

  let params = alt.args.param
  let reqmatch = ctx.reqmatch

  params = params || []
  reqmatch = reqmatch || {}

  let out: any = {}
  for (let pd of params) {
    let val = findparam(ctx, pd)
    if (null != val) {
      out[pd.name] = val
    }
  }

  // TODO: review
  // out = validate(out, op.validate.params)

  return out
}


export {
  prepareParams
}
