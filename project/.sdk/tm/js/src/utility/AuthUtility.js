
function auth(ctx) {
  const { client, spec } = ctx
  const { headers } = spec
  
  let options = client.options()

  if(null != options.apikey && '' !== options.apikey) {
    headers['authorization'] = 'Bearer '+options.apikey
  }
  else {
    delete headers['authorization']
  }
  
  return spec
}


module.exports = {
  auth
}
