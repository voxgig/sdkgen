
import { Context } from '../types'


import { clean } from './CleanUtility'


function done(ctx: Context) {
  const error = ctx.utility.makeError
  const delprop = ctx.utility.struct.delprop

  if (ctx.ctrl.explain) {
    ctx.ctrl.explain = clean(ctx, ctx.ctrl.explain)
    delprop(ctx.ctrl.explain.result, 'err')
  }

  // An operation resolves to the ENTITY, not the raw data. Entities are
  // stateful: the op fragment has just absorbed `resdata`/`resmatch` into
  // this instance, and the caller reaches the record through `.data()`.
  //
  // Two exceptions, both structural rather than negotiable:
  //   - `list` resolves to the ARRAY of entity instances makeResult built,
  //     one per record.
  //   - a context with no entity (direct/prepare, and the streaming path)
  //     has nothing to return but the data.
  //
  // See AGENTS.md "Entity operations return ENTITIES".
  if (ctx.result && ctx.result.ok) {
    const entity: any = ctx.entity
    const opname = ctx.op && ctx.op.name

    if (null != entity && 'list' !== opname) {
      // A removed entity keeps its data but is no longer a live record.
      if ('remove' === opname) {
        entity._deleted = true
      }
      return entity
    }
    return ctx.result.resdata
  }

  return error(ctx)
}


export {
  done
}
