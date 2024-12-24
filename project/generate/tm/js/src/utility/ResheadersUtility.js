
function resheaders(response, fetchResponse) {

  if(fetchResponse && fetchResponse.headers && fetchResponse.headers.forEach) {
    const headers = {}
    fetchResponse.headers.forEach((v,k)=>headers[k]=v)
    response.headers = headers
  }
  else {
    response.headers = {}
  }
  
  return response
}

module.exports = {
  resheaders
}
