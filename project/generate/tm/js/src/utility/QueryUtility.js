
function query(ctx) {
  const { op } = ctx
  let { params, match } = op
  params = params || []
  match = match || {}
  
  const out = {}
  for(let key of Object.keys(match)) {
    let val = match[key]
    if(null!=val && !params.includes(key)) {
      out[key] = val
    }
  }

  return out
}

module.exports = {
  query
}
