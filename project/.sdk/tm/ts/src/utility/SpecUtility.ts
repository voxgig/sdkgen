
import { Context, Spec } from '../types'


// Create request specificaton.
function spec(ctx: Context): Spec | Error {
  if (ctx.out.spec) {
    return ctx.spec = ctx.out.spec
  }

  const { op, alt, utility, options } = ctx
  const struct = utility.struct
  const size = struct.size
  const select = struct.select

  // TODO: rename others to prepareNAME
  const { method, params, query, headers, body, preparePath, auth } = utility

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

  /*
  if (1 < size(op.pathalt)) {
    let hasQuery = false
    const paramQuery: any = {}
    for (let paramName of op.params) {
      paramQuery[paramName] = null == ctx.spec.params[paramName] ? false : true
      hasQuery = true
    }

    if (hasQuery) {
      const foundParamAlts = select(op.pathalt, paramQuery)
      if (0 < size(foundParamAlts)) {
        ctx.spec.path = foundParamAlts[0].path
      }
    }
  }
  */

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
