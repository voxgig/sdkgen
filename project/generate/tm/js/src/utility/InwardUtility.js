
/* Convert data from request result into a structure suitable for use as entity data.
 *
 * The operation (op) property `inward` is a function used to perform the data extraction.
 */
function inward(ctx) {
  const { op, spec, utility, result } = ctx
  const { error } = utility

  spec.step = 'inward'

  if (!result.ok) {
    return undefined
  }

  try {
    return op.inward(ctx)
  }
  catch (err) {
    // TDOD: need error codes and err msg text
    result.ok = false
    result.err = err
    return utility.error(ctx)
  }
}


module.exports = {
  inward
}
