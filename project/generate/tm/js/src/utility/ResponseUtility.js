
async function response(ctx) {
  let { response, spec, utility } = ctx
  
  const { resheaders, resbasic, resbody } = utility

  spec.step = 'response'
    
  let result = {
    ok: false,
    status: -1,
    statusText: '',
    headers: {},
    body: undefined,
    err: response.err,
  }

  try {
    result = resbasic(ctx, result)
    result = resheaders(ctx, result)
    result = await resbody(ctx, result)
    
    if(null == result.err) {
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
