
async function resbody(response, fetchResponse) {
  const json = await fetchResponse.json()
  response.body = json
  return response
}

module.exports = {
  resbody
}
