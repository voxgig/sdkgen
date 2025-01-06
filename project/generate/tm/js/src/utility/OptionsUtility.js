
function options(ctx) {
  const { options, utility } = ctx

  let opts = { ...(options||{}) }
  
  const customUtils = opts.utility || {}
  for(let key of Object.keys(customUtils)) {
    utility[key] = customUtils[key]
  }
  
  const { empty } = utility

  let config = ctx.config || {}
  let cfgopts = config.options || {}
  
  setopt('base', 'http://localhost:8000', opts, cfgopts, empty)
  setopt('prefix', '', opts, cfgopts, empty)
  setopt('suffix', '', opts, cfgopts, empty)

  setopt('fetch', global.fetch, opts, cfgopts, empty)
  
  opts.entity = opts.entity || {}
  cfgopts.entity = cfgopts.entity || {}
  let entityNames = Object.keys(cfgopts.entity)
  for(let name of entityNames) {
    let entcfg = cfgopts.entity[name]
    let entopts = opts.entity[name] || (opts.entity[name] = {})

    // TODO: does this work?
    entopts.alias = entopts.alias || (entopts.alias = {})
    for(let cfgaliaskey in entcfg.alias) {
      entopts.alias = entopts.alias[cfgaliaskey] || entcfg.alias[cfgaliaskey]
    }
  }
  
  return opts
}


function setopt(name, deflt, opts, cfgopts, empty) {
  opts[name] = !empty(opts[name]) ? opts[name] :
    !empty(cfgopts[name]) ? cfgopts[name] :
    deflt
}


module.exports = {
  options
}
