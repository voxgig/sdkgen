
function error(ctx, err) {

  ctx = ctx || {}
  const op = ctx.op || {}
  op.name = op.name || 'unknown operation'

  const result = ctx.result = ctx.result || {}
  result.ok = false
  
  const reserr = result.err
  
  err = undefined === err ? reserr : err
  err = err || new Error('unknown error')
  
  const errmsg = err.message || 'unknown error'
  const msg = 'StatuspageSDK: '+op.name+': '+errmsg
  err.message = msg
  // result.err = {...err}
  
  const spec = ctx.spec || {}

  err.result = ctx.result
  err.spec = spec

  // TODO: model option to return instead
  throw err
}


module.exports = {
  error
}
