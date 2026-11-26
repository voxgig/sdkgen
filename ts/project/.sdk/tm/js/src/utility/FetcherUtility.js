
const { isStream } = require('./MediaUtility')


// Outside a browser a request without an agent carries the project's
// (main.kit.http.useragent): browser-shaped unless the model says otherwise,
// as several CDNs refuse a library's own.
const DEFAULT_USER_AGENT = 'PROJECTUSERAGENT'


function defaultUserAgent(fetchdef) {
  if (null == globalThis.process?.versions?.node) {
    return
  }
  const headers = fetchdef.headers = fetchdef.headers || {}
  for (const name of Object.keys(headers)) {
    if ('user-agent' === name.toLowerCase()) {
      return
    }
  }
  headers['user-agent'] = DEFAULT_USER_AGENT
}


const GETONLY_ENV = 'VOXGIG_GETONLY_GUARD'


// A GET-only live run refuses any other method before it is sent. The error
// names the path alone: the query can carry a credential.
function getOnlyRefusal(ctx, fullurl, fetchdef) {
  const method = String(fetchdef.method || 'GET').toUpperCase()
  if ('TRUE' !== globalThis.process?.env?.[GETONLY_ENV] || 'GET' === method) {
    return
  }
  const scheme = fullurl.indexOf('://')
  const rest = scheme < 0 ? fullurl : fullurl.slice(scheme + 3).replace(/^[^/?#]*/, '')
  const path = rest.split(/[?#]/)[0] || '/'
  return ctx.error('fetch_getonly_block', '[GET-ONLY GUARD] blocked ' + method + ' ' + path)
}


const REDIRECT_STATUS = [301, 302, 303, 307, 308]
const REDIRECT_MAX = 5
const CREDENTIAL_HEADERS = ['authorization', 'cookie', 'proxy-authorization']


function originOf(url) {
  try {
    return new URL(url).origin
  }
  catch (_e) {
    return ''
  }
}


// What another origin is not sent: a secret, by its name or by its value.
function isCredential(ctx, name, value) {
  return CREDENTIAL_HEADERS.includes(name.toLowerCase()) ||
    true === ctx.utility.cleanSecret?.(ctx, name, value)
}


// The platform sends a custom header, and a 307's body, wherever a redirect
// points. Followed here instead: each hop passes the GET-only guard; past
// REDIRECT_MAX hops, or where a body would change origin, the 3xx answers.
async function followRedirects(ctx, fetch, fullurl, fetchdef) {
  let url = fullurl
  let def = { ...fetchdef, redirect: 'manual' }

  for (let hops = 0; ; hops++) {
    const res = await fetch(url, def)
    const location = res?.headers?.get?.('location')
    if (null == location || !REDIRECT_STATUS.includes(res.status) || REDIRECT_MAX <= hops) {
      return res
    }

    let next
    try {
      next = new URL(location, url).href
    }
    catch (_e) {
      return res
    }

    // As the platform does: a 303, or a 301 or 302 to a POST, becomes a GET.
    const method = String(def.method || 'GET').toUpperCase()
    const toget = 303 === res.status ? 'HEAD' !== method && 'GET' !== method :
      'POST' === method && 307 !== res.status && 308 !== res.status
    const cross = originOf(next) !== originOf(url)
    const body = toget ? undefined : def.body

    if (null != body && (cross || isStream(body))) {
      return res
    }

    const headers = {}
    for (const name of Object.keys(def.headers || {})) {
      const dropped = (toget && /^content-/i.test(name)) ||
        (cross && isCredential(ctx, name, def.headers[name]))
      if (!dropped) {
        headers[name] = def.headers[name]
      }
    }

    const nextdef = { ...def, method: toget ? 'GET' : method, headers }
    if (null == body) {
      delete nextdef.body
      delete nextdef.duplex
    }

    const refused = getOnlyRefusal(ctx, next, nextdef)
    if (refused) {
      return refused
    }

    try {
      await res.body?.cancel?.()
    }
    catch (_e) { }

    url = next
    def = nextdef
  }
}


// Make HTTP call using library. Replace this utility for mocking etc.
async function fetcher(ctx, fullurl, fetchdef) {

  if ('live' !== ctx.client._mode) {
    return ctx.error('fetch_mode_block', 'Request blocked by mode: "' + ctx.client._mode +
      '" (URL was: "' + fullurl + '")')
  }

  const options = ctx.client.options()

  const getpath = ctx.utility.struct.getpath

  if (true === getpath(options, 'feature.test.active')) {
    return ctx.error('fetch_test_block', 'Request blocked as test feature is active' +
      ' (URL was: "' + fullurl + '")')
  }

  const fetch = options.system.fetch

  // The platform's fetch is the SDK's own transport; a supplied one is the
  // caller's, and a mock sends nothing.
  const refused = fetch === globalThis.fetch ? getOnlyRefusal(ctx, fullurl, fetchdef) : undefined
  if (refused) {
    return refused
  }

  defaultUserAgent(fetchdef)

  // Only where a manual redirect can be read: a browser hides its Location.
  const readable = null != globalThis.process?.versions?.node
  const follows = fetch === globalThis.fetch &&
    (null == fetchdef.redirect || 'follow' === fetchdef.redirect)

  // Elsewhere a request with a body refuses a redirect: nothing could be dropped.
  const refuses = follows && !readable && null != fetchdef.body

  const response = follows && readable ? await followRedirects(ctx, fetch, fullurl, fetchdef) :
    await fetch(fullurl, refuses ? { ...fetchdef, redirect: 'error' } : fetchdef)

  return response
}

module.exports = {
  fetcher,
  DEFAULT_USER_AGENT,
}
