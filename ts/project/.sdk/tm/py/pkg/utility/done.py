# ProjectName SDK utility: done


def done_util(ctx):
    if ctx.ctrl.explain is not None:
        ctx.ctrl.explain = ctx.utility.clean(ctx, ctx.ctrl.explain)
        explain_result = ctx.ctrl.explain.get("result") if isinstance(ctx.ctrl.explain, dict) else None
        if isinstance(explain_result, dict):
            explain_result.pop("err", None)

    # An operation resolves to the ENTITY, not the raw data. Entities are
    # stateful: the op fragment has just absorbed resdata/resmatch into this
    # instance, and the caller reaches the record through .data(). Two
    # structural exceptions: `list` resolves to the ARRAY of entity
    # instances makeResult built, and a context with no entity
    # (direct/prepare, streaming) has nothing to return but the data. A
    # removed entity keeps its data but is no longer live. See AGENTS.md.
    if ctx.result is not None and ctx.result.ok:
        entity = ctx.entity
        opname = None if ctx.op is None else ctx.op.name

        if entity is not None and opname != "list":
            if opname == "remove":
                entity.mark_deleted()
            return entity

        return ctx.result.resdata

    # make_error raises on the default (throw) path; only returns bare
    # resdata when throw_err is explicitly disabled.
    return ctx.utility.make_error(ctx, None)
