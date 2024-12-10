
function resheaders(response, fetchResponse) {
  out = {}
  fetchResponse.headers.forEach((v,k)=>out[k]=v)
  response.headers = out
  return response
}

module.exports = {
  resheaders
}
