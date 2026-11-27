import { Context } from '../types'

import { BinarySource, liftSources } from './BinaryUtility'
import { RAW_BODY, isRawRequest } from './MediaUtility'

function prepareBody(ctx: Context) {
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

  else if (0 < (ctx.point?.fields?.length ?? 0)) {
    body = matchBody(ctx)
  }

  return body
}


// The encoded body, with its content type replacing any the headers carry:
// a multipart boundary is the encoder's alone to choose.
function encodeBody(ctx: Context, kind: string, data: any): any {
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
function matchBody(ctx: Context): Record<string, any> {
  const point: any = ctx.point
  const args = point.args || {}
  const getprop = ctx.utility.struct.getprop

  const routed: string[] = (point.params || [])
    .concat((args.params || []).map((arg: any) => arg?.name))
    .concat(['header', 'cookie', 'query'].flatMap((kind) => (args[kind] || [])
      .filter((arg: any) => true !== arg?.field).map((arg: any) => arg?.name)))

  const body: Record<string, any> = {}
  for (const name of point.fields || []) {
    const val = getprop(ctx.reqmatch, name)
    if (null != val && '$action' !== name && !routed.includes(name)) {
      body[name] = val
    }
  }

  return body
}

export {
  prepareBody
}
