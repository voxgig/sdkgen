

function fullurl(ctx) {
  const { op, spec, utility } = ctx

  const { joinurl, escurl, escre, findparam } = utility


  const { query, data } = op
  
  let url = joinurl(spec.base, spec.prefix, spec.path, spec.suffix)

  const params = spec.params
  for(let key of op.params) {
    if(null == params[key]) {
      params[key] = findparam(ctx, key)
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
    if(null == spec.alias[key]) {
      const val = spec.query[key]
      if(null != val) { 
        url += qsep + escurl(key) + '=' + escurl(val)
        qsep = '&'
      }
    }
  }

  // console.log('URL', url, spec)
  
  return url
}

module.exports = {
  fullurl
}
