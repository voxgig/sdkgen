
const { method }  = require('./MethodUtility')
const { params }  = require('./ParamsUtility')
const { query }  = require('./QueryUtility')
const { headers }  = require('./HeadersUtility')
const { body }  = require('./BodyUtility')
const { auth }  = require('./AuthUtility')

// Create request specificaton.
function spec(ctx) {
  const {client, op} = ctx
  
  let options = client.options()

  const reqMethod = method(ctx)
  const reqParams = params(ctx)
  const reqQuery = query(ctx)
  const reqHeaders = headers(ctx)
  const reqBody = body(ctx)

  let spec = {
    base: options.base, // string, URL endpoint base prefix,
    prefix: options.prefix,
    path: op.path,
    suffix: options.suffix,
    method: reqMethod,
    params: reqParams,
    query: reqQuery,
    headers: reqHeaders,
    body: reqBody,
  }

  spec = auth(ctx, spec)
  
  return spec
}


module.exports = {
  spec
}
