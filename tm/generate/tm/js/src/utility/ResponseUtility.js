
const { resheaders }  = require('./ResheadersUtility')
const { resbasic }  = require('./ResbasicUtility')
const { resbody }  = require('./ResbodyUtility')

async function response(ctx) {
  let { response } = ctx
  
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
    
    if(null == result.err) {
      result = resheaders(result, response)
      result = await resbody(result, response)
      result.ok = true
    }
  }
  catch(err) {
    result.err = err
  }
  
  return result
}

module.exports = {
  response
}
