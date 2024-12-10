
function headers(ctx) {
  const out = {}

  out['content-type'] =  'application/json'
  
  return out
}

module.exports = {
  headers
}
