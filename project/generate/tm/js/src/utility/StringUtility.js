

function stringify(val, maxlen) {
  let js = JSON.stringify(val).replace(/"/g,'')
  let s = js.substring(0, maxlen)

  if(maxlen < js.length) {
    s = s.substring(0,maxlen-3)+'...'
  }
  
  return s
}



module.exports = {
  stringify
}
