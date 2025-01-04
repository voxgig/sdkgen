
function options(ctx) {
  // TODO: handle custom utilities from options here, first
  
  const { utility } = ctx
  const { empty } = utility

  let config = ctx.config || {}
  let cfgopts = config.options || {}
  
  let options = { ...(ctx.options||{}) }

  // options.base = empty(options.base) ?
  //   empty(cfgopts.base) ? 'http://localhost:8000' :
  //   cfgopts.base : options.base

  // options.prefix = empty(options.prefix) ? '' : options.prefix
  // options.suffix = empty(options.suffix) ? '' : options.suffix

  setopt('base', 'http://localhost:8000', options, cfgopts, empty)
  setopt('prefix', '', options, cfgopts, empty)
  setopt('suffix', '', options, cfgopts, empty)
  
  options.entity = options.entity || {}
  cfgopts.entity = cfgopts.entity || {}
  let entityNames = Object.keys(cfgopts.entity)
  for(let name of entityNames) {
    let entcfg = cfgopts.entity[name]
    let entopts = options.entity[name] || (options.entity[name] = {})

    // TODO: does this work?
    entopts.alias = entopts.alias || (entopts.alias = {})
    for(let cfgaliaskey in entcfg.alias) {
      entopts.alias = entopts.alias[cfgaliaskey] || entcfg.alias[cfgaliaskey]
    }
  }
  
  return options
}


function setopt(name, deflt, options, cfgopts, empty) {
  options[name] = !empty(options[name]) ? options[name] :
    !empty(cfgopts[name]) ? cfgopts[name] :
    deflt
}


module.exports = {
  options
}
