
import { Context } from '../types'


async function resultBody(ctx: Context) {
  const { response, result } = ctx

  if (result) {
    if (response && response.json && null != response.body) {
      const json = await response.json()
      result.body = json
    }
  }

  return result
}


export {
  resultBody
}
