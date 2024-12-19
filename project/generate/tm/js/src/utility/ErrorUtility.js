
function error(ctx) {

  const err = new Error('Error: '+ctx.op.name+': '+(ctx.result.err?.message||'unknown'))
  err.result = ctx.result
  err.spec = ctx.spec

  // TODO: model option to return instead
  throw err
}


module.exports = {
  error
}
