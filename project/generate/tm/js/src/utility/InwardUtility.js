
const { error } = require('./ErrorUtility')

function inward(ctx) {
  if (!ctx.result.ok) {
    return undefined
  }

  try {
    return ctx.op.inward(ctx)
  }
  catch (err) {
    // TDOD: need error codes and err msg text
    ctx.result.ok = false
    ctx.result.err = err
    return error(ctx)
  }
}


module.exports = {
  inward
}
