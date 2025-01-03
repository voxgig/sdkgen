

function body(ctx) {
  const { op, result, utility: { error } } = ctx

  let body = undefined

  if('req' === op.kind) {
    try {
      body = ctx.op.outward(ctx)
    }
    catch (err) {
      if(result) {
        result.ok = false
        result.err = err
      }
      return error(ctx)
    }
  }

  return body
}

module.exports = {
  body
}
