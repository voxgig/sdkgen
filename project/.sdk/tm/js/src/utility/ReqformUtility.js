
/* Convert entity data or match query into a srtucture suitable for use as request data.
 *
 * The operation (op) property `reqform` is used to perform the data preparation.
 */
function reqform(ctx) {
  const { op, spec, result, utility } = ctx
  const { struct, error } = utility
  const { isfunc, transform } = struct

  if(spec) {
    spec.step = 'reqform'
  }
  
  // if (!result.ok) {
  //   return undefined
  // }

  try {
    const reqform = ctx.op.reqform
    const reqdata = isfunc(reqform) ? reqform(ctx) : transform(ctx.op, reqform)
    return reqdata
  }
  catch (err) {
    return error(ctx, err)
  }
}


module.exports = {
  reqform
}
