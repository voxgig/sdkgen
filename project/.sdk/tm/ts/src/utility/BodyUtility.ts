
import { Context } from '../types'

function body(ctx: Context) {
  const op = ctx.op

  const utility = ctx.utility
  const error = utility.error
  const reqform = utility.reqform

  let body = undefined

  if ('data' === op.select) {
    try {
      body = reqform(ctx)

      // if (alt.check.nobody && null == body) {
      //   return error(ctx, new Error('Request body is empty.'))
      // }
    }
    catch (err) {
      return error(ctx, err)
    }
  }

  return body
}

export {
  body
}

