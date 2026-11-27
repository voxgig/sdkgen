const { BinarySource, liftSources } = require('./BinaryUtility')
const { RAW_BODY, isRawRequest } = require('./MediaUtility')

function prepareBody(ctx) {
  const op = ctx.op

  const utility = ctx.utility
  const error = utility.makeError
  const transformRequest = utility.transformRequest

  let body = undefined

  if ('data' === op.input) {
    const refused = liftSources(ctx)
    if (refused) {
      return error(ctx, refused)
    }

    if (isRawRequest(ctx.point)) {
      const raw = ctx.sources?.[RAW_BODY]
      return raw instanceof BinarySource ? raw.data : raw
    }

    try {
      body = transformRequest(ctx)
    }
    catch (err) {
      return error(ctx, err)
    }

    const kind = ctx.point?.body?.kind
    if ('form' === kind || 'multipart' === kind) {
      return encodeBody(ctx, kind, body)
    }
  }

  else if (ctx.point && Array.isArray(ctx.point.fields) && 0 < ctx.point.fields.length) {
    body = matchBody(ctx)
  }

  return body
}


// The encoded body, with its content type replacing any the headers carry:
// a multipart boundary is the encoder's alone to choose.
function encodeBody(ctx, kind, data) {
  const encode = ctx.utility.codec?.[kind]
  if ('function' !== typeof encode) {
    return ctx.utility.makeError(ctx, ctx.error('body_codec_missing',
      'This SDK was generated without a ' + kind + ' encoder.'))
  }

  const encoded = encode(ctx, data, ctx.sources || {})
  if (encoded instanceof Error) {
    return ctx.utility.makeError(ctx, encoded)
  }

  const headers = ctx.spec?.headers
  if (null != headers) {
    for (const key of Object.keys(headers)) {
      if ('content-type' === key.toLowerCase()) {
        delete headers[key]
      }
    }
    headers['content-type'] = encoded.type
  }

  return encoded.body
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
