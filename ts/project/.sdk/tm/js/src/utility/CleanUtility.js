
const { OPTSPEC } = require('../Schema')

const { RAW_BODY, headerValue, isBinaryResponse, isStream } = require('./MediaUtility')


// Everything that leaves the pipeline passes through clean: the error, the
// explain record, the serialised context, and whatever a feature emits.
// Two layers: every registered secret VALUE (and its encoded forms) is
// replaced wherever it appears in a string, and every value under a
// sensitive KEY name is masked whatever it holds. Inside the pipeline data
// stays raw, so a hook can still read the header it must add to.

const MAXDEPTH = 32
const CIRCULAR = '[circular]'

// The key of what stands in for a body of bytes; its value is the kind.
const BINARY = 'binary$'


function normkey(key) {
  return String(key).toLowerCase().replace(/[-_]/g, '')
}


function splitkeys(keys) {
  return String(null == keys ? '' : keys)
    .split(/\s*,\s*/)
    .map(normkey)
    .filter((k) => '' !== k)
}


// The comma-separated literal values a caller registers; a list is taken
// as-is for a caller that has one.
function splitvalues(values) {
  if (Array.isArray(values)) {
    return values.filter((v) => 'string' === typeof v)
  }
  return String(null == values ? '' : values)
    .split(/\s*,\s*/)
    .filter((v) => '' !== v)
}


// The spec carries numbers as strings, so every target reads it alike.
function count(val, dflt) {
  const n = Math.floor(Number(val))
  return Number.isFinite(n) && 0 <= n ? n : dflt
}


// The derived block makeOptions builds; a context without options (makeError
// is reached with a bare one) falls back to the schema defaults, so nothing
// leaves raw for want of a constructor.
function cleanConfig(ctx) {
  const derived = ctx?.options?.__derived__?.clean
  if (null != derived) {
    return derived
  }
  return makeCleanConfig(OPTSPEC?.clean)
}


function makeCleanConfig(cleanopts) {
  const opts = cleanopts || {}
  return {
    active: false !== opts.active,
    keys: splitkeys(opts.keys),
    values: [],
    mask: 'string' === typeof opts.mask ? opts.mask : '[redacted]',
    hint: count(opts.hint, 0),
    min: Math.max(1, count(opts.min, 4)),
  }
}


// The encoded forms a value travels in: Basic and Bearer both carry base64,
// a query credential is percent-encoded, and a JSON dump escapes it.
function forms(value) {
  const out = [value]
  const add = (s) => { if ('' !== s && !out.includes(s)) out.push(s) }
  try { add(Buffer.from(value, 'utf8').toString('base64')) } catch (_e) { }
  try { add(encodeURIComponent(value)) } catch (_e) { }
  try { add(JSON.stringify(value).slice(1, -1)) } catch (_e) { }
  return out
}


// Register a secret value. Idempotent; shorter than `min` is not a secret
// the SDK can mask without blanking ordinary text.
function cleanAdd(ctx, value) {
  const cfg = cleanConfig(ctx)
  if ('string' !== typeof value || value.length < cfg.min) {
    return
  }
  let changed = false
  for (const form of forms(value)) {
    if (form.length >= cfg.min && !cfg.values.includes(form)) {
      cfg.values.push(form)
      changed = true
    }
  }
  if (changed) {
    cfg.values.sort((a, b) => b.length - a.length)
  }
}


function maskValue(cfg, value) {
  if (0 < cfg.hint && value.length > 2 * cfg.hint) {
    return cfg.mask + value.slice(-cfg.hint)
  }
  return cfg.mask
}


function cleanString(cfg, text) {
  let out = text
  for (const value of cfg.values) {
    if (out.includes(value)) {
      out = out.split(value).join(maskValue(cfg, value))
    }
  }
  return out
}


function sensitiveKey(cfg, key) {
  if (null == key || 'number' === typeof key) {
    return false
  }
  const nk = normkey(key)
  for (const k of cfg.keys) {
    if (nk.includes(k)) {
      return true
    }
  }
  return false
}


// A string sent as a body goes as UTF-8.
function utf8Length(text) {
  return 'undefined' !== typeof Buffer ? Buffer.byteLength(text, 'utf8') :
    new TextEncoder().encode(text).length
}


