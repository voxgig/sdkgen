
function resbasic(response, fetchResponse) {
  response.status = fetchResponse.status
  response.statusText = fetchResponse.statusText || 'no-status'

  // TODO: use spec!
  if(400 <= response.status) {
    response.ok = false
    response.err = new Error(response.status+': '+response.statusText)
  }
  
  return response
}

module.exports = {
  resbasic
}
