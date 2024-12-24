
const { resheaders }  = require('./ResheadersUtility')
const { resbasic }  = require('./ResbasicUtility')
const { resbody }  = require('./ResbodyUtility')

async function response(ctx) {
  let { response, spec } = ctx
  
  let result = {
    ok: false,
    status: -1,
    statusText: '',
    headers: {},
    body: undefined,
    err: response.err,
  }

  try {
    result = resbasic(result, response)
    result = resheaders(result, response)
    result = await resbody(result, response)
    
    if(null == result.err) {
      result.ok = true
    }
  }
  catch(err) {
    result.err = err
  }

  spec.step = 'response'
  
  return result
}

module.exports = {
  response
}
