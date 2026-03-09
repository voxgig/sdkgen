
import { Context, Response, Result } from '../types'


async function makeRequest(ctx: Context): Promise<Response | Error> {
  // PreRequest feature hook has already provided a result.
  if (ctx.out.request) {
    return ctx.out.request
  }

  const spec = ctx.spec
  const utility = ctx.utility
  const makeUrl = utility.makeUrl
  const fetcher = utility.fetcher

  let response = new Response({})

  let result = new Result({})

  ctx.result = result

  if (null == spec) {
    return ctx.error('request_no_spec', 'Expected context spec property to be defined.')
  }


  try {
    spec.step = 'prepare'

    const url = makeUrl(ctx)
    if (url instanceof Error) {
      throw url
    }

    spec.url = url

    const fetchdef: any = {
      method: spec.method,
      headers: spec.headers,
    }

    if (null != spec.body) {
      fetchdef.body =
        'object' === typeof spec.body ? JSON.stringify(spec.body) : spec.body
    }

    if (ctx.ctrl.explain) {
      ctx.ctrl.explain.fetchdef = fetchdef
    }

    spec.step = 'prerequest'

    // TODO: see js code, use `native` prop here
    const fetched = await fetcher(ctx, url, fetchdef)

    if (null == fetched) {
      response = new Response({ err: ctx.error('request_no_response', 'response: undefined') })
    }
    else if (fetched instanceof Error) {
      response = new Response({ err: fetched })
    }
    else {
      response = new Response(fetched)
    }
  }
  catch (err) {
    response.err = err as Error
  }

  spec.step = 'postrequest'

  ctx.response = response

  return response
}


export {
  makeRequest
}
