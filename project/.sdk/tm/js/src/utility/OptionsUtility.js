
function options(ctx) {
  const { options, utility } = ctx
  
  let opts = { ...(options||{}) }
  
  const customUtils = opts.utility || {}
  for(let key of Object.keys(customUtils)) {
    utility[key] = customUtils[key]
  }
  
  const { isempty, merge, validate } = utility.struct

  let config = ctx.config || {}
  let cfgopts = config.options || {}
  
  // Standard SDK option values.
  const optspec = {
    apikey: '',
    base: 'http://localhost:8000',
    prefix: '',
    suffix: '',
    entity: {
      '`$CHILD`': {
        '`$OPEN`': true, 
        active: false,
        alias: {}
      }
    },
    feature: {
      '`$CHILD`': {
        '`$OPEN`': true,
        active: false, 
      }
    },
    utility: {},
    system: {},
  }

  // JavaScript specific option values.
  optspec.system.fetch = optspec.system.fetch || global.fetch

  opts = merge([{},cfgopts,opts])

  opts = validate(opts, optspec)

  return opts
}



module.exports = {
  options
}
