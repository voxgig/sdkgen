const { OPTSPEC } = require('../../Schema')

const { isBytes, toBytes } = require('../BinaryUtility')
const { RAW_BODY, headerValue, isStream } = require('../MediaUtility')


function maxBuffer(ctx) {
  for (const val of [ctx.options?.maxBuffer, OPTSPEC?.maxBuffer]) {
    const n = Number(val)
    if (null != val && Number.isFinite(n) && 0 <= n) {
      return n
    }
  }
  return 16777216
}


async function cancel(body) {
  try {
    await body?.cancel?.()
  }
  catch (_e) { }
}


function tooLarge(ctx, code, max, declared) {
  return ctx.error(code, 'response: body ' + (null == declared ? 'is longer than' :
    'of ' + declared + ' bytes exceeds') + ' maxBuffer (' + max + ' bytes)')
}


// The whole body, refused past the bound: by its declared length before a
// byte is read, else by the count as it arrives.
async function readBounded(ctx, response, max, code) {
  const body = response?.body
  const length = headerValue(response?.headers, 'content-length').trim()
  const declared = /^\d+$/.test(length) ? Number(length) : undefined

  if (null != declared && max < declared) {
    await cancel(body)
    throw tooLarge(ctx, code, max, declared)
  }

  const chunks = []
  let count = 0
  const take = async (chunk) => {
    const bytes = 'string' === typeof chunk || isBytes(chunk) ? toBytes(chunk) :
      toBytes(String(chunk))
    count += bytes.byteLength
    if (max < count) {
      throw tooLarge(ctx, code, max)
    }
    chunks.push(bytes)
  }

  if ('undefined' !== typeof ReadableStream && body instanceof ReadableStream) {
    const reader = body.getReader()
    try {
      for (; ;) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        await take(value)
      }
    }
    catch (err) {
      await reader.cancel().catch(() => undefined)
      throw err
    }
  }
  else if (isStream(body)) {
    for await (const chunk of body) {
      await take(chunk)
    }
  }
  else if ('undefined' !== typeof Blob && body instanceof Blob) {
    if (max < body.size) {
      throw tooLarge(ctx, code, max, body.size)
    }
    await take(new Uint8Array(await body.arrayBuffer()))
  }
  else if (null != body) {
    await take(body)
  }
  else if ('function' === typeof response?.text) {
    await take(await response.text())
  }

  const out = new Uint8Array(count)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.byteLength
  }
  return out
}


// A raw success body: text into the record under `$body`; bytes only into a
// binary handle's read, never into the record.
async function readRaw(ctx) {
  const response = ctx.response
  const result = ctx.result
  const transfer = ctx.ctrl?.transfer
  const max = maxBuffer(ctx)

  if (true === ctx.point?.response?.binary) {
    result.body = undefined
    if ('read' === transfer?.direction) {
      transfer.bytes = await readBounded(ctx, response, max, 'binary_too_large')
    }
    else {
      await cancel(response?.body)
    }
    return
  }

  const bytes = await readBounded(ctx, response, max, 'response_too_large')
  result.body = { [RAW_BODY]: new TextDecoder().decode(bytes) }
}


module.exports = {
  maxBuffer,
  readBounded,
  readRaw,
}
