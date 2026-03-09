
import { Context } from '../types'

/* Convert entity data or match query into a srtucture suitable for use as request data.
 *
 * The operation (op) property `reqform` is used to perform the data preparation.
 */
function transformRequest(ctx: Context) {
  const spec = ctx.spec
  const utility = ctx.utility
  const target = ctx.target
  const isfunc = utility.struct.isfunc
  const transform = utility.struct.transform

  if (spec) {
    spec.step = 'reqform'
  }

  try {
    const reqform = target.transform.req
    const reqdata = isfunc(reqform) ? reqform(ctx) : transform({
      reqdata: ctx.reqdata
    }, reqform)

    return reqdata
  }
  catch (err) {
    return utility.makeError(ctx, err)
  }
}


export {
  transformRequest
}
