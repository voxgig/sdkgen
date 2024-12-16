
const { empty }  = require('./EmptyUtility')

function options(ctx) {
  let config = ctx.config || {}
  let copts = config.options || {}
  
  let options = { ...(ctx.options||{}) }

  options.base = empty(options.base) ?
    empty(copts.base) ? 'http://localhost:8000' :
    copts.base : options.base

  options.prefix = empty(options.prefix) ? '' : options.prefix
  options.suffix = empty(options.suffix) ? '' : options.suffix
  
  return options
}

module.exports = {
  options
}
