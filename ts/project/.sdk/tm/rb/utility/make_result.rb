# ProjectName SDK utility: make_result
module ProjectNameUtilities
  MakeResult = ->(ctx) {
    return ctx.out["result"], nil if ctx.out["result"]
    utility = ctx.utility
    op = ctx.op
    entity = ctx.entity
    spec = ctx.spec
    result = ctx.result

    return nil, ctx.make_error("result_no_spec", "Expected context spec property to be defined.") unless spec
    return nil, ctx.make_error("result_no_result", "Expected context result property to be defined.") unless result

    spec.step = "result"
    utility.transform_response.call(ctx)

    # Every operation resolves to PLAIN records — load, create, update and
    # list alike. `list` used to be the outlier: it wrapped each record in
    # an entity instance, so the same record came back with a different
    # type, a different key order and an extra marker depending on which
    # call produced it. Any consumer touching both paths had to normalise
    # defensively, and feeding a wrapped record into a host framework's own
    # metadata silently produced wrong entities with no error at all. A
    # missing or empty list still normalises to an empty list.
    if op.name == "list"
      resdata = result.resdata
      result.resdata = resdata.is_a?(Array) ? resdata : []
    end

    ctx.ctrl.explain["result"] = result if ctx.ctrl.explain
    return result, nil
  }
end
