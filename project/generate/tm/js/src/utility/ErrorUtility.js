
/* Generate an error from the current context.
 *
 * Assumes nothing may be valid.
 */
function error(ctx) {

  ctx = ctx || {}
  const op = ctx.op || {}
  op.name = op.name || 'unknown operation'

  const result = ctx.result || {}
  const reserr = result.err || {}
  reserr.message = reserr.message || 'unknown error'

  const spec = ctx.spec || {}
  
  const err = new Error('NameSDK: '+op.name+': '+reserr.message)
  err.result = result
  err.spec = spec

  // TODO: model option to return instead
  throw err
}


module.exports = {
  error
}
