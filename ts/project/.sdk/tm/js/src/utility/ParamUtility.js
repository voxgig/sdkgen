
function param(ctx, paramdef) {
  const point = ctx.point
  const spec = ctx.spec
  const match = ctx.match
  const reqmatch = ctx.reqmatch
  const data = ctx.data
  const reqdata = ctx.reqdata

  const utility = ctx.utility
  const struct = utility.struct

  const getprop = struct.getprop
  const setprop = struct.setprop

  const typify = struct.typify
  const T_string = struct.T_string

  const pt = typify(paramdef)

  const key = 0 < (T_string & pt) ? paramdef : getprop(paramdef, 'name')

  let akey = getprop(point.alias, key)

  let val = getprop(reqmatch, key)

  if (null == val) {
    val = getprop(match, key)
  }

  if (null == val && null != akey) {

    if (null != spec) {
      setprop(spec.alias, akey, key)
    }

    val = getprop(reqmatch, akey)
  }

  if (null == val) {
    val = getprop(reqdata, key)
  }

  if (null == val) {
    val = getprop(data, key)
  }

  if (null == val && null != akey) {
    val = getprop(reqdata, akey)

    if (null == val) {
      val = getprop(data, akey)
    }
  }

  return val
}


// The arguments a point declares in one location, query or header, each with
// the name it travels under and the value this call passes in its match or
// else its data. Unlike a path parameter, the entity's stored match and data
// never supply one.
function callArgs(ctx, kind) {
  const getprop = ctx.utility.struct.getprop
  const declared = (ctx.point && ctx.point.args && ctx.point.args[kind]) || []
  const out = []

  for (const arg of declared) {
    if (null == arg || 'string' !== typeof arg.name || '' === arg.name) continue
    let val = getprop(ctx.reqmatch, arg.name)
    if (null == val) val = getprop(ctx.reqdata, arg.name)
    out.push({ name: arg.name, wire: String(arg.orig || arg.name), val })
  }

  return out
}

module.exports = {
  param,
  callArgs,
}
