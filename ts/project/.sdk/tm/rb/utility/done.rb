# ProjectName SDK utility: done
module ProjectNameUtilities
  Done = ->(ctx) {
    if ctx.ctrl.explain
      # The caller's own hash is the explain record (the control is built
      # from it), so the cleaned copy is written back INTO it: assigning a
      # fresh hash would leave the caller holding the raw one.
      cleaned = ctx.utility.clean.call(ctx, ctx.ctrl.explain)
      if cleaned.is_a?(Hash) && !cleaned.equal?(ctx.ctrl.explain)
        ctx.ctrl.explain.replace(cleaned)
      end
      er = ctx.ctrl.explain["result"]
      er.delete("err") if er.is_a?(Hash)
    end
    if ctx.result && ctx.result.ok
      return ctx.result.resdata
    end
    # On error, make_error raises the exception (or, when throw_err is
    # disabled, returns the bare result data). Propagate its value.
    ctx.utility.make_error.call(ctx, nil)
  }
end
