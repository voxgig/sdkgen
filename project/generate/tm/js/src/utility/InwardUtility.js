
/* Convert data from request result into a structure suitable for use as entity data.
 *
 * The operation (op) property `inward` is a function used to perform the data extraction.
 */
function inward(ctx) {
  const { op, spec, result, utility: { error } } = ctx

  if(spec) {
    spec.step = 'inward'
  }
  
  if (!result.ok) {
    return undefined
  }

  try {
    return op.inward(ctx)
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
  inward
}
