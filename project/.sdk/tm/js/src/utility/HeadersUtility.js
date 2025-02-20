
function headers(ctx) {
  const out = {}

  // TODO: should come from options via config
  out['content-type'] = 'application/json'
  
  return out
}

module.exports = {
  headers
}
