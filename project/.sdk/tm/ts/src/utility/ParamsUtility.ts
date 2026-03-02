
import { Context } from '../types'


function params(ctx: Context) {
  const utility = ctx.utility
  const findparam = utility.findparam

  // const struct = utility.struct
  // const { validate } = struct

  const alt = ctx.alt

  let param = alt.args.param
  let reqmatch = ctx.reqmatch

  param = param || []
  reqmatch = reqmatch || {}

  let out: any = {}
  for (let pd of param) {
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
  params
}
