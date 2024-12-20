
const { fullurl }  = require('./FullurlUtility')

// Make HTTP request.
async function fetch(ctx) {
  const {op, spec} = ctx
  let response = {}
  
  try {
    const url = spec.url = fullurl(ctx)
    
    const fetchReq = {
      method: spec.method,
      headers: spec.headers,
    }

    if(null != spec.body) {
      fetchReq.body =
        'object' === typeof spec.body ? JSON.stringify(spec.body) : spec.body
    }

    response = global.fetch(url, fetchReq)
  }
  catch(err) {
    response.err = err
  }
  
  return response
}

module.exports = {
  fetch
}
