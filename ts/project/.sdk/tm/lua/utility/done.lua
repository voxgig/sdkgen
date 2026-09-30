-- ProjectName SDK utility: done

local function done_util(ctx)
  local explain = ctx.ctrl.explain
  if explain ~= nil then
    -- The caller holds this table, so the masked entries replace its own
    -- rather than a copy the caller would never see.
    local cleaned = ctx.utility.clean(ctx, explain)
    if type(cleaned) == "table" and cleaned ~= explain then
      for k in pairs(explain) do
        explain[k] = nil
      end
      for k, v in pairs(cleaned) do
        explain[k] = v
      end
    end
    local explain_result = explain["result"]
    if type(explain_result) == "table" then
      explain_result["err"] = nil
    end
  end

  if ctx.result ~= nil and ctx.result.ok then
    return ctx.result.resdata, nil
  end

  return ctx.utility.make_error(ctx, nil)
end

return done_util
