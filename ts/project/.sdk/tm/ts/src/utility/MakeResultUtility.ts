
import { Result, Context } from '../types'


function makeResult(ctx: Context): Result | Error {
  // PreResult feature hook has already provided a result.
  if (ctx.out.result) {
    return ctx.out.result
  }

  const utility = ctx.utility
  const transformResponse = utility.transformResponse

  const op = ctx.op
  const entity = ctx.entity

  const spec = ctx.spec
  const result = ctx.result

  if (null == spec) {
    return ctx.error('result_no_spec', 'Expected context spec property to be defined.')
  }

  if (null == result) {
    return ctx.error('result_no_result', 'Expected context result property to be defined.')
  }

  spec.step = 'result'

  transformResponse(ctx)

  // Every operation resolves to PLAIN records — load, create, update and
  // list alike. `list` used to be the outlier: it wrapped each record in an
  // entity instance, so the same record came back with a different type, a
  // different key order, and an extra `voxgig$entity` marker depending on
  // which call produced it. Any consumer touching both paths had to
  // normalise defensively, and feeding a wrapped record into a host
  // framework's own metadata (Seneca's `entity$`) silently produced wrong
  // entities with no error at all.
  //
  // A missing or empty list still normalises to an empty array, so callers
  // can iterate the result unconditionally.
  if ('list' == op.name) {
    const resdata = result.resdata
    result.resdata = (null == resdata || 0 === resdata.length) ? [] : resdata
  }

  if (ctx.ctrl.explain) {
    ctx.ctrl.explain.result = result
  }

  // NOTE: returns processesd result.
  return result
}


export {
  makeResult
}
