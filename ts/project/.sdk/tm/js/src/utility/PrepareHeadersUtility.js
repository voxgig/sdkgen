
const { callArgs } = require('./ParamUtility')

function prepareHeaders(ctx) {
  const struct = ctx.utility.struct
  const clone = struct.clone
  const getprop = struct.getprop
  const stringify = struct.stringify

  const client = ctx.client

  const options = client.options()

  let out = clone(getprop(options, 'headers', {}))

  // A header argument replaces a default of the same name, whatever its case.
  for (const arg of callArgs(ctx, 'header')) {
    if (null != arg.val) {
      const wire = arg.wire.toLowerCase()
      for (const key of Object.keys(out)) {
        if (wire === key.toLowerCase()) delete out[key]
      }
      out[wire] = stringify(arg.val)
    }
  }

  return out
}

module.exports = {
  prepareHeaders
}
