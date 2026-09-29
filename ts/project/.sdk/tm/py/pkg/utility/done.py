# ProjectName SDK utility: done


def done_util(ctx):
    explain = ctx.ctrl.explain
    if explain is not None:
        cleaned = ctx.utility.clean(ctx, explain)
        # In place: the caller holds this very dict (ctrl is built from it),
        # so a reassignment would leave the raw record in their hands.
        if isinstance(explain, dict) and isinstance(cleaned, dict) and cleaned is not explain:
            explain.clear()
            explain.update(cleaned)
        else:
            ctx.ctrl.explain = cleaned
        explain = ctx.ctrl.explain
        explain_result = explain.get("result") if isinstance(explain, dict) else None
        if isinstance(explain_result, dict):
            explain_result.pop("err", None)

    if ctx.result is not None and ctx.result.ok:
        return ctx.result.resdata

    # make_error raises on the default (throw) path; only returns bare
    # resdata when throw_err is explicitly disabled.
    return ctx.utility.make_error(ctx, None)
