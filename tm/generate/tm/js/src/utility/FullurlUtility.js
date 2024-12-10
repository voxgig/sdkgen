
const { joinurl }  = require('./JoinurlUtility')
const { escurl }  = require('./EscurlUtility')
const { escre }  = require('./EscreUtility')


function fullurl(ctx) {
  const { spec } = ctx

  let url = joinurl(spec.base, spec.prefix, spec.path, spec.suffix)

  for(let key in spec.params) {
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
