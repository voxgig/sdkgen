


function outward(ctx) {
  const { op, spec, utility, result } = ctx
  const { error } = utility

  spec.step = 'outward'

  if (!result.ok) {
    return undefined
  }

  try {
    return op.outward(ctx)
  }
  catch (err) {
    // TDOD: need error codes and err msg text
    result.ok = false
    result.err = err
    return utility.error(ctx)
  }
}


module.exports = {
  outward
}
