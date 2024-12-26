

// Make HTTP request.
async function fetch(ctx) {
  const { op, spec, utility } = ctx
  const { fullurl } = utility

  let response = {}

  const url = spec.url = fullurl(ctx)

  try {
    spec.step = 'prepare'
    const fetchReq = {
      method: spec.method,
      headers: spec.headers,
    }

    if(null != spec.body) {
      fetchReq.body =
        'object' === typeof spec.body ? JSON.stringify(spec.body) : spec.body
    }

    spec.step = 'prefetch'
    response = global.fetch(url, fetchReq)
  }
  catch(err) {
    response.err = err
  }

  spec.step = 'postfetch'
  
  return response
}

module.exports = {
  fetch
}