// The live bodies of this call that are bytes, each with its type: the
// request body of a point the model marks binary, and a response body that
// is bytes. A response read as text does not say how many bytes it was, so
// it is not sized. A string shorter than the registry accepts is not told
// from ordinary text.
function binaryBodies(ctx, cfg) {
  const known = (v) => null != v && ('string' !== typeof v || cfg.min <= v.length)
  const bodies = []

  const body = ctx?.point?.body
  if ('raw' === body?.kind && true === body.binary) {
    bodies.push({
      live: [ctx.spec?.body, ctx.reqdata?.[RAW_BODY]].filter(known),
      type: 'string' === typeof body.media ? body.media : undefined,
      sized: true,
    })
  }

  const response = ctx?.response
  const type = headerValue(response?.headers, 'content-type')
  if (null != response && isBinaryResponse(ctx.point, type)) {
    bodies.push({ live: [response.body].filter(known), type: '' === type ? undefined : type, sized: false })
  }

  return bodies.filter((bin) => 0 < bin.live.length)
}


// Bytes are described, never copied (ADR-004): the kind, and the size and
// media type where they are known. A string is bytes only as a live body.
function describeBinary(val, bins) {
  const bin = bins.find((b) => b.live.includes(val))
  let desc = undefined

  if ('string' === typeof val) {
    if (null != bin) {
      desc = bin.sized ? { [BINARY]: 'bytes', size: utf8Length(val) } : { [BINARY]: 'bytes' }
    }
  }
  else if (val instanceof ArrayBuffer || ArrayBuffer.isView(val) ||
    ('undefined' !== typeof SharedArrayBuffer && val instanceof SharedArrayBuffer)) {
    desc = { [BINARY]: 'bytes', size: val.byteLength }
  }
  else if ('undefined' !== typeof Blob && val instanceof Blob) {
    desc = { [BINARY]: 'bytes', size: val.size }
    if ('' !== val.type) {
      desc.type = val.type
    }
  }
  else if (isStream(val)) {
    desc = { [BINARY]: 'stream' }
  }

  if (null != desc && null == desc.type && null != bin?.type) {
    desc.type = bin.type
  }

  return desc
}


// A plain-data copy of what is about to leave: toJSON is honoured (an entity
// serialises as its data, a context as its record), functions are dropped,
// cycles are cut, and no live object is shared with the copy - masking the
// copy must never mask the pipeline's own spec.
function snapshot(cfg, bin, val, key, depth, seen) {
  if (null == val) {
    return val
  }

  const t = typeof val

  if ('string' === t) {
    if (sensitiveKey(cfg, key)) {
      return maskValue(cfg, val)
    }
    return describeBinary(val, bin) ?? cleanString(cfg, val)
  }

  if ('function' === t) {
    return undefined
  }

  if ('object' !== t) {
    return sensitiveKey(cfg, key) ? cfg.mask : val
  }

  if (MAXDEPTH <= depth || seen.includes(val)) {
    return CIRCULAR
  }

  if (sensitiveKey(cfg, key)) {
    return cfg.mask
  }

  const desc = describeBinary(val, bin)
  if (undefined !== desc) {
    return desc
  }

  seen.push(val)
  try {
    if (Array.isArray(val)) {
      const out = []
      for (let i = 0; i < val.length; i++) {
        out.push(snapshot(cfg, bin, val[i], i, depth + 1, seen))
      }
      return out
    }

    if (val instanceof Error) {
      const out = {
        message: cleanString(cfg, String(val.message)),
        stack: cleanString(cfg, String(val.stack || '')),
      }
      for (const k of Object.keys(val)) {
        const v = snapshot(cfg, bin, val[k], k, depth + 1, seen)
        if (undefined !== v) out[k] = v
      }
      return out
    }

    if ('function' === typeof val.toJSON) {
      const json = val.toJSON()
      return json === val ? plain(cfg, bin, val, depth, seen) :
        snapshot(cfg, bin, json, key, depth + 1, seen)
    }

    return plain(cfg, bin, val, depth, seen)
  }
  finally {
    seen.pop()
  }
}


