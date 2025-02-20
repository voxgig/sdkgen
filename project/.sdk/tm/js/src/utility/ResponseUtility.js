
async function response(ctx) {
  let { response, spec, utility } = ctx
  
  const { resheaders, resbasic, resbody, resform } = utility

  spec.step = 'response'
    
  let result = {
    ok: false,
    status: -1,
    statusText: '',
    headers: {},
    body: undefined,
    err: response.err,
  }

  ctx.result = result
  
  try {
    resbasic(ctx)
    resheaders(ctx)
    await resbody(ctx)
    resform(ctx)
    
    if(null == result.err) {
      result.ok = true
    }
  }
  catch(err) {
    result.err = err
  }
}

module.exports = {
  response
}
