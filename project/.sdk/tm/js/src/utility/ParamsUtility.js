
function params(ctx) {
  const { op } = ctx
  let { params, match } = op
  params = params || []
  match = match || {}
  
  const out = {}
  for(let key of params) {
    let val = match[key]
    if(null!=val) {
      out[key] = val
    }
  }

  return out
}

module.exports = {
  params
}
