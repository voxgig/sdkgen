

function findparam(ctx, key) {
  const { op, spec, entity } = ctx
  
  const { match, data, alias } = op
  const params = spec.params

  let source = 'res' === op.kind ? match : data
  let val = source[key]

  if(null == val) {
    let akey = alias[key]
    val = source[akey]
    spec.alias[akey] = key
  }

  return val
}

module.exports = {
  findparam
}
