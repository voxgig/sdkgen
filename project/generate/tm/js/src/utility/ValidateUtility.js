
// TODO: perhaps whence should be ctx and stringify got from there?
const { stringify }  = require('./StringUtility')


function string(val, init, whence) {
  if(null == val || '' === val) {
    if(init) {
      val = ''
    }
    else {
      throw new Error('$$const.name$$: '+(null==whence?'':whence+': ')+
                      'invalid string: '+(null == val || ''===val?'empty':stringify(val,111)))
    }
  }
  return val
}


function array(val, init, whence) {
  if(null == val || !Array.isArray(val)) {
    if(init && null == val) {
      val = []
    }
    else {
      throw new Error('$$const.name$$: '+(null==whence?'':whence+': ')+
                      'invalid array: '+(null==val?'undefined':
                                         ((typeof val)+': '+stringify(val,111))))
    }
  }
  return val
}


function object(val, init, whence) {
  if(null == val || 'object' !== typeof val) {
    if(init && null == val) {
      val = {}
    }
    else {
      throw new Error('$$const.name$$: '+(null==whence?'':whence+': ')+
                      'invalid object: '+(null==val?'undefined':
                                          ((typeof val)+': '+stringify(val,111))))
    }
  }
  return val
}


function func(val, init, whence) {
  if(null == val || 'function' !== typeof val) {
    if(init && null == val) {
      val = (arg)=>arg
    }
    else {
      throw new Error('$$const.name$$: '+(null==whence?'':whence+': ')+
                      'invalid function: '+(null==val?'undefined':
                                            ((typeof val)+': '+stringify(val,111))))
    }
  }
  return val
}


module.exports = {
  string,
  array,
  object,
  func,
}
