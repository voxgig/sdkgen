

async function request(ctx) {
  const { spec, utility, client } = ctx
  const { fullurl, error } = utility
  
  let response = {}

  try {
    spec.step = 'prepare'

    const options = client.options()
    const url = spec.url = fullurl(ctx)

    const fetch = options.system.fetch
    
    const fetchdef = {
      method: spec.method,
      headers: spec.headers,
    }

    if(null != spec.body) {
      fetchdef.body =
        'object' === typeof spec.body ? JSON.stringify(spec.body) : spec.body
    }

    spec.step = 'prerequest'
    response = await fetch(url, fetchdef)

    if(null == response) {
      response = { err: new Error('response: undefined') }
    }
  }
  catch(err) {
    response = response || {}
    response.err = err
  }

  spec.step = 'postrequest'
  
  ctx.response = response

  return response
}

module.exports = {
  request
}
