# ProjectName SDK utility: make_result


def make_result_util(ctx):
    pre = ctx.out.get("result")
    if pre is not None:
        # A feature hook may short-circuit with an error (see make_point).
        if isinstance(pre, Exception):
            return None, pre
        return pre, None

    utility = ctx.utility
    op = ctx.op
    entity = ctx.entity
    spec = ctx.spec
    result = ctx.result

    if spec is None:
        return None, ctx.make_error("result_no_spec",
            "Expected context spec property to be defined.")
    if result is None:
        return None, ctx.make_error("result_no_result",
            "Expected context result property to be defined.")

    spec.step = "result"

    utility.transform_response(ctx)

    # Every operation resolves to PLAIN records — load, create, update and
    # list alike. `list` used to be the outlier: it wrapped each record in
    # an entity instance, so the same record came back with a different
    # type, a different key order and an extra marker depending on which
    # call produced it. Any consumer touching both paths had to normalise
    # defensively, and feeding a wrapped record into a host framework's own
    # metadata silently produced wrong entities with no error at all. A
    # missing or empty list still normalises to an empty list.
    if op.name == "list":
        resdata = result.resdata
        result.resdata = resdata if isinstance(resdata, list) else []

    if ctx.ctrl.explain is not None:
        ctx.ctrl.explain["result"] = result

    return result, None
