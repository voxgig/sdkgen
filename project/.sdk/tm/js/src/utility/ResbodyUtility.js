
async function resbody(ctx) {
  const { response, result } = ctx

  if(response && response.json) {
    const json = await response.json()
    result.body = json
  }

  return result
}

module.exports = {
  resbody
}
