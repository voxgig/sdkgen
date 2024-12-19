
const { joinurl }  = require('./JoinurlUtility')
const { escurl }  = require('./EscurlUtility')
const { escre }  = require('./EscreUtility')


function fullurl(ctx) {
  const { op, spec } = ctx
  const { query, data } = op
  
  let url = joinurl(spec.base, spec.prefix, spec.path, spec.suffix)

  const params = spec.params
  for(let key of op.params) {
    if(null == params[key]) {
      params[key] = 'res' === op.kind ? query[key] : data[key]
    }
  }
  
  for(let key in params) {
    const val = spec.params[key]
    if(null != val) { 
      url = url.replace(RegExp('{'+escre(key)+'}'), escurl(val))
    }
  }

  let qsep = '?'
  for(let key in spec.query) {
    const val = spec.query[key]
    if(null != val) { 
      url += qsep + escurl(key) + '=' + escurl(val)
      qsep = '&'
    }
  }
  
  return url
}

module.exports = {
  fullurl
}
