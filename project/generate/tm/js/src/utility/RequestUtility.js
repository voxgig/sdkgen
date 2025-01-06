

async function request(ctx) {
  const { spec, utility, client } = ctx
  const { fullurl } = utility

  const options = client.options()
  
  let response = {}

  const url = spec.url = fullurl(ctx)

  try {
    spec.step = 'prepare'

    const fetchdef = {
      method: spec.method,
      headers: spec.headers,
    }

    if(null != spec.body) {
      fetchdef.body =
        'object' === typeof spec.body ? JSON.stringify(spec.body) : spec.body
    }

    spec.step = 'prerequest'
    response = options.fetch(url, fetchdef)
  }
  catch(err) {
    response.err = err
  }

  spec.step = 'postrequest'
  
  return response
}

module.exports = {
  request
}
