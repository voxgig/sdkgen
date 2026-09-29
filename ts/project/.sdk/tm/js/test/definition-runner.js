// Checks one operation against the API definition rather than the model the
// SDK was generated from. A mock transport answers with the definition's own
// response example, so nothing here depends on how the model reads it.

const assert = require('node:assert/strict')




const KEY = 'definition-test-key'
const BASE = 'http://definition.test'


async function runDefinitionPoint(SDK, point) {
  const sent = []
  const body = null == point.sample ? null : JSON.stringify(point.sample)

  const client = new SDK({
    apikey: KEY,
    base: BASE,
    feature: { test: { active: false } },
    system: {
      fetch: async (url, init) => {
        sent.push({ url: new URL(String(url)), init: init || {} })
        return new Response(204 === point.status ? null : body, {
          status: point.status,
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  })

  const input = { ...point.select }
  for (const arg of point.args) input[arg.name] = arg.value
  for (const h of point.headers || []) input[h.name] = h.value
  if (null != point.action) input.$action = point.action

  let result
  let error
  try {
    result = await client[point.accessor]()[point.op](input)
  }
  catch (err) {
    error = err
  }

  assert.equal(sent.length, 1, 'expected one request, sent ' + sent.length +
    (error ? ': ' + error.message : ''))
  const { url, init } = sent[0]

  assert.equal(String(init.method || 'GET').toUpperCase(), point.method, 'method')

  const route = point.path.replace(/\{([^}]+)\}/g, (_, name) => {
    const arg = point.args.find((a) => a.wire === name)
    return null == arg ? '{' + name + '}' : encodeURIComponent(String(arg.value))
  })
  assert.equal(url.pathname, route, 'route')

  // Only what the definition declares, so never a path parameter again.
  const credentialQuery = (point.auth || []).flat()
    .filter((c) => 'query' === c.in).map((c) => c.name)
  for (const key of url.searchParams.keys()) {
    assert(point.query.includes(key) || credentialQuery.includes(key),
      'query parameter not in the definition: ' + key)
  }

  // From the apikey alone, placed as the definition's security scheme says.
  if (null != point.auth && 0 < point.auth.length) {
    const headers = new Headers(init.headers)
    assert(point.auth.some((set) => set.every((c) => placed(c, headers, url))),
      'credential not sent as the definition declares it: ' + JSON.stringify(point.auth))
  }

  // A header parameter goes out as a header. The credential check above owns
  // any header the security scheme names, and the SDK sets the content type
  // from the body it sends.
  const credentialHeaders = (point.auth || []).flat()
    .filter((c) => 'header' === c.in).map((c) => c.name.toLowerCase())
  for (const h of point.headers || []) {
    const wire = h.wire.toLowerCase()
    if (credentialHeaders.includes(wire) || 'content-type' === wire) continue
    assert.equal(new Headers(init.headers).get(wire), String(h.value),
      'header parameter not sent as a header: ' + h.wire)
  }

  if (null != error) {
    throw error
  }

  if (null == point.sample) {
    return
  }

  if ('list' === point.op) {
    const records = recordsOf(point.sample)
    if (null != records) {
      assert(Array.isArray(result), 'list did not return a list')
      assert.equal(result.length, records.length,
        'list read ' + result.length + ' records where the definition example holds ' +
        records.length)
    }
  }
  else if ('load' === point.op || 'create' === point.op || 'update' === point.op) {
    const record = recordOf(point.sample, point.idField)
    if (null != record) {
      assert.equal(result?.data?.()?.[point.idField], record[point.idField],
        'the entity does not hold the record the definition example returns')
    }
  }
}


function placed(cred, headers, url) {
  if ('query' === cred.in) {
    return KEY === url.searchParams.get(cred.name)
  }

  if ('cookie' === cred.in) {
    return String(headers.get('cookie') || '').split(';')
      .some((part) => cred.name + '=' + KEY === part.trim())
  }

  const value = headers.get(cred.name)
  if (null == value) {
    return false
  }

  const [kind, token] = value.split(' ')

  // The client carries no secret, so the password must be empty.
  if ('basic' === cred.scheme) {
    return 'basic' === String(kind).toLowerCase() &&
      Buffer.from(String(token), 'base64').toString('utf8') === KEY + ':'
  }

  if ('bearer' === cred.scheme) {
    return 'bearer' === String(kind).toLowerCase() && KEY === token
  }

  return value.includes(KEY)
}


// What an envelope may hold beside what it carries: status and paging,
// compared without case, `_` or `-`. Any other value is data of the body's
// own, which makes the body a record rather than an envelope.
const ENVELOPE_KEY = /^(success|status|ok|message|code|error|errorcode|errormessage|requestid|timestamp|took|version|apiversion|object|url)$|count$|total|page|cursor|next|prev|limit|offset|more|size$/


function ownData(sample) {
  return Object.entries(sample).some(([key, value]) =>
    null != value && 'object' !== typeof value &&
    !ENVELOPE_KEY.test(key.toLowerCase().replace(/[_-]/g, '')))
}


function isRecord(value) {
  return null != value && 'object' === typeof value && !Array.isArray(value)
}


// The records a list response holds: the body itself, or the one non-empty
// list of objects in a page. Anything else, such as a record that happens to
// hold a list, proves nothing.
function recordsOf(sample) {
  if (Array.isArray(sample)) {
    return sample
  }
  if (!isRecord(sample) || ownData(sample)) {
    return null
  }
  const lists = Object.values(sample).filter((v) => Array.isArray(v) && 0 < v.length &&
    v.every(isRecord))
  return 1 === lists.length ? lists[0] : null
}


// The record a single-item response returns: the body, or the one object an
// envelope carries with the identity field. A body with data of its own is
// the record itself, whatever it names its identity.
function recordOf(sample, idField) {
  if (!isRecord(sample)) {
    return null
  }
  if (null != sample[idField]) {
    return sample
  }
  if (ownData(sample)) {
    return null
  }
  const inner = Object.values(sample).filter((v) => isRecord(v) && null != v[idField])
  return 1 === inner.length ? inner[0] : null
}


module.exports = { runDefinitionPoint, recordsOf, recordOf }
