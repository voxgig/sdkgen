

function stringify(val, maxlen) {
  let js = JSON.stringify(val)
  js = 'string' !== typeof js ? '' : js
  js = js.replace(/"/g,'')
  let s = js.substring(0, maxlen)

  if(null != maxlen && maxlen < js.length) {
    s = s.substring(0,maxlen-3)+'...'
  }
  
  return s
}



module.exports = {
  stringify
}
