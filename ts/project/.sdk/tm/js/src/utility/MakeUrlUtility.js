
function makeUrl(ctx) {
  const utility = ctx.utility
  const spec = ctx.spec
  const result = ctx.result

  const struct = utility.struct
  const escurl = struct.escurl
  const escre = struct.escre
  const join = struct.join
  const items = struct.items

  if (null == spec) {
    return ctx.error('url_no_spec', 'Expected context spec property to be defined.')
  }

  if (null == result) {
    return ctx.error('url_no_result', 'Expected context result property to be defined.')
  }

  let url = join([spec.base, spec.prefix, spec.path, spec.suffix], '/', true)

  // A route the definition ends with a slash keeps it: a server such as a
  // Django REST one redirects or refuses the route without it.
  const orig = ctx.point && ctx.point.orig
  if ('string' === typeof orig && orig.endsWith('/') && !spec.suffix && !url.endsWith('/')) {
    url += '/'
  }
  let resmatch = {}

  const params = spec.params

  for (let [key, val] of items(params)) {
    if (null != val) {
      url = url.replace(RegExp('{' + escre(key) + '}'), escurl(val))
      resmatch[key] = val
    }
  }

  let qsep = '?'
  for (let [key, val] of items(spec.query)) {
    if (null != val) {
      url += qsep + escurl(key) + '=' + escurl(val)
      qsep = '&'
      resmatch[key] = val
    }
  }

  result.resmatch = resmatch

  // The credential prepareAuth placed in the query is no part of the match;
  // a path parameter of the same name still is.
  for (const key of spec.authquery || []) {
    delete resmatch[key]
    if (null != params && null != params[key]) {
      resmatch[key] = params[key]
    }
  }

  return url
}

module.exports = {
  makeUrl
}
