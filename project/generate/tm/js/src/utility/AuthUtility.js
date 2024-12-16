
function auth(ctx, spec) {
  const { client } = ctx
  const { headers } = spec
  
  let options = client.options()

  headers['authorization'] = 'Bearer '+options.apikey
  
  return spec
}


module.exports = {
  auth
}
