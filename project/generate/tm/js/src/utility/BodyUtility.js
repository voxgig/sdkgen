

function body(ctx) {
  const { op, utility } = ctx
  const { error } = utility


  let body = undefined

  if('req' === op.kind) {
    try {
      body = ctx.op.outward(ctx)
    }
    catch (err) {
      // TDOD: need error codes and err msg text
      ctx.result.ok = false
      ctx.result.err = err
      return error(ctx)
    }
  }

  return body
}

module.exports = {
  body
}
