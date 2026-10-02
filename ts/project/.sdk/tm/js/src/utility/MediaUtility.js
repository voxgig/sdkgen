
// The media types a point declares: `response` (the model's `rs`) for the
// Accept header, and `body` (the model's `rb`) for the request body.


// The data key holding a raw request body. Like `$action`, it can never be a
// declared argument name.
const RAW_BODY = '$body'


function isJsonMedia(type) {
  const media = String(null == type ? '' : type).split(';')[0].trim().toLowerCase()
  return 'application/json' === media || 'text/json' === media || media.endsWith('+json')
}


// The declared JSON type alone, else every declared type in the model's
// order; nothing when no success response declares a body.
function acceptOf(point) {
  const res = null == point ? undefined : point.response
  if (null == res || 'string' !== typeof res.media || '' === res.media) {
    return undefined
  }
  if ('json' === res.kind) {
    return res.media
  }
  const alts = Array.isArray(res.alternatives) ? res.alternatives : []
  return [res.media, ...alts.map((alt) => null == alt ? undefined : alt.media)]
    .filter((media) => 'string' === typeof media && '' !== media)
    .join(', ')
}


function isRawRequest(point) {
  return null != point && null != point.body && 'raw' === point.body.kind
}


function headerKey(headers, name) {
  return Object.keys(headers).find((key) => name === key.toLowerCase())
}


// A caller's accept wins. A declared request type replaces a JSON
// content-type, the SDK default, and leaves any other the caller set.
function mediaHeaders(point, headers) {
  const accept = acceptOf(point)
  if (null != accept && null == headerKey(headers, 'accept')) {
    headers.accept = accept
  }

  const body = null == point ? undefined : point.body
  if (null != body && ('raw' === body.kind || 'json' === body.kind) &&
    'string' === typeof body.media && '' !== body.media) {
    const key = headerKey(headers, 'content-type')
    if (null == key || isJsonMedia(headers[key])) {
      if (null != key) delete headers[key]
      headers['content-type'] = body.media
    }
  }

  return headers
}


function rawBody(reqdata) {
  return null != reqdata && 'object' === typeof reqdata ? reqdata[RAW_BODY] : undefined
}


function isStream(value) {
  return null != value && 'object' === typeof value &&
    (('undefined' !== typeof ReadableStream && value instanceof ReadableStream) ||
      'function' === typeof value[Symbol.asyncIterator])
}


// Bytes, a Blob or a stream: fetch sends these as they are.
function isRawValue(value) {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value) ||
    ('undefined' !== typeof Blob && value instanceof Blob) || isStream(value)
}


module.exports = {
  RAW_BODY,
  acceptOf,
  isJsonMedia,
  isRawRequest,
  isRawValue,
  isStream,
  mediaHeaders,
  rawBody,
}
