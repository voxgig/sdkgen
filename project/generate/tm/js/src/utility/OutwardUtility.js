


function outward(ctx) {
  const { spec, utility } = ctx
  const { error } = utility
  
  if (!ctx.result.ok) {
    return undefined
  }

  try {
    return ctx.op.outward(ctx)
  }
  catch (err) {
    // TDOD: need error codes and err msg text
    ctx.result.ok = false
    ctx.result.err = err
    return error(ctx)
  }

  spec.step = 'outward'
}


module.exports = {
  outward
}
