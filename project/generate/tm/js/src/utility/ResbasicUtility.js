
function resbasic(response, fetchResponse) {
  if(null != fetchResponse) {
    response.status = fetchResponse.status
    response.statusText = fetchResponse.statusText || 'no-status'
  
    // TODO: use spec!
    if(400 <= response.status) {
      const msg = 'fetch: '+response.status+': '+response.statusText
      if(response.err) {
        const prevmsg = null == response.err.message ? '' : response.err.message
        response.err.message = prevmsg+': '+msg
      }
      else {
        response.err = new Error(msg)
      }
    }
  }
  
  return response
}

module.exports = {
  resbasic
}
