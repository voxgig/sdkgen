
function prepareHeaders(ctx) {
  const struct = ctx.utility.struct
  const clone = struct.clone
  const getprop = struct.getprop
  const stringify = struct.stringify

  const client = ctx.client

  const options = client.options()

  let out = clone(getprop(options, 'headers', {}))

  // A header parameter travels as a header, under the name the definition
  // gives it, and only from this call's own arguments. It replaces a default
  // of the same name, whatever its case.
  const hargs = (ctx.point && ctx.point.args && ctx.point.args.header) || []
  for (const h of hargs) {
    if (null == h || 'string' !== typeof h.name || '' === h.name) continue
    let val = getprop(ctx.reqmatch, h.name)
    if (null == val) val = getprop(ctx.reqdata, h.name)
    if (null != val) {
      const wire = String(h.orig || h.name).toLowerCase()
      for (const key of Object.keys(out)) {
        if (wire === key.toLowerCase()) delete out[key]
      }
      out[wire] = stringify(val)
    }
  }

  return out
}

module.exports = {
  prepareHeaders
}
