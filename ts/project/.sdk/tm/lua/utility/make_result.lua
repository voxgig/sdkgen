-- ProjectName SDK utility: make_result

local function make_result_util(ctx)
  if ctx.out["result"] ~= nil then
    return ctx.out["result"], nil
  end

  local utility = ctx.utility
  local op = ctx.op
  local entity = ctx.entity
  local spec = ctx.spec
  local result = ctx.result

  if spec == nil then
    return nil, ctx:make_error("result_no_spec",
      "Expected context spec property to be defined.")
  end
  if result == nil then
    return nil, ctx:make_error("result_no_result",
      "Expected context result property to be defined.")
  end

  spec.step = "result"

  utility.transform_response(ctx)

  -- Every operation resolves to PLAIN records — load, create, update and
  -- list alike. `list` used to be the outlier: it wrapped each record in
  -- an entity instance, so the same record came back with a different
  -- type, a different key order and an extra marker depending on which
  -- call produced it. Any consumer touching both paths had to normalise
  -- defensively, and feeding a wrapped record into a host framework's own
  -- metadata silently produced wrong entities with no error at all. A
  -- missing or empty list still normalises to an empty list.
  if op.name == "list" then
    local resdata = result.resdata
    result.resdata = (type(resdata) == "table") and resdata or {}
  end

  if ctx.ctrl.explain ~= nil then
    ctx.ctrl.explain["result"] = result
  end

  return result, nil
end

return make_result_util
