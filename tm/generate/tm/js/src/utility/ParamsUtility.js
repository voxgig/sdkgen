
function params(ctx) {
  const { op } = ctx

  const { params, query } = op

  const out = {}
  for(let key of params) {
    let val = query[key]
    if(null!=val) {
      out[key] = val
    }
  }

  return out
}

module.exports = {
  params
}
