
import { Context } from '../types'


function prepareParams(ctx: Context) {
  const utility = ctx.utility
  const findparam = utility.param

  // const struct = utility.struct
  // const validate = struct.validate

  const target = ctx.target

  let params = target.args.params
  // let reqmatch = ctx.reqmatch

  params = params || []
  // reqmatch = reqmatch || {}

  let out: any = {}
  for (let pd of params) {
    let val = findparam(ctx, pd)
    if (null != val) {
      out[pd.name] = val
    }
  }

  // TODO: review
  // out = validate(out, target.validate.params)

  return out
}


export {
  prepareParams
}
