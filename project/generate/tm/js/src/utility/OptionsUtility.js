
const { empty }  = require('./EmptyUtility')

function options(ctx) {
  let config = ctx.config || {}
  let cfgopts = config.options || {}
  
  let options = { ...(ctx.options||{}) }

  options.base = empty(options.base) ?
    empty(cfgopts.base) ? 'http://localhost:8000' :
    cfgopts.base : options.base

  options.prefix = empty(options.prefix) ? '' : options.prefix
  options.suffix = empty(options.suffix) ? '' : options.suffix

  options.entity = options.entity || {}
  let entityNames = Object.keys(cfgopts.entity)
  for(let name of entityNames) {
    let entcfg = cfgopts.entity[name]
    let entopts = options.entity[name] || (options.entity[name] = {})

    entopts.alias = entopts.alias || (entopts.alias = {})
    for(let cfgaliaskey in entcfg.alias) {
      entopts.alias = entopts.alias[cfgaliaskey] || entcfg.alias[cfgaliaskey]
    }
  }
  
  return options
}

module.exports = {
  options
}
