
const { clean } = require('./CleanUtility')

function done(ctx) {
  const error = ctx.utility.makeError
  const delprop = ctx.utility.struct.delprop

  if (ctx.ctrl.explain) {
    ctx.ctrl.explain = clean(ctx, ctx.ctrl.explain)
    delprop(ctx.ctrl.explain.result, 'err')
  }

  // An operation resolves to the ENTITY, not the raw data. Entities are
  // stateful: the op fragment has just absorbed resdata/resmatch into this
  // instance, and the caller reaches the record through .data(). Two
  // structural exceptions: `list` resolves to the ARRAY of entity
  // instances makeResult built, and a context with no entity
  // (direct/prepare, streaming) has nothing to return but the data. A
  // removed entity keeps its data but is no longer live. See AGENTS.md.
  if (ctx.result && ctx.result.ok) {
    const entity = ctx.entity
    const opname = ctx.op && ctx.op.name

    if (null != entity && 'list' !== opname) {
      if ('remove' === opname) {
        entity._deleted = true
      }
      return entity
    }

    return ctx.result.resdata
  }

  return error(ctx)
}

module.exports = {
  done
}
