
import { Context, Spec } from '../types'


// Create request specificaton.
function spec(ctx: Context): Spec | Error {
  if (ctx.out.spec) {
    return ctx.spec = ctx.out.spec
  }

  const alt = ctx.alt
  const options = ctx.options
  const utility = ctx.utility

  const method = utility.method
  const params = utility.params
  const query = utility.query
  const headers = utility.headers
  const body = utility.body
  // TODO: rename others to prepareNAME
  const preparePath = utility.preparePath
  const auth = utility.auth

  ctx.spec = {
    base: options.base, // string, URL endpoint base prefix,
    prefix: options.prefix,
    // path: op.path,
    parts: alt.parts,
    suffix: options.suffix,
    method: 'GET',
    params: {},
    query: {},
    headers: {},
    body: undefined,
    step: 'start',
    alias: {}
  }

  ctx.spec.method = method(ctx)

  if (!options.allow.method.includes(ctx.spec.method)) {
    return Error('Method "' + ctx.spec.method +
      '" not allowed by SDK option allow.method value: "' + options.allow.method + '"')
  }

  ctx.spec.params = params(ctx)
  ctx.spec.query = query(ctx)
  ctx.spec.headers = headers(ctx)
  ctx.spec.body = body(ctx)
  ctx.spec.path = preparePath(ctx)

  if (ctx.ctrl.explain) {
    ctx.ctrl.explain.spec = ctx.spec
  }

  const spec = auth(ctx)

  if (!(spec instanceof Error)) {
    ctx.spec = spec
  }

  return spec
}


export {
  spec
}
