
async function resbody(ctx, result) {
  const { response } = ctx

  if(response && response.json) {
    const json = await response.json()
    result.body = json
  }
  
  return result
}

module.exports = {
  resbody
}
