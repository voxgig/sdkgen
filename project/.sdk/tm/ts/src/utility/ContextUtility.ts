
import { getprop } from './StructUtility'


function contextify(ctxmap: Record<string, any>) {
  const ctx: any = new Context()

  ctx.ctrl = getprop(ctxmap, 'ctrl', {})
  ctx.meta = getprop(ctxmap, 'meta', {})
  ctx.work = getprop(ctxmap, 'work', {})

  ctx.client = getprop(ctxmap, 'client', undefined)
  ctx.config = getprop(ctxmap, 'config', undefined)
  ctx.entity = getprop(ctxmap, 'entity', undefined)
  ctx.op = getprop(ctxmap, 'op', undefined)
  ctx.entopts = getprop(ctxmap, 'entopts', undefined)
  ctx.options = getprop(ctxmap, 'options', undefined)
  ctx.response = getprop(ctxmap, 'response', undefined)
  ctx.result = getprop(ctxmap, 'result', undefined)
  ctx.spec = getprop(ctxmap, 'spec', undefined)
  ctx.utility = getprop(ctxmap, 'utility', undefined)
  ctx.data = getprop(ctxmap, 'data', undefined)
  ctx.reqdata = getprop(ctxmap, 'reqdata', undefined)
  ctx.match = getprop(ctxmap, 'match', undefined)
  ctx.reqmatch = getprop(ctxmap, 'reqmatch', undefined)

  return ctx
}


class Context {

  ctrl = {}
  meta = {}
  work = {}

  client = undefined
  config = undefined
  entity = undefined
  op = undefined
  entopts = undefined
  options = undefined
  response = undefined
  result = undefined
  spec = undefined
  utility = undefined
  data = undefined
  reqdata = undefined
  match = undefined
  reqmatch = undefined

  toJSON() {
    return {
      op: this.op,
      spec: this.spec,
      entity: this.entity,
      result: this.result,
      meta: this.meta,
    }
  }
}


export {
  contextify,
  Context
}
