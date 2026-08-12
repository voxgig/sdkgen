-- ProjectName SDK utility: done

local function done_util(ctx)
  if ctx.ctrl.explain ~= nil then
    ctx.ctrl.explain = ctx.utility.clean(ctx, ctx.ctrl.explain)
    local explain_result = ctx.ctrl.explain["result"]
    if type(explain_result) == "table" then
      explain_result["err"] = nil
    end
  end

  -- An operation resolves to the ENTITY, not the raw data. Entities are
  -- stateful: the op fragment has just absorbed resdata/resmatch into this
  -- instance, and the caller reaches the record through .data(). Two
  -- structural exceptions: `list` resolves to the ARRAY of entity
  -- instances makeResult built, and a context with no entity
  -- (direct/prepare, streaming) has nothing to return but the data. A
  -- removed entity keeps its data but is no longer live. See AGENTS.md.
  if ctx.result ~= nil and ctx.result.ok then
    local entity = ctx.entity
    local opname = ctx.op ~= nil and ctx.op.name or nil

    if entity ~= nil and opname ~= "list" then
      if opname == "remove" then
        entity:mark_deleted()
      end
      return entity, nil
    end

    return ctx.result.resdata, nil
  end

  return ctx.utility.make_error(ctx, nil)
end

return done_util
