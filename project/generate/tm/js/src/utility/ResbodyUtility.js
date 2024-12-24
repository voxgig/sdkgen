
async function resbody(response, fetchResponse) {
  if(fetchResponse && fetchResponse.json) {
    const json = await fetchResponse.json()
    response.body = json
  }
  
  return response
}

module.exports = {
  resbody
}
