

function string(val, whence) {
  if(null == val || '' === val) {
    throw new Error('$$const.name$$: '+whence+
                    ': invalid string: '+(''===val?'empty':'undefined')) 
  }
  return val
}


module.exports = {
  string
}
