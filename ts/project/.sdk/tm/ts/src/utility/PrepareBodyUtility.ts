
import { Context } from '../types'

import { isRawRequest, rawBody } from './MediaUtility'

function prepareBody(ctx: Context) {
  const op = ctx.op

  const utility = ctx.utility
  const error = utility.makeError
  const transformRequest = utility.transformRequest

  let body = undefined

  if ('data' === op.input) {
    if (isRawRequest(ctx.point)) {
      return rawBody(ctx.reqdata)
    }

    try {
      body = transformRequest(ctx)

    }
    catch (err) {
      return error(ctx, err)
    }
  }

  else if (0 < (ctx.point?.fields?.length ?? 0)) {
    body = matchBody(ctx)
  }

  return body
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

