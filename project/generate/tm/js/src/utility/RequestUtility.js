

async function request(ctx) {
  const { op, spec, utility, client } = ctx
  const { fullurl } = utility

  const options = client.options()
  
  let response = {}

  const url = spec.url = fullurl(ctx)

  try {
    spec.step = 'prepare'

    const reqdef = {
      method: spec.method,
      headers: spec.headers,
    }

    if(null != spec.body) {
      reqdef.body =
        'object' === typeof spec.body ? JSON.stringify(spec.body) : spec.body
    }

    spec.step = 'prerequest'
    response = options.fetch(url, reqdef)
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
