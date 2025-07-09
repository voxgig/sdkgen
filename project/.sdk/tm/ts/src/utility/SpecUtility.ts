
import { Context } from '../types'


// Create request specificaton.
function spec(ctx: Context) {
  const { client, op, utility } = ctx
  const { method, params, query, headers, body, auth } = utility

  let options = client.options()

  ctx.spec = {
    base: options.base, // string, URL endpoint base prefix,
    prefix: options.prefix,
    path: op.path,
    suffix: options.suffix,
    method: 'get',
    params: {},
    query: {},
    headers: {},
    body: undefined,
    step: 'start',
    alias: {}
  }

  const reqMethod = method(ctx)
  const reqParams = params(ctx)
  const reqQuery = query(ctx)
  const reqHeaders = headers(ctx)
  const reqBody = body(ctx)

  ctx.spec.method = reqMethod
  ctx.spec.params = reqParams
  ctx.spec.query = reqQuery
  ctx.spec.headers = reqHeaders
  ctx.spec.body = reqBody

  if (ctx.ctrl.explain) {
    ctx.ctrl.explain.spec = ctx.spec
  }

  auth(ctx)
}


export {
  spec
}
