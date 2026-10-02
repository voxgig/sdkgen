
const { Result } = require('../Result')
const { isRawValue, isStream } = require('./MediaUtility')

function makeFetchDef(ctx) {
  const spec = ctx.spec
  const utility = ctx.utility
  const makeUrl = utility.makeUrl
  const struct = utility.struct
  const jsonify = struct.jsonify

  if (null == spec) {
    return ctx.error('fetchdef_no_spec', 'Expected context spec property to be defined.')
  }

  if (null == ctx.result) {
    ctx.result = new Result({})
  }

  spec.step = 'prepare'

  const url = makeUrl(ctx)
  if (url instanceof Error) {
    return url
  }

  spec.url = url

  const fetchdef = {
    url,
    method: spec.method,
    headers: spec.headers,
  }

  if (null != spec.body) {
    const body = spec.body
    fetchdef.body = 'object' !== typeof body || isRawValue(body) ? body : jsonify(body)

    // Node's fetch refuses a stream body without it.
    if (isStream(body)) {
      fetchdef.duplex = 'half'
    }
  }

  return fetchdef
}

module.exports = {
  makeFetchDef
}
