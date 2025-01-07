

function stringify(val, maxlen) {
  let json = JSON.stringify(val)
  json = 'string' !== typeof json ? '' : json
  json = json.replace(/"/g,'')

  if(null != maxlen) {
    let js = json.substring(0, maxlen)
    json = maxlen < json.length ? (js.substring(0,maxlen-3)+'...') : json
  }

  return json
}



module.exports = {
  stringify
}
