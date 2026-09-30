
import { Context } from '../types'


import { clean } from './CleanUtility'


function done(ctx: Context) {
  const error = ctx.utility.makeError
  const delprop = ctx.utility.struct.delprop

  if (ctx.ctrl.explain) {
    // A copy: with clean off, explain.result is the live result makeError reads.
    const explain = clean(ctx, ctx.ctrl.explain)
    if (null != explain.result) explain.result = delprop({ ...explain.result }, 'err')
    ctx.ctrl.explain = explain
  }

  if (ctx.result && ctx.result.ok) {
    return ctx.result.resdata
  }

  return error(ctx)
}


export {
  done
}
