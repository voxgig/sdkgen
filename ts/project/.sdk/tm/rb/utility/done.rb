# ProjectName SDK utility: done
module ProjectNameUtilities
  Done = ->(ctx) {
    if ctx.ctrl.explain
      ctx.ctrl.explain = ctx.utility.clean.call(ctx, ctx.ctrl.explain)
      er = ctx.ctrl.explain["result"]
      er.delete("err") if er.is_a?(Hash)
    end
    # An operation resolves to the ENTITY, not the raw data. Entities are
    # stateful: the op fragment has just absorbed resdata/resmatch into this
    # instance, and the caller reaches the record through .data(). Two
    # structural exceptions: `list` resolves to the ARRAY of entity
    # instances makeResult built, and a context with no entity
    # (direct/prepare, streaming) has nothing to return but the data. A
    # removed entity keeps its data but is no longer live. See AGENTS.md.
    if ctx.result && ctx.result.ok
      entity = ctx.entity
      opname = ctx.op&.name

      if entity && opname != "list"
        entity.mark_deleted if opname == "remove"
        return entity
      end

      return ctx.result.resdata
    end
    # On error, make_error raises the exception (or, when throw_err is
    # disabled, returns the bare result data). Propagate its value.
    ctx.utility.make_error.call(ctx, nil)
  }
end