function plain(cfg, bin, val, depth, seen) {
  const out = {}
  for (const k of Object.keys(val)) {
    const v = snapshot(cfg, bin, val[k], k, depth + 1, seen)
    if (undefined !== v) out[cleanName(cfg, out, k)] = v
  }
  return out
}


// A registered value used as a property name is masked like any other
// string; names that mask alike take a counter, so none is lost.
function cleanName(cfg, out, key) {
  const name = cleanString(cfg, key)
  if (name === key || !Object.prototype.hasOwnProperty.call(out, name)) {
    return name
  }
  let i = 1
  while (Object.prototype.hasOwnProperty.call(out, name + '#' + i)) i++
  return name + '#' + i
}


// Clean a value on its way out. A string is redacted; an Error is redacted
// IN PLACE (it is about to be thrown, and its identity matters to the
// caller); anything else comes back as a masked plain-data copy.
function clean(ctx, val) {
  const cfg = cleanConfig(ctx)

  if (false === cfg.active) {
    return val
  }

  if ('string' === typeof val) {
    return cleanString(cfg, val)
  }

  const bin = binaryBodies(ctx, cfg)

  if (val instanceof Error) {
    setMessage(val, cleanString(cfg, String(val.message)))
    if ('string' === typeof val.stack) {
      val.stack = cleanString(cfg, val.stack)
    }
    for (const k of Object.keys(val)) {
      let v = val[k]
      if ('string' === typeof v) {
        v = sensitiveKey(cfg, k) ? maskValue(cfg, v) : cleanString(cfg, v)
      }
      else if (null != v && 'object' === typeof v) {
        v = snapshot(cfg, bin, v, k, 1, [])
      }
      const name = cleanString(cfg, k)
      if (name !== k) {
        delete val[k]
      }
      val[name === k ? k : cleanName(cfg, val, k)] = v
    }
    return val
  }

  return snapshot(cfg, bin, val, undefined, 0, [])
}


// Is this key name sensitive under the context's clean configuration?
// Assigned where assignment works. A DOMException's message is an inherited
// getter with no setter, which strict code cannot assign, so it is defined
// on the instance; an own message that can be neither is left as it is.
function setMessage(err, text) {
  let owner = err
  let desc = Object.getOwnPropertyDescriptor(owner, 'message')
  while (null == desc && null != (owner = Object.getPrototypeOf(owner))) {
    desc = Object.getOwnPropertyDescriptor(owner, 'message')
  }
  if (null == desc || desc.writable || null != desc.set) {
    err.message = text
  }
  else if (owner !== err || desc.configurable) {
    Object.defineProperty(err, 'message', {
      value: text,
      writable: true,
      enumerable: owner === err && !!desc.enumerable,
      configurable: true,
    })
  }
}


function cleanKey(ctx, key) {
  return sensitiveKey(cleanConfig(ctx), key)
}


// Whether a named value is a secret: by its name, or by a registered value
// it holds. Answered with clean off too: a redirect asks, not a diagnostic.
function cleanSecret(ctx, key, value) {
  const cfg = cleanConfig(ctx)
  return sensitiveKey(cfg, key) ||
    ('string' === typeof value && cfg.values.some((v) => value.includes(v)))
}


// Every scalar under a sensitive name, at any depth and of any shape: a
// credential mistyped as an object or a number is still a credential, and
// the validation error that rejects it quotes it.
function cleanAddSensitive(ctx, val, under = false, depth = 0, seen = [], parent) {
  if (null == val || MAXDEPTH <= depth) {
    return
  }
  const t = typeof val
  if ('string' === t || 'number' === t || 'bigint' === t) {
    if (under) cleanAdd(ctx, String(val))
    return
  }
  if ('object' !== t || seen.includes(val)) {
    return
  }
  seen.push(val)
  // The keys under `feature` name features, not fields: `secrets` is no secret.
  const named = !(1 === depth && 'feature' === parent)
  for (const k of Object.keys(val)) {
    cleanAddSensitive(ctx, val[k], under || (named && cleanKey(ctx, k)), depth + 1, seen, k)
  }
}


module.exports = {
  clean,
  cleanAdd,
  cleanAddSensitive,
  cleanKey,
  cleanSecret,
  makeCleanConfig,
  setMessage,
  splitvalues,
}
