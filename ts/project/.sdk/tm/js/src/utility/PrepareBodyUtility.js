
const { isRawRequest, rawBody } = require('./MediaUtility')

function prepareBody(ctx) {
  const op = ctx.op

  const utility = ctx.utility
  const error = utility.makeError
  const transformRequest = utility.transformRequest

  let body = undefined

  if ('data' === op.input) {
    if (isRawRequest(ctx.point)) {
      return rawBody(ctx.reqdata)
    }

    try {
      body = transformRequest(ctx)
    }
    catch (err) {
      return error(ctx, err)
    }
  }

  else if (ctx.point && Array.isArray(ctx.point.fields) && 0 < ctx.point.fields.length) {
    body = matchBody(ctx)
  }

  return body
}


// A list, load or remove routed to a method with a body sends the match
// fields that body declares, never a path parameter, and never a header,
// cookie or query argument the body does not also declare as a field.
function matchBody(ctx) {
  const point = ctx.point
  const args = point.args || {}
  const getprop = ctx.utility.struct.getprop

  const routed = (point.params || [])
    .concat((args.params || []).map((arg) => arg && arg.name))
    .concat(['header', 'cookie', 'query'].flatMap((kind) => (args[kind] || [])
      .filter((arg) => !arg || true !== arg.field).map((arg) => arg && arg.name)))

  const body = {}
  for (const name of point.fields) {
    const val = getprop(ctx.reqmatch, name)
    if (null != val && '$action' !== name && !routed.includes(name)) {
      body[name] = val
    }
  }

  return body
}

module.exports = {
  prepareBody
}
