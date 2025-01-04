
function resheaders(ctx, result) {
  const { response } = ctx

  if(response && response.headers && response.headers.forEach) {
    const headers = {}
    response.headers.forEach((v,k)=>headers[k]=v)
    result.headers = headers
  }
  else {
    result.headers = {}
  }
  
  return result
}

module.exports = {
  resheaders
}
