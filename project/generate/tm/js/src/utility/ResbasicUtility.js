
function resbasic(ctx, result) {
  const { response } = ctx

  if(null != response) {
    result.status = response.status || -1
    result.statusText = response.statusText || 'no-status'
  
    // TODO: use spec!
    if(400 <= result.status) {
      const msg = 'request: '+result.status+': '+result.statusText
      if(result.err) {
        const prevmsg = null == result.err.message ? '' : result.err.message
        result.err.message = prevmsg+': '+msg
      }
      else {
        result.err = new Error(msg)
      }
    }
  }
  
  return result
}

module.exports = {
  resbasic
}
