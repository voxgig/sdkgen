
function resbasic(response, fetchResponse) {
  response.ok = fetchResponse.ok
  response.status = fetchResponse.status
  response.statusText = fetchResponse.statusText || ''
  return response
}

module.exports = {
  resbasic
}
