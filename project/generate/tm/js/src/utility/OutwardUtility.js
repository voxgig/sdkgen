
/* Convert entity data or match query into a srtucture suitable for use as request data.
 *
 * The operation (op) property `outward` is a function used to perform the data preparation.
 */
function outward(ctx) {
  const { op, spec, result, utility: { error } } = ctx

  if(spec) {
    spec.step = 'outward'
  }
  
  if (!result.ok) {
    return undefined
  }

  try {
    return op.outward(ctx)
  }
  catch (err) {
    if(result) {
      result.ok = false
      result.err = err
    }
    return error(ctx)
  }
}


module.exports = {
  outward
}
