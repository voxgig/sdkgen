
import { Context, Response } from '../types'


async function makeResponse(ctx: Context): Promise<Response | Error> {
  // PreResponse feature hook has already provided a result.
  if (ctx.out.response) {
    return ctx.out.response
  }

  const utility = ctx.utility
  const resultBasic = utility.resultBasic
  const resultHeaders = utility.resultHeaders
  const resultBody = utility.resultBody
  const transformResponse = utility.transformResponse

  const spec = ctx.spec
  const result = ctx.result
  const response = ctx.response


  if (null == spec) {
    return new Error('Expected context spec property to be defined.')
  }

  if (null == response) {
    return new Error('Expected context response property to be defined.')
  }

  if (null == result) {
    return new Error('Expected context result property to be defined.')
  }


  spec.step = 'response'

  try {
    resultBasic(ctx)
    resultHeaders(ctx)
    await resultBody(ctx)
    transformResponse(ctx)

    if (null == result.err) {
      result.ok = true
    }
  }
  catch (err) {
    result.err = err
  }

  if (ctx.ctrl.explain) {
    ctx.ctrl.explain.result = result
  }

  return response
}


export {
  makeResponse
}
