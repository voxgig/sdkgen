
function query(ctx) {
  const { op } = ctx
  const { params, query } = op

  const out = {}
  for(let key of Object.keys(query)) {
    let val = query[key]
    if(null!=val && !params.includes(key)) {
      out[key] = val
    }
  }

  return out
}

module.exports = {
  query
}
