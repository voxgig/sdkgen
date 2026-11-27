const { RAW_BODY, isStream } = require('./MediaUtility')


const MAXDEPTH = 32


// File content a caller hands the SDK, held as given. A string is content,
// sent encoded as UTF-8: nothing here reads a path.
class BinarySource {
  kind = 'bytes'
  data
  name
  type

  constructor(data, opts = {}) {
    this.data = data
    if ('string' === typeof opts.name) {
      this.name = opts.name
    }
    if ('string' === typeof opts.type && '' !== opts.type) {
      this.type = opts.type
    }
  }

  get size() {
    return isBlob(this.data) ? this.data.size : this.data.byteLength
  }

  // A source serialised anywhere is described, never copied.
  toJSON() {
    const desc = { binary$: 'bytes', size: this.size }
    if (null != this.type) {
      desc.type = this.type
    }
    return desc
  }
}


function isBlob(value) {
  return 'undefined' !== typeof Blob && value instanceof Blob
}


function isBytes(value) {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value)
}


function toBytes(value) {
  if (value instanceof Uint8Array) {
    return value
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  return new TextEncoder().encode(String(value))
}


// The one source core builds: bytes, a Blob or File, or a string's UTF-8.
const binary = {
  bytes(data, opts = {}) {
    if (isBlob(data)) {
      const named = 'string' === typeof data.name ? data.name : undefined
      return new BinarySource(data, {
        name: opts.name ?? named,
        type: opts.type ?? (data.type || undefined),
      })
    }
    return new BinarySource(toBytes(data), opts)
  },
}


function isSource(value) {
  return value instanceof BinarySource || isBlob(value)
}


// The path of the first source in a value, or undefined.
function sourceAt(value, path, depth, seen) {
  if (null == value || 'object' !== typeof value || MAXDEPTH <= depth || seen.includes(value)) {
    return undefined
  }
  if (isSource(value)) {
    return path
  }
  if (isBytes(value) || isStream(value)) {
    return undefined
  }
  seen.push(value)
  for (const key of Object.keys(value)) {
    const found = sourceAt(value[key], '' === path ? key : path + '.' + key, depth + 1, seen)
    if (null != found) {
      return found
    }
  }
  return undefined
}


// The data keys whose values are file content: a multipart or form body's
// binary fields, and the whole of a raw body.
function binaryNames(point) {
  const body = point?.body
  if ('raw' === body?.kind) {
    return [RAW_BODY]
  }
  if ('multipart' === body?.kind || 'form' === body?.kind) {
    return (Array.isArray(body.fields) ? body.fields : [])
      .filter((field) => true === field?.binary && 'string' === typeof field.name)
      .map((field) => field.name)
  }
  return []
}


// Moves the values of binary fields out of the request data, before a hook,
// a transform, validation or clean reads it. A source anywhere else is refused.
function liftSources(ctx) {
  if (null != ctx.sources) {
    return undefined
  }

  const names = binaryNames(ctx.point)
  const lifted = {}
  let reqdata = ctx.reqdata

  if (null != reqdata && 'object' === typeof reqdata &&
    names.some((name) => Object.prototype.hasOwnProperty.call(reqdata, name))) {
    reqdata = { ...reqdata }
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(reqdata, name)) {
        lifted[name] = reqdata[name]
        delete reqdata[name]
      }
    }
  }

  const stray = sourceAt(reqdata, '', 0, []) ?? sourceAt(ctx.reqmatch, '', 0, [])
  if (null != stray) {
    return ctx.error('binary_source_refused', 'A binary source was passed in "' + stray +
      '", which is not a field the operation declares binary.')
  }

  ctx.reqdata = reqdata
  ctx.sources = lifted
  return undefined
}


// A response the model declares to be bytes is read only through the entity's
// binary handle, never into its data.
function bytesRefused(ctx) {
  const response = ctx.point?.response
  if ('raw' !== response?.kind || true !== response.binary || null != ctx.ctrl?.transfer) {
    return undefined
  }
  const action = ctx.point?.select?.$action
  const call = null == action ? 'binary()' : 'binary(\'' + action + '\')'
  return ctx.error('binary_sink_required', 'Operation "' + ctx.op?.name + '" on entity "' +
    ctx.op?.entity + '" answers bytes, which never enter the entity\'s data: read them with ' +
    'entity.' + call + '.bytes().')
}


// A plain value as the text of a form pair or a multipart part.
function itemText(value) {
  return 'string' === typeof value ? value :
    'number' === typeof value || 'boolean' === typeof value || 'bigint' === typeof value ?
      String(value) : JSON.stringify(value)
}


// The values a form or multipart body carries, in wire order: the fields the
// model declares, in its order, then any other key of the data, in code point
// order. An array repeats its field per item, or is one value joined by the
// field's `join`; an absent or null value sends nothing.
function bodyItems(body, data, lifted) {
  const fields = (Array.isArray(body?.fields) ? body.fields : [])
    .filter((field) => 'string' === typeof field?.name)
  const declared = fields.map((field) => field.name)
  const plain = null != data && 'object' === typeof data && !Array.isArray(data) ? data : {}
  const has = (map, key) => Object.prototype.hasOwnProperty.call(map, key)

  const names = [
    ...declared.filter((name) => has(plain, name) || has(lifted, name)),
    ...Object.keys(plain).filter((key) => !declared.includes(key)).sort(),
  ]

  const items = []
  for (const name of names) {
    const field = fields.find((f) => name === f.name) || { name }
    const value = has(lifted, name) ? lifted[name] : plain[name]
    const file = true === field.binary
    if (null == value) {
      continue
    }
    if (Array.isArray(value)) {
      const present = value.filter((item) => null != item)
      if (!file && 'string' === typeof field.join) {
        items.push({ name, field, value: present.map(itemText).join(field.join), binary: file })
      }
      else {
        present.forEach((item) => items.push({ name, field, value: item, binary: file }))
      }
    }
    else {
      items.push({ name, field, value, binary: file })
    }
  }
  return items
}


module.exports = {
  BinarySource,
  bodyItems,
  itemText,
  binary,
  bytesRefused,
  isBlob,
  isBytes,
  isSource,
  liftSources,
  toBytes,
}
