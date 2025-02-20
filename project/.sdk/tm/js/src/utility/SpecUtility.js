
// Create request specificaton.
function spec(ctx) {
  const { client, op, utility } = ctx
  const { method, params, query, headers, body, auth } = utility
  
  let options = client.options()

  const reqMethod = method(ctx)
  const reqParams = params(ctx)
  const reqQuery = query(ctx)
  const reqHeaders = headers(ctx)
  const reqBody = body(ctx)

  ctx.spec = {
    base: options.base, // string, URL endpoint base prefix,
    prefix: options.prefix,
    path: op.path,
    suffix: options.suffix,
    method: reqMethod,
    params: reqParams,
    query: reqQuery,
    headers: reqHeaders,
    body: reqBody,
    step: 'start',
    alias: {}
  }

  auth(ctx)
}


module.exports = {
  spec
}
