
function params(ctx) {
  const { op } = ctx

  const { params, match } = op

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
